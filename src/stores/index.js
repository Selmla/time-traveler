// ============================================================
// ZUSTAND STORES
// ============================================================
// Three stores, each with a clear responsibility:
//
// tripStore     — persisted trip data (the plan)
// sessionStore  — ephemeral active trip state (the runtime)
// uiStore       — UI state (which screen, modals, etc.)
//
// Why Zustand over Redux?
// - No boilerplate
// - Simple API
// - Built-in persistence middleware
// - Works great with React
// ============================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createTrip, createCheckpoint } from '../engine/models.js'

// ============================================================
// TRIP STORE — The Plan
// Persisted to localStorage. This is the source of truth for
// all trip data. Survives page refreshes.
// ============================================================

export const useTripStore = create(
  persist(
    (set, get) => ({
      trips: [],
      activeTripId: null,

      // --- Trip CRUD ---

      addTrip: (overrides = {}) => {
        const trip = createTrip(overrides)
        set(state => ({ trips: [...state.trips, trip] }))
        return trip
      },

      updateTrip: (tripId, changes) => {
        set(state => ({
          trips: state.trips.map(t =>
            t.id === tripId
              ? { ...t, ...changes, updatedAt: Date.now() }
              : t
          )
        }))
      },

      deleteTrip: (tripId) => {
        set(state => ({
          trips: state.trips.filter(t => t.id !== tripId),
          activeTripId: state.activeTripId === tripId ? null : state.activeTripId,
        }))
      },

      setActiveTripId: (tripId) => {
        set({ activeTripId: tripId })
      },

      // --- Checkpoint CRUD ---

      addCheckpoint: (tripId, overrides = {}) => {
        const cp = createCheckpoint(overrides)
        set(state => ({
          trips: state.trips.map(t => {
            if (t.id !== tripId) return t
            return {
              ...t,
              checkpoints: [...t.checkpoints, cp],
              updatedAt: Date.now(),
            }
          })
        }))
        return cp
      },

      updateCheckpoint: (tripId, cpId, changes) => {
        set(state => ({
          trips: state.trips.map(t => {
            if (t.id !== tripId) return t
            return {
              ...t,
              checkpoints: t.checkpoints.map(cp =>
                cp.id === cpId ? { ...cp, ...changes } : cp
              ),
              updatedAt: Date.now(),
            }
          })
        }))
      },

      deleteCheckpoint: (tripId, cpId) => {
        set(state => ({
          trips: state.trips.map(t => {
            if (t.id !== tripId) return t
            return {
              ...t,
              checkpoints: t.checkpoints.filter(cp => cp.id !== cpId),
              updatedAt: Date.now(),
            }
          })
        }))
      },

      moveCheckpoint: (tripId, cpId, direction) => {
        set(state => ({
          trips: state.trips.map(t => {
            if (t.id !== tripId) return t
            const cps = [...t.checkpoints]
            const idx = cps.findIndex(cp => cp.id === cpId)
            if (idx < 0) return t
            const newIdx = direction === 'up' ? idx - 1 : idx + 1
            if (newIdx < 0 || newIdx >= cps.length) return t
            ;[cps[idx], cps[newIdx]] = [cps[newIdx], cps[idx]]
            return { ...t, checkpoints: cps, updatedAt: Date.now() }
          })
        }))
      },

      // --- Selectors ---
      getTrip:        (tripId) => get().trips.find(t => t.id === tripId),
      getActiveTrip:  () => get().trips.find(t => t.id === get().activeTripId),
    }),
    {
      name: 'time-traveler-trips',
      version: 2, // bumped — clears v1 data (incompatible checkpoint model)
      migrate: () => ({ trips: [], activeTripId: null }),
    }
  )
)

// ============================================================
// SESSION STORE — The Runtime
// Persisted to localStorage via 'time-traveler-session'.
// Ephemeral fields (GPS position, what-if state) are excluded
// via partialize and reset to initial values on hydration.
// ============================================================

