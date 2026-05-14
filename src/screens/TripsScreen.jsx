import React, { useState } from 'react'
import { Plus, Trash2, ChevronRight, Route, Calendar, StopCircle } from 'lucide-react'
import { useTripStore, useUIStore, useSessionStore } from '../stores/index.js'
import { formatDate } from '../utils/time.js'
import { TRIP_MODE, TRANSPORT_MODE, TRIP_PROFILE } from '../engine/models.js'
import { Card, Button, EmptyState } from '../components/ui/index.jsx'

// ============================================================
// TRIPS SCREEN — List all trips, create new ones
// ============================================================

export default function TripsScreen() {
  const trips        = useTripStore(s => s.trips)
  const addTrip      = useTripStore(s => s.addTrip)
  const deleteTrip   = useTripStore(s => s.deleteTrip)
  const openTrip     = useUIStore(s => s.openTrip)
  const isRunning    = useSessionStore(s => s.isRunning)
  const activeTripId = useSessionStore(s => s.activeTripId)
  const endTrip      = useSessionStore(s => s.endTrip)
  const [creating, setCreating]         = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmEndId, setConfirmEndId]       = useState(null)

  const handleDelete = (tripId) => {
    // If deleting the active trip, clear session first to avoid a broken state
    if (isRunning && activeTripId === tripId) endTrip()
    deleteTrip(tripId)
    setConfirmDeleteId(null)
  }

  const handleCreate = (tripData) => {
    const trip = addTrip(tripData)
    openTrip(trip.id)
    setCreating(false)
    setConfirmDeleteId(null)
    setConfirmEndId(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">My Trips</h1>
        <Button onClick={() => setCreating(true)} size="sm">
          <Plus size={16} />
          New trip
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {trips.length === 0 ? (
          <EmptyState
            icon={Route}
            title="No trips yet"
            description="Plan a road trip or day out and let Time Traveler track your timeline."
            action={<Button onClick={() => setCreating(true)}><Plus size={16} />Create first trip</Button>}
          />
        ) : (
          <div className="space-y-3">
            {trips.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                isActive={isRunning && activeTripId === trip.id}
                onOpen={() => openTrip(trip.id)}
                confirmingDelete={confirmDeleteId === trip.id}
                onRequestDelete={() => setConfirmDeleteId(trip.id)}
                onConfirmDelete={() => handleDelete(trip.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
                confirmingEnd={confirmEndId === trip.id}
                onRequestEnd={() => setConfirmEndId(trip.id)}
                onConfirmEnd={() => { endTrip(); setConfirmEndId(null) }}
                onCancelEnd={() => setConfirmEndId(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create trip modal */}
      {creating && (
        <CreateTripSheet
          onClose={() => setCreating(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

// ============================================================
// TRIP CARD
// ============================================================

function TripCard({
  trip, isActive, onOpen,
  confirmingDelete, onRequestDelete, onConfirmDelete, onCancelDelete,
  confirmingEnd,   onRequestEnd,    onConfirmEnd,    onCancelEnd,
}) {
  const cpCount    = trip.checkpoints.length
  const fixedCount = trip.checkpoints.filter(c => c.isFixed).length
  const modeLabel  = trip.mode === TRIP_MODE.ROAD_TRIP ? '🚗 Road trip' : '🚶 Day trip'

  return (
    <Card
      className={`overflow-hidden ${isActive ? 'ring-1 ring-status-ok/50' : ''}`}
      onClick={confirmingDelete || confirmingEnd ? undefined : onOpen}
    >
      {/* Active trip banner */}
      {isActive && (
        <div className="bg-status-ok/10 border-b border-status-ok/20 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-status-ok animate-pulse inline-block" />
            <span className="text-xs font-semibold text-status-ok">Trip in progress</span>
          </div>
          {confirmingEnd ? (
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={onCancelEnd}
                className="text-xs text-surface-400 hover:text-white px-2 py-1 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmEnd}
                className="flex items-center gap-1 text-xs font-semibold text-white bg-status-at_risk hover:bg-red-600 px-2.5 py-1 rounded-lg transition-colors"
              >
                <StopCircle size={11} />
                Confirm end
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestEnd() }}
              className="flex items-center gap-1.5 text-xs font-medium text-status-at_risk hover:text-white bg-status-at_risk/10 hover:bg-status-at_risk/20 border border-status-at_risk/30 px-2.5 py-1 rounded-lg transition-colors"
            >
              <StopCircle size={12} />
              End trip
            </button>
          )}
        </div>
      )}

      <div className="px-4 py-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold truncate">{trip.title}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-surface-500 flex items-center gap-1">
                <Calendar size={11} />
                {formatDate(trip.date)}
              </span>
              <span className="text-xs text-surface-500">{modeLabel}</span>
            </div>
          </div>
          <ChevronRight size={18} className="text-surface-500 flex-shrink-0 mt-0.5" />
        </div>

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-600/30">
          <span className="text-xs text-surface-500">
            <span className="text-white font-medium">{cpCount}</span> stops
          </span>
          {fixedCount > 0 && (
            <span className="text-xs text-surface-500">
              <span className="text-white font-medium">{fixedCount}</span> deadline{fixedCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs text-surface-500">Starts {trip.startTime}</span>

          {/* Delete — with inline confirmation */}
          <div className="ml-auto flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {confirmingDelete ? (
              <>
                <span className="text-xs text-surface-400">Delete trip?</span>
                <button
                  onClick={onCancelDelete}
                  className="text-xs text-surface-400 hover:text-white px-2 py-0.5 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirmDelete}
                  className="text-xs font-semibold text-status-at_risk hover:text-white px-2 py-0.5 rounded transition-colors"
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); onRequestDelete() }}
                className="text-surface-600 hover:text-status-at_risk transition-colors p-1"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ============================================================
// CREATE TRIP SHEET
// ============================================================

function CreateTripSheet({ onClose, onCreate }) {
  const [form, setForm] = useState(() => {
    const now         = new Date()
    const totalMins   = now.getHours() * 60 + now.getMinutes()
    const roundedMins = Math.round(totalMins / 5) * 5
    const h           = Math.floor(roundedMins / 60) % 24
    const m           = roundedMins % 60
    return {
      title:         '',
      date:          now.toISOString().split('T')[0],
      startTime:     `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      tripProfile:   TRIP_PROFILE.ROADTRIP,
      mode:          TRIP_MODE.ROAD_TRIP,
      transportMode: TRANSPORT_MODE.CAR,
      defaultBuffer: 15,
      minBuffer:     5,
      origin: { name: '', address: '', lat: null, lng: null },
    }
  })

  const set       = (key, val)      => setForm(f => ({ ...f, [key]: val }))
  const setOrigin = (key, val)      => setForm(f => ({ ...f, origin: { ...f.origin, [key]: val } }))

  const handleSubmit = () => {
    if (!form.title.trim()) return
    onCreate(form)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-800 border-t border-surface-600/50 rounded-t-2xl animate-slide-up pb-safe">

        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-surface-600 rounded-full" />
        </div>

        <div className="px-4 pb-6 max-h-[85vh] overflow-y-auto">
          <h2 className="text-lg font-bold text-white mt-2 mb-5">New Trip</h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs text-surface-500 uppercase tracking-wider mb-1.5 block">Trip name</label>
              <input
                type="text"
                placeholder="e.g. Ferry trip to Göteborg"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                className="w-full bg-surface-700 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:border-accent text-sm"
                autoFocus
              />
            </div>

            {/* Origin — where the trip starts from */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-surface-500 uppercase tracking-wider mb-1.5 block">Starting from</label>
                <input
                  type="text"
                  placeholder="e.g. Home, Malmö"
                  value={form.origin.name}
                  onChange={e => setOrigin('name', e.target.value)}
                  className="w-full bg-surface-700 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-surface-500 uppercase tracking-wider mb-1.5 block">Address (optional)</label>
                <input
                  type="text"
                  placeholder="For navigation (optional)"
                  value={form.origin.address}
                  onChange={e => setOrigin('address', e.target.value)}
                  className="w-full bg-surface-700 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:border-accent text-sm"
                />
              </div>
            </div>

            {/* Date + Start time */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-surface-500 uppercase tracking-wider mb-1.5 block">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  className="w-full bg-surface-700 border border-surface-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-surface-500 uppercase tracking-wider mb-1.5 block">Start time</label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={e => set('startTime', e.target.value)}
                  className="w-full bg-surface-700 border border-surface-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-accent text-sm"
                />
              </div>
            </div>

            {/* Trip profile — drives language tone throughout the app */}
            <div>
              <label className="text-xs text-surface-500 uppercase tracking-wider mb-1.5 block">Trip style</label>
              <div className="flex gap-2">
                {[
                  { value: TRIP_PROFILE.ROADTRIP,     label: '🏍️ Roadtrip',      desc: 'Ferries, trains, or long drives with hard connections' },
                  { value: TRIP_PROFILE.CITY_TOURISM, label: '🏛️ City day trip',  desc: 'Museums, restaurants, and attractions — time to enjoy'  },
                  { value: TRIP_PROFILE.CUSTOM,       label: '⚙️ Custom',         desc: 'Mixed trip — set your own expectations'                 },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => set('tripProfile', opt.value)}
                    className={`flex-1 py-3 px-2 rounded-xl border text-left transition-colors ${
                      form.tripProfile === opt.value
                        ? 'border-accent bg-accent/10 text-white'
                        : 'border-surface-600 bg-surface-700 text-surface-400'
                    }`}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs opacity-60 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Buffer */}
            <div>
              <label className="text-xs text-surface-500 uppercase tracking-wider mb-1.5 block">
                How early do you like to arrive at connections?
              </label>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={form.defaultBuffer}
                onChange={e => set('defaultBuffer', Number(e.target.value))}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-xs text-surface-500 mt-1">
                <span>Cutting it close</span>
                <span>Plenty of time</span>
              </div>
              <p className="text-xs text-white font-medium mt-1">
                {form.defaultBuffer}m early — {
                  form.defaultBuffer <= 5  ? 'cutting it close' :
                  form.defaultBuffer <= 15 ? 'balanced' :
                  form.defaultBuffer <= 30 ? 'comfortable' :
                  'plenty of time'
                }
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!form.title.trim()}
              className="flex-1"
            >
              Create trip
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