export const useSessionStore = create(
  persist(
    (set, get) => ({
  // Which trip is active
  activeTripId: null,

  // Per-checkpoint session data:
  // { [cpId]: { status, actualArrivalTime, actualDepartureTime, actualDurationMinutes, delayMinutes } }
  // status: 'arrived' | 'completed' | 'skipped'
  // times are HH:MM strings
  checkpointActuals: {},

  // Per-leg travel data. Key = makeLegId(fromId, toId).
  // Phase 3 will populate this from Maps API; Phase 2 it is empty and the engine
  // falls back to checkpoint.travelTimeToNext for all legs.
  // Shape: { fromId, toId, travelTimeMinutes, distanceText, durationText,
  //          source: 'manual'|'maps'|'unknown', routeRisk: 'none'|'traffic'|'blocked'|'unknown', updatedAt }
  legData: {},

  // Current GPS position
  currentPosition: null,

  // Is the trip actively running?
  isRunning: false,

  // When did the trip start?
  startedAt: null,

  // Undo history: [{ cpId, prevState }]
  actionHistory: [],

  // What-if simulation state
  whatIfActive: false,
  whatIfCheckpointId: null,
  whatIfExtraMinutes: 0,

  // --- Actions ---

  startTrip: (tripId) => {
    set({
      activeTripId:      tripId,
      isRunning:         true,
      startedAt:         Date.now(),
      checkpointActuals: {},
      whatIfActive:      false,
      actionHistory:     [],
    })
    useUIStore.getState().setGlanceModeActive(true)
  },

  endTrip: () => {
    set({
      activeTripId:      null,
      isRunning:         false,
      startedAt:         null,
      checkpointActuals: {},
      legData:           {},
      whatIfActive:      false,
      actionHistory:     [],
    })
    useUIStore.getState().setGlanceModeActive(false)
  },

  markArrived: (cpId) => {
    set(state => {
      const now  = new Date().toTimeString().slice(0, 5)
      const prev = state.checkpointActuals[cpId]
      return {
        checkpointActuals: {
          ...state.checkpointActuals,
          [cpId]: { ...(prev || {}), status: 'arrived', actualArrivalTime: now },
        },
        actionHistory: [...state.actionHistory, { cpId, prevState: prev }],
      }
    })
  },

  markDeparted: (cpId) => {
    set(state => {
      const now  = new Date().toTimeString().slice(0, 5)
      const prev = state.checkpointActuals[cpId] || {}
      const arrivalTime = prev.actualArrivalTime
      let actualDurationMinutes = null
      if (arrivalTime) {
        const [ah, am] = arrivalTime.split(':').map(Number)
        const [dh, dm] = now.split(':').map(Number)
        const diff = (dh * 60 + dm) - (ah * 60 + am)
        actualDurationMinutes = diff < 0 ? diff + 24 * 60 : diff
      }
      return {
        checkpointActuals: {
          ...state.checkpointActuals,
          [cpId]: { ...prev, status: 'completed', actualDepartureTime: now, actualDurationMinutes },
        },
        actionHistory: [...state.actionHistory, { cpId, prevState: prev }],
      }
    })
  },

  markCompleted: (cpId) => {
    // Shortcut: marks arrived + departed in one action (for stops where you don't care to time the stay)
    set(state => {
      const now  = new Date().toTimeString().slice(0, 5)
      const prev = state.checkpointActuals[cpId] || {}
      const arrivalTime = prev.actualArrivalTime || now
      const [ah, am] = arrivalTime.split(':').map(Number)
      const [dh, dm] = now.split(':').map(Number)
      const diff = (dh * 60 + dm) - (ah * 60 + am)
      return {
        checkpointActuals: {
          ...state.checkpointActuals,
          [cpId]: {
            ...prev,
            status:               'completed',
            actualArrivalTime:    arrivalTime,
            actualDepartureTime:  now,
            actualDurationMinutes: diff < 0 ? diff + 24 * 60 : diff,
          },
        },
        actionHistory: [...state.actionHistory, { cpId, prevState: prev }],
      }
    })
  },

  markSkipped: (cpId) => {
    set(state => {
      const prev = state.checkpointActuals[cpId]
      return {
        checkpointActuals: {
          ...state.checkpointActuals,
          [cpId]: { ...(prev || {}), status: 'skipped' },
        },
        actionHistory: [...state.actionHistory, { cpId, prevState: prev }],
      }
    })
  },

  addDelay: (cpId, minutes) => {
    // Records extra time spent at this stop; cascades forward in the timeline engine
    set(state => {
      const prev = state.checkpointActuals[cpId] || {}
      return {
        checkpointActuals: {
          ...state.checkpointActuals,
          [cpId]: { ...prev, delayMinutes: (prev.delayMinutes || 0) + minutes },
        },
        actionHistory: [...state.actionHistory, { cpId, prevState: prev }],
      }
    })
  },

  undoLastAction: () => {
    set(state => {
      if (!state.actionHistory.length) return state
      const history    = [...state.actionHistory]
      const { cpId, prevState } = history.pop()
      const newActuals = { ...state.checkpointActuals }
      if (prevState === undefined || prevState === null) {
        delete newActuals[cpId]
      } else {
        newActuals[cpId] = prevState
      }
      return { checkpointActuals: newActuals, actionHistory: history }
    })
  },

  // Update a single leg's data. Called by Maps integration in Phase 3.
  // legId = makeLegId(fromId, toId) from engine/models.js
  updateLeg: (legId, data) => {
    set(state => ({
      legData: {
        ...state.legData,
        [legId]: { ...(state.legData[legId] || {}), ...data, updatedAt: Date.now() },
      }
    }))
  },

  setPosition: (position) => set({ currentPosition: position }),

  // What-If simulation
  openWhatIf: (cpId, initialMinutes = 15) => {
    set({ whatIfActive: true, whatIfCheckpointId: cpId, whatIfExtraMinutes: initialMinutes })
  },

  closeWhatIf: () => {
    set({ whatIfActive: false, whatIfCheckpointId: null, whatIfExtraMinutes: 0 })
  },

  setWhatIfMinutes: (minutes) => {
    set({ whatIfExtraMinutes: Math.max(0, Math.min(180, minutes)) })
  },
    }),
    {
      name: 'time-traveler-session',
      version: 1,
      // Only persist the fields the engine needs to reconstruct session state.
      // currentPosition is always live from the device.
      // whatIf* state is intentionally transient — simulation restarts fresh each time.
      partialize: (state) => ({
        isRunning:         state.isRunning,
        activeTripId:      state.activeTripId,
        checkpointActuals: state.checkpointActuals,
        legData:           state.legData,
        actionHistory:     state.actionHistory,
        startedAt:         state.startedAt,
      }),
    }
  )
)

// ============================================================
// UI STORE — Navigation and modals
// ============================================================

export const useUIStore = create(
  persist(
    (set) => ({
      // Bottom tab navigation
      activeTab: 'now',   // 'now' | 'trips' | 'plan'

      // Which trip is open in the plan tab
      selectedTripId: null,

      // Glance Mode — full-screen riding overlay
      glanceModeActive: false,

      // Modal/sheet state
      checkpointEditorOpen: false,
      checkpointEditorId:   null,   // null = new, string = editing existing
      checkpointEditorTripId: null,

      // Visual theme — 'night' (dark HUD) | 'day' (high-contrast light)
      theme: 'night',

      // Actions
      setTab: (tab) => set({ activeTab: tab }),

      toggleTheme: () => set(s => ({ theme: s.theme === 'night' ? 'day' : 'night' })),

      toggleGlanceMode: () => set(s => ({ glanceModeActive: !s.glanceModeActive })),
      setGlanceModeActive: (active) => set({ glanceModeActive: active }),

      openTrip:  (tripId) => set({ selectedTripId: tripId, activeTab: 'plan' }),
      closeTrip: ()       => set({ selectedTripId: null,   activeTab: 'trips' }),

      openCheckpointEditor: (tripId, cpId = null) => set({
        checkpointEditorOpen:   true,
        checkpointEditorTripId: tripId,
        checkpointEditorId:     cpId,
      }),

      closeCheckpointEditor: () => set({
        checkpointEditorOpen:   false,
        checkpointEditorTripId: null,
        checkpointEditorId:     null,
      }),
    }),
    {
      name: 'time-traveler-ui',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
)
