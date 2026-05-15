import React, { useState } from 'react'
import { Plus, ChevronLeft, Play, ArrowUp, ArrowDown, Trash2, Edit3, Clock, Lock, AlertTriangle, MapPin } from 'lucide-react'
import { useTripStore, useSessionStore, useUIStore } from '../stores/index.js'
import { useTimeline } from '../hooks/useTimeline.js'
import { CHECKPOINT_KIND, DEPARTURE_MODE, DEFAULT_BUFFERS, TRAVEL_MODE, createCheckpoint, makeLegId } from '../engine/models.js'
import { formatDate, formatTime, diffMinutes, parseTimeOnDate } from '../utils/time.js'
import { Card, Button, StatusDot, CheckpointTypeIcon, EmptyState } from '../components/ui/index.jsx'
import TimelineView from '../components/timeline/TimelineView.jsx'

// ============================================================
// PLAN SCREEN — Trip detail, checkpoint management, timeline preview
// ============================================================

export default function PlanScreen() {
  const selectedTripId = useUIStore(s => s.selectedTripId)
  const setTab         = useUIStore(s => s.setTab)
  const closeTrip      = useUIStore(s => s.closeTrip)
  const trip           = useTripStore(s => s.trips.find(t => t.id === selectedTripId))
  const deleteTrip     = useTripStore(s => s.deleteTrip)
  const startTrip      = useSessionStore(s => s.startTrip)
  const endTrip        = useSessionStore(s => s.endTrip)
  const isRunning      = useSessionStore(s => s.isRunning)
  const activeId       = useSessionStore(s => s.activeTripId)
  const startedAt      = useSessionStore(s => s.startedAt)

  const [view, setView]                   = useState('checkpoints')
  const [addingCheckpoint, setAddingCheckpoint] = useState(false)
  const [editingCheckpointId, setEditingCheckpointId] = useState(null)
  const [confirmDeleteTrip, setConfirmDeleteTrip]     = useState(false)
  const [confirmingStart, setConfirmingStart]         = useState(false)

  const handleDeleteTrip = () => {
    if (isRunning && activeId === trip.id) endTrip()
    deleteTrip(trip.id)
    closeTrip()
  }

  if (!selectedTripId || !trip) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6">
        <EmptyState
          icon={Clock}
          title="No trip selected"
          description="Go to Trips to select or create a trip."
          action={<Button onClick={() => setTab('trips')}>Go to Trips</Button>}
        />
      </div>
    )
  }

  const isThisActive = isRunning && activeId === trip.id

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setTab('trips')} className="text-surface-500 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white leading-tight truncate">{trip.title}</h1>
            <p className="text-xs text-surface-500">{formatDate(trip.date)} · Starts {trip.startTime}</p>
          </div>
        </div>

        {!isThisActive && (
          <Button
            variant="primary"
            className="w-full mt-3"
            onClick={() => setConfirmingStart(true)}
          >
            <Play size={16} />
            Start this trip
          </Button>
        )}
        {isThisActive && (
          <>
            <Button variant="success" className="w-full mt-3" onClick={() => setTab('now')}>
              ● Trip is running — view dashboard
            </Button>
            {startedAt && <DepartureBanner trip={trip} startedAt={startedAt} />}
          </>
        )}
      </div>

      {/* Tab switcher */}
      <div className="px-4 mb-3">
        <div className="flex gap-1 bg-surface-700 rounded-xl p-1">
          <button
            className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${view === 'checkpoints' ? 'bg-surface-600 text-white' : 'text-surface-500'}`}
            onClick={() => setView('checkpoints')}
          >
            Stops ({trip.checkpoints.length})
          </button>
          <button
            className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${view === 'timeline' ? 'bg-surface-600 text-white' : 'text-surface-500'}`}
            onClick={() => setView('timeline')}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {view === 'checkpoints' ? (
          <CheckpointList
            trip={trip}
            onAdd={() => setAddingCheckpoint(true)}
            onEdit={id => setEditingCheckpointId(id)}
          />
        ) : (
          <PlanTimelineView trip={trip} />
        )}

        {/* Danger zone */}
        <div className="mt-8 border-t border-surface-600/30 pt-5">
          {confirmDeleteTrip ? (
            <div className="bg-status-at_risk/10 border border-status-at_risk/30 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-status-at_risk flex-shrink-0 mt-0.5" />
                <p className="text-sm text-white">Delete this trip? This cannot be undone.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteTrip(false)} className="flex-1">
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={handleDeleteTrip} className="flex-1">
                  <Trash2 size={14} />
                  Delete trip
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDeleteTrip(true)}
              className="flex items-center gap-2 text-surface-500 hover:text-status-at_risk text-sm transition-colors"
            >
              <Trash2 size={14} />
              Delete trip
            </button>
          )}
        </div>
      </div>

      {/* Checkpoint editor */}
      {(addingCheckpoint || editingCheckpointId) && (
        <CheckpointEditor
          trip={trip}
          checkpointId={editingCheckpointId}
          onClose={() => { setAddingCheckpoint(false); setEditingCheckpointId(null) }}
        />
      )}

      {/* Departure confirmation sheet */}
      {confirmingStart && (
        <DepartureConfirmation
          trip={trip}
          onConfirm={() => { startTrip(trip.id); setConfirmingStart(false); setTab('now') }}
          onCancel={() => setConfirmingStart(false)}
        />
      )}
    </div>
  )
}

// ============================================================
// DEPARTURE BANNER — shown when trip is active
// ============================================================

function DepartureBanner({ trip, startedAt }) {
  const departedAt   = new Date(startedAt)
  const departedTime = formatTime(departedAt)
  const planned      = parseTimeOnDate(trip.startTime, new Date(trip.date + 'T12:00:00'))
  const deltaMins    = planned ? diffMinutes(planned, departedAt) : 0

  return (
    <div className="flex items-center justify-between text-xs bg-surface-700/60 rounded-lg px-3 py-2 mt-2">
      <span className="text-surface-400">Departed {departedTime}</span>
      {Math.abs(deltaMins) > 1 && (
        <span className={deltaMins > 0 ? 'text-status-tight font-medium' : 'text-status-ok font-medium'}>
          {deltaMins > 0 ? `+${deltaMins} min from plan` : `${Math.abs(deltaMins)} min early`}
        </span>
      )}
    </div>
  )
}

// ============================================================
// DEPARTURE CONFIRMATION — "I'm leaving now" sheet
// ============================================================

function DepartureConfirmation({ trip, onConfirm, onCancel }) {
  const now         = new Date()
  const currentTime = formatTime(now)
  const planned     = parseTimeOnDate(trip.startTime, new Date(trip.date + 'T12:00:00'))
  const deltaMins   = planned ? diffMinutes(planned, now) : 0

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onCancel} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-800 border-t border-surface-600/50 rounded-t-2xl animate-slide-up pb-safe">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-surface-600 rounded-full" />
        </div>
        <div className="px-4 pb-6">
          <h2 className="text-xl font-bold text-white mt-2 mb-1">You're leaving now</h2>
          <p className="text-sm text-surface-400 mb-5">
            This sets your live departure time — all ETAs adjust from this moment.
          </p>

          <div className="bg-surface-700/50 rounded-xl p-4 space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Planned departure</span>
              <span className="font-mono text-white">{trip.startTime}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Actual departure</span>
              <span className="font-mono text-accent font-semibold">{currentTime}</span>
            </div>
            {Math.abs(deltaMins) > 1 && (
              <div className="border-t border-surface-600/40 pt-2 flex justify-between text-sm">
                <span className="text-surface-500">Timeline shift</span>
                <span className={`font-mono font-semibold ${deltaMins > 0 ? 'text-status-at_risk' : 'text-status-ok'}`}>
                  {deltaMins > 0 ? `+${deltaMins} min behind plan` : `${Math.abs(deltaMins)} min ahead`}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={onCancel} className="flex-1">Not yet</Button>
            <Button variant="primary" onClick={onConfirm} className="flex-1">
              <Play size={16} />
              I'm leaving
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

// ============================================================
// CHECKPOINT LIST
// ============================================================

function CheckpointList({ trip, onAdd, onEdit }) {
  const moveCheckpoint   = useTripStore(s => s.moveCheckpoint)
  const deleteCheckpoint = useTripStore(s => s.deleteCheckpoint)

  if (trip.checkpoints.length === 0) {
    return (
      <EmptyState
        icon={Plus}
        title="No stops yet"
        description="Add a ferry, hotel check-in, or any stop with a deadline. One stop is enough to start tracking."
        action={<Button onClick={onAdd}><Plus size={16} /> Add first stop</Button>}
      />
    )
  }

  return (
    <div className="space-y-2">
      {trip.checkpoints.map((cp, index) => (
        <CheckpointRow
          key={cp.id}
          checkpoint={cp}
          index={index}
          total={trip.checkpoints.length}
          onEdit={() => onEdit(cp.id)}
          onMoveUp={() => moveCheckpoint(trip.id, cp.id, 'up')}
          onMoveDown={() => moveCheckpoint(trip.id, cp.id, 'down')}
          onDelete={() => deleteCheckpoint(trip.id, cp.id)}
        />
      ))}

      <button
        onClick={onAdd}
        className="w-full py-3 rounded-xl border border-dashed border-surface-600 text-surface-500 hover:text-white hover:border-surface-500 flex items-center justify-center gap-2 text-sm transition-colors mt-3"
      >
        <Plus size={16} />
        Add stop
      </button>
    </div>
  )
}

function CheckpointRow({ checkpoint: cp, index, total, onEdit, onMoveUp, onMoveDown, onDelete }) {
  let subtitle = ''
  switch (cp.kind) {
    case CHECKPOINT_KIND.DEPARTURE_DEADLINE:
      subtitle = cp.departureTime
        ? `${cp.departureMode || 'departure'} departs ${cp.departureTime}`
        : `${cp.departureMode || 'departure'} — time not set`
      break
    case CHECKPOINT_KIND.OPENING_HOURS:
      subtitle = cp.opensAt && cp.closesAt ? `Open ${cp.opensAt}–${cp.closesAt}` : ''
      break
    case CHECKPOINT_KIND.FIXED_APPOINTMENT:
      subtitle = cp.appointmentTime ? `Appointment at ${cp.appointmentTime}` : ''
      break
    case CHECKPOINT_KIND.START:
      subtitle = cp.plannedDeparture ? `Departs ${cp.plannedDeparture}` : ''
      break
    case CHECKPOINT_KIND.END:
      subtitle = cp.plannedArrival ? `Arrive by ${cp.plannedArrival}` : ''
      break
    default:
      if (cp.plannedArrival) subtitle = `→ ${cp.plannedArrival}`
      if (cp.plannedDuration) subtitle += (subtitle ? '  ' : '') + `${cp.plannedDuration}min`
  }

  const isDeadline = cp.kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE || cp.kind === CHECKPOINT_KIND.FIXED_APPOINTMENT

  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-3">
        <CheckpointTypeIcon kind={cp.kind} departureMode={cp.departureMode} />

        <div className="flex-1 min-w-0" onClick={onEdit}>
          <div className="flex items-center gap-2">
            <span className="text-white font-medium text-sm truncate">{cp.name || 'Unnamed stop'}</span>
            {isDeadline && <Lock size={11} className="text-accent flex-shrink-0" />}
          </div>
          {subtitle ? (
            <span className="text-xs text-surface-500 font-mono">{subtitle}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={index === 0}
            className="w-7 h-7 flex items-center justify-center text-surface-500 hover:text-white disabled:opacity-20 rounded">
            <ArrowUp size={13} />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1}
            className="w-7 h-7 flex items-center justify-center text-surface-500 hover:text-white disabled:opacity-20 rounded">
            <ArrowDown size={13} />
          </button>
          <button onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center text-surface-500 hover:text-white rounded">
            <Edit3 size={13} />
          </button>
          <button onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center text-surface-500 hover:text-status-at_risk rounded">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </Card>
  )
}

// ============================================================
// PLAN TIMELINE VIEW
// ============================================================

function PlanTimelineView({ trip }) {
  const { timeline } = useTimeline(trip.id)

  if (!timeline || timeline.entries.length === 0) {
    return (
      <p className="text-surface-500 text-sm text-center py-8">
        Add stops to see the timeline preview
      </p>
    )
  }

  return <TimelineView trip={trip} timeline={timeline} interactive={false} />
}

// ============================================================
// CHECKPOINT EDITOR — Kind-first guided flow
// ============================================================

function CheckpointEditor({ trip, checkpointId, onClose }) {
  const addCheckpoint    = useTripStore(s => s.addCheckpoint)
  const updateCheckpoint = useTripStore(s => s.updateCheckpoint)
  const updateTrip       = useTripStore(s => s.updateTrip)
  const updateLeg        = useSessionStore(s => s.updateLeg)
  const legData          = useSessionStore(s => s.legData)

  const existing = checkpointId
    ? trip.checkpoints.find(c => c.id === checkpointId)
    : null

  const [kind, setKind] = useState(existing?.kind || null)

  // Position context — where this checkpoint sits (or will sit) in the list
  const cpIndex = checkpointId
    ? trip.checkpoints.findIndex(c => c.id === checkpointId)
    : trip.checkpoints.length
  const fromCheckpoint = cpIndex > 0 ? trip.checkpoints[cpIndex - 1] : null
  const fromStopName   = fromCheckpoint?.name?.trim() || trip.origin?.name?.trim() || 'starting point'
  const fromAddress    = fromCheckpoint
    ? (fromCheckpoint.address?.trim() || fromCheckpoint.name || '')
    : (trip.origin?.address?.trim() || trip.origin?.name || '')

  // legId for the INCOMING leg: prev stop → this stop
  const legId = checkpointId && cpIndex >= 0
    ? makeLegId(cpIndex > 0 ? trip.checkpoints[cpIndex - 1].id : 'origin', checkpointId)
    : null

  // Incoming travel time/mode — initialised from legData (highest priority) or prev stop's persisted field
  const [incomingTravelTime, setIncomingTravelTime] = useState(() => {
    if (legId && legData[legId]?.travelTimeMinutes != null) return legData[legId].travelTimeMinutes
    if (fromCheckpoint) return fromCheckpoint.travelTimeToNext ?? null
    return trip.origin?.travelTimeToFirst ?? null
  })
  const [incomingTravelMode, setIncomingTravelMode] = useState(() => {
    if (legId && legData[legId]?.mode) return legData[legId].mode
    if (fromCheckpoint) return fromCheckpoint.travelModeToNext ?? null
    return trip.origin?.travelModeToFirst ?? null
  })

  // Maps estimate callback: update form display AND write to legData for live timeline preview
  const handleEstimate = ({ travelTimeMinutes, distanceKm }) => {
    setIncomingTravelTime(travelTimeMinutes)
    // legData is already written by MapsEstimateButton for immediate engine reaction;
    // this just keeps the displayed value in sync with the result.
  }

  // Write incoming time to both legData (live) and trip store (persisted across sessions)
  const persistIncomingTime = (resolvedLegId, time, mode) => {
    if (time == null) return
    updateLeg(resolvedLegId, { travelTimeMinutes: time, source: 'manual' })
    if (fromCheckpoint) {
      updateCheckpoint(trip.id, fromCheckpoint.id, {
        travelTimeToNext: time,
        travelModeToNext: mode ?? null,
      })
    } else {
      updateTrip(trip.id, {
        origin: {
          ...trip.origin,
          travelTimeToFirst: time,
          travelModeToFirst: mode ?? null,
        },
      })
    }
  }

  const handleSave = (data) => {
    const fromId = fromCheckpoint ? fromCheckpoint.id : 'origin'
    if (existing) {
      updateCheckpoint(trip.id, checkpointId, data)
      if (legId) persistIncomingTime(legId, incomingTravelTime, incomingTravelMode)
    } else {
      const newCp    = addCheckpoint(trip.id, data)
      const newLegId = makeLegId(fromId, newCp.id)
      persistIncomingTime(newLegId, incomingTravelTime, incomingTravelMode)
    }
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-800 border-t border-surface-600/50 rounded-t-2xl animate-slide-up pb-safe">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-surface-600 rounded-full" />
        </div>

        {!kind ? (
          <KindPicker onPick={setKind} onClose={onClose} />
        ) : (
          <CheckpointForm
            kind={kind}
            existing={existing}
            onSave={handleSave}
            onClose={onClose}
            onBack={existing ? null : () => setKind(null)}
            legId={legId}
            fromAddress={fromAddress}
            fromStopName={fromStopName}
            incomingTravelTime={incomingTravelTime}
            incomingTravelMode={incomingTravelMode}
            onIncomingTimeChange={setIncomingTravelTime}
            onIncomingModeChange={setIncomingTravelMode}
            onEstimate={handleEstimate}
          />
        )}
      </div>
    </>
  )
}

// ============================================================
// STEP 1 — Kind picker
// ============================================================

const KIND_OPTIONS = [
  {
    kind: CHECKPOINT_KIND.NORMAL_STOP,
    icon: '📍',
    label: 'Stop or break',
    desc: 'Sightseeing, coffee, rest stop',
  },
  {
    kind: CHECKPOINT_KIND.FUEL_STOP,
    icon: '⛽',
    label: 'Fuel stop',
    desc: 'Quick fuel or service break',
  },
  {
    kind: CHECKPOINT_KIND.DEPARTURE_DEADLINE,
    icon: '⏱️',
    label: 'Ferry / train / flight',
    desc: 'Anything with a fixed departure you must not miss',
  },
  {
    kind: CHECKPOINT_KIND.OPENING_HOURS,
    icon: '🏛️',
    label: 'Museum or attraction',
    desc: 'Place with opening and closing times',
  },
  {
    kind: CHECKPOINT_KIND.FIXED_APPOINTMENT,
    icon: '📅',
    label: 'Appointment or event',
    desc: 'Restaurant, guided tour, hotel check-in',
  },
  {
    kind: CHECKPOINT_KIND.END,
    icon: '🏁',
    label: 'End point',
    desc: 'Your final destination',
  },
]

function KindPicker({ onPick, onClose }) {
  return (
    <div className="px-4 pb-6 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-5 mt-2">
        <h2 className="text-lg font-bold text-white">What kind of stop?</h2>
        <button onClick={onClose} className="text-surface-500 hover:text-white text-lg leading-none">×</button>
      </div>
      <div className="space-y-2">
        {KIND_OPTIONS.map(k => (
          <button
            key={k.kind}
            onClick={() => onPick(k.kind)}
            className="w-full flex items-center gap-4 bg-surface-700 hover:bg-surface-600 rounded-xl px-4 py-3 text-left transition-colors"
          >
            <span className="text-2xl w-8 text-center">{k.icon}</span>
            <div>
              <div className="text-white font-medium text-sm">{k.label}</div>
              <div className="text-surface-500 text-xs mt-0.5">{k.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// STEP 2 — Kind-specific form
// ============================================================

function CheckpointForm({
  kind, existing, onSave, onClose, onBack,
  legId, fromAddress, fromStopName,
  incomingTravelTime, incomingTravelMode,
  onIncomingTimeChange, onIncomingModeChange,
  onEstimate,
}) {
  const [form, setForm] = useState(() => existing || createCheckpoint({ kind }))
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const canSave = () => {
    if (!form.name?.trim()) return false
    if (kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE && !form.departureTime) return false
    if (kind === CHECKPOINT_KIND.FIXED_APPOINTMENT && !form.appointmentTime) return false
    return true
  }

  const handleSubmit = () => {
    if (!canSave()) return
    onSave(form)
  }

  const kindLabel = {
    [CHECKPOINT_KIND.START]:              'Start point',
    [CHECKPOINT_KIND.END]:                'End point',
    [CHECKPOINT_KIND.NORMAL_STOP]:        'Stop or break',
    [CHECKPOINT_KIND.FUEL_STOP]:          'Fuel stop',
    [CHECKPOINT_KIND.DEPARTURE_DEADLINE]: 'Connection / Deadline',
    [CHECKPOINT_KIND.OPENING_HOURS]:      'Museum / attraction',
    [CHECKPOINT_KIND.FIXED_APPOINTMENT]:  'Appointment / event',
  }[kind] || 'Add stop'

  return (
    <div className="px-4 pb-6 max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5 mt-2">
        {onBack && (
          <button onClick={onBack} className="text-surface-500 hover:text-white">
            <ChevronLeft size={18} />
          </button>
        )}
        <h2 className="text-lg font-bold text-white flex-1">
          {existing ? 'Edit stop' : kindLabel}
        </h2>
        <button onClick={onClose} className="text-surface-500 hover:text-white text-lg leading-none">×</button>
      </div>

      <div className="space-y-4">

        {/* Name — common to all kinds */}
        <FormField label="Name">
          <input
            type="text"
            placeholder={namePlaceholder(kind, form.departureMode)}
            value={form.name || ''}
            onChange={e => set('name', e.target.value)}
            autoFocus
            className={inputCls}
          />
        </FormField>

        {/* Kind-specific fields */}
        {kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE && (
          <DepartureFields form={form} set={set} />
        )}
        {(kind === CHECKPOINT_KIND.NORMAL_STOP || kind === CHECKPOINT_KIND.FUEL_STOP) && (
          <NormalStopFields form={form} set={set} />
        )}
        {kind === CHECKPOINT_KIND.OPENING_HOURS && (
          <OpeningHoursFields form={form} set={set} />
        )}
        {kind === CHECKPOINT_KIND.FIXED_APPOINTMENT && (
          <AppointmentFields form={form} set={set} />
        )}
        {kind === CHECKPOINT_KIND.START && (
          <StartEndFields form={form} set={set} isStart />
        )}
        {kind === CHECKPOINT_KIND.END && (
          <StartEndFields form={form} set={set} isStart={false} />
        )}

        {/* Address — shared (except start/end have their own location field) */}
        {kind !== CHECKPOINT_KIND.START && kind !== CHECKPOINT_KIND.END && (
          <FormField label="Address (optional)">
            <input
              type="text"
              placeholder="Full address — used for Maps estimates and navigation"
              value={form.address || ''}
              onChange={e => set('address', e.target.value)}
              className={inputCls}
            />
          </FormField>
        )}

        {/* Incoming travel leg — how to get FROM previous stop TO here.
            Shown for all kinds except START, which has no previous stop. */}
        {kind !== CHECKPOINT_KIND.START && (
          <TravelLegFields
            fromStopName={fromStopName}
            fromAddress={fromAddress}
            destAddress={form.address?.trim() || form.name?.trim() || ''}
            incomingTime={incomingTravelTime}
            incomingMode={incomingTravelMode}
            onTimeChange={onIncomingTimeChange}
            onModeChange={onIncomingModeChange}
            legId={legId}
            onEstimate={onEstimate}
          />
        )}

        {/* Notes — shared */}
        <FormField label="Notes (optional)">
          <textarea
            placeholder="Booking ref, reminders..."
            value={form.notes || ''}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </FormField>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSave()}
          className="flex-1"
        >
          {existing ? 'Save changes' : 'Add stop'}
        </Button>
      </div>
    </div>
  )
}

// ============================================================
// Kind-specific field groups
// ============================================================

function DepartureFields({ form, set }) {
  const modes = [
    { value: DEPARTURE_MODE.FERRY,  label: '⛴️ Ferry' },
    { value: DEPARTURE_MODE.TRAIN,  label: '🚂 Train' },
    { value: DEPARTURE_MODE.FLIGHT, label: '✈️ Flight' },
    { value: DEPARTURE_MODE.BUS,    label: '🚌 Bus' },
    { value: DEPARTURE_MODE.OTHER,  label: '⚓ Other' },
  ]

  const currentMode = form.departureMode || DEPARTURE_MODE.FERRY

  const handleModeChange = (mode) => {
    const b = DEFAULT_BUFFERS[mode] || DEFAULT_BUFFERS.other
    set('departureMode', mode)
    set('preferredBufferMins', b.preferred)
    set('minimumBufferMins', b.minimum)
  }

  const depTime = form.departureTime
  const preferred = form.preferredBufferMins ?? DEFAULT_BUFFERS[currentMode]?.preferred ?? 30
  const minimum   = form.minimumBufferMins   ?? DEFAULT_BUFFERS[currentMode]?.minimum   ?? 15
  const recArrival    = depTime ? subtractMins(depTime, preferred) : null
  const latestArrival = depTime ? subtractMins(depTime, minimum)   : null

  return (
    <>
      <FormField label="Transport type">
        <div className="flex gap-2 flex-wrap">
          {modes.map(m => (
            <button
              key={m.value}
              onClick={() => handleModeChange(m.value)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                currentMode === m.value
                  ? 'border-accent bg-accent/10 text-white'
                  : 'border-surface-600 bg-surface-700 text-surface-400'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </FormField>

      <FormField label="Departure time">
        <input
          type="time"
          value={form.departureTime || ''}
          onChange={e => set('departureTime', e.target.value)}
          className={inputCls}
        />
      </FormField>

      <div className="bg-surface-700/50 rounded-xl p-4 space-y-3">
        <p className="text-xs text-surface-500 uppercase tracking-wider">How early do you need to be there?</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-surface-500 block mb-1.5">Prefer to arrive (min before)</label>
            <input
              type="number"
              min="0"
              value={preferred}
              onChange={e => set('preferredBufferMins', Number(e.target.value))}
              className="w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-surface-500 block mb-1.5">Latest safe arrival (min before)</label>
            <input
              type="number"
              min="0"
              value={minimum}
              onChange={e => set('minimumBufferMins', Number(e.target.value))}
              className="w-full bg-surface-700 border border-surface-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {depTime && (
          <div className="border-t border-surface-600/50 pt-3 space-y-2">
            {recArrival && (
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Recommended arrival</span>
                <span className="font-mono text-status-ok">{recArrival}</span>
              </div>
            )}
            {latestArrival && (
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Latest safe arrival</span>
                <span className="font-mono text-status-tight">{latestArrival}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-surface-500">Departure</span>
              <span className="font-mono text-white">{depTime}</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function NormalStopFields({ form, set }) {
  return (
    <>
      <FormField label="When do you want to arrive? (optional)">
        <input
          type="time"
          value={form.plannedArrival || ''}
          onChange={e => set('plannedArrival', e.target.value)}
          className={inputCls}
        />
      </FormField>
      <FormField label="How long will you stay? (minutes)">
        <input
          type="number"
          min="0"
          max="480"
          value={form.plannedDuration ?? 30}
          onChange={e => set('plannedDuration', Number(e.target.value))}
          className={inputCls}
        />
      </FormField>
    </>
  )
}

function OpeningHoursFields({ form, set }) {
  const minDur = form.minimumDuration ?? 30
  const closesAt = form.closesAt
  const latestArrival = closesAt ? subtractMins(closesAt, minDur) : null

  return (
    <>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Opens at">
            <input type="time" value={form.opensAt || ''} onChange={e => set('opensAt', e.target.value)} className={inputCls} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Closes at">
            <input type="time" value={form.closesAt || ''} onChange={e => set('closesAt', e.target.value)} className={inputCls} />
          </FormField>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <FormField label="Desired visit (min)">
            <input type="number" min="0" value={form.desiredDuration ?? 60}
              onChange={e => set('desiredDuration', Number(e.target.value))} className={inputCls} />
          </FormField>
        </div>
        <div className="flex-1">
          <FormField label="Minimum useful visit (min)">
            <input type="number" min="0" value={form.minimumDuration ?? 30}
              onChange={e => set('minimumDuration', Number(e.target.value))} className={inputCls} />
          </FormField>
        </div>
      </div>
      {latestArrival && (
        <div className="bg-surface-700/50 rounded-xl px-4 py-3 flex justify-between text-sm">
          <span className="text-surface-500">Latest useful arrival</span>
          <span className="font-mono text-status-tight">{latestArrival}</span>
        </div>
      )}
    </>
  )
}

function AppointmentFields({ form, set }) {
  const buffer = form.arrivalBuffer ?? 15
  const apptTime = form.appointmentTime
  const latestArrival = apptTime ? subtractMins(apptTime, buffer) : null

  return (
    <>
      <FormField label="Appointment time">
        <input
          type="time"
          value={form.appointmentTime || ''}
          onChange={e => set('appointmentTime', e.target.value)}
          className={inputCls}
        />
      </FormField>

      <FormField label="Arrive how many minutes early?">
        <input
          type="number"
          min="0"
          value={buffer}
          onChange={e => set('arrivalBuffer', Number(e.target.value))}
          className={inputCls}
        />
      </FormField>

      {latestArrival && (
        <div className="bg-surface-700/50 rounded-xl px-4 py-3 flex justify-between text-sm">
          <span className="text-surface-500">You should arrive by</span>
          <span className="font-mono text-status-tight">{latestArrival}</span>
        </div>
      )}

      <FormField label="How long will it last? (minutes)">
        <input
          type="number"
          min="0"
          value={form.duration ?? 60}
          onChange={e => set('duration', Number(e.target.value))}
          className={inputCls}
        />
      </FormField>
    </>
  )
}

function StartEndFields({ form, set, isStart }) {
  return (
    <>
      <FormField label={isStart ? 'Start location' : 'Destination'}>
        <input
          type="text"
          placeholder={isStart ? 'e.g. Home, city center' : 'e.g. Hotel, destination city'}
          value={form.address || ''}
          onChange={e => set('address', e.target.value)}
          className={inputCls}
        />
      </FormField>
      {isStart ? (
        <FormField label="Planned departure time">
          <input type="time" value={form.plannedDeparture || ''}
            onChange={e => set('plannedDeparture', e.target.value)} className={inputCls} />
        </FormField>
      ) : (
        <FormField label="Target arrival time (optional)">
          <input type="time" value={form.plannedArrival || ''}
            onChange={e => set('plannedArrival', e.target.value)} className={inputCls} />
        </FormField>
      )}
    </>
  )
}

// ============================================================
// Incoming travel leg — "How long from [prev] to here?"
// Maps estimation is primary; manual entry is the fallback.
// ============================================================

const TRAVEL_MODE_OPTIONS = [
  { value: null,                emoji: '?',  label: 'Unknown' },
  { value: TRAVEL_MODE.WALKING, emoji: '🚶', label: 'Walk'    },
  { value: TRAVEL_MODE.DRIVING, emoji: '🚗', label: 'Drive'   },
  { value: TRAVEL_MODE.CYCLING, emoji: '🚲', label: 'Cycle'   },
  { value: TRAVEL_MODE.TRANSIT, emoji: '🚌', label: 'Transit' },
]

function TravelLegFields({
  fromStopName, fromAddress, destAddress,
  incomingTime, incomingMode,
  onTimeChange, onModeChange,
  legId, onEstimate,
}) {
  const canEstimate    = fromAddress.trim().length > 0 && destAddress.trim().length > 0
  const missingAddress = !destAddress.trim()

  const modeWord = {
    [TRAVEL_MODE.DRIVING]: 'drive',
    [TRAVEL_MODE.WALKING]: 'walk',
    [TRAVEL_MODE.CYCLING]: 'cycle',
    [TRAVEL_MODE.TRANSIT]: 'transit time',
  }[incomingMode] || 'travel time'

  return (
    <div className="space-y-3 pt-1">
      {/* Section header with missing-state indicator */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-surface-500 uppercase tracking-wider">
          Getting here from {fromStopName}
        </label>
        {incomingTime == null && (
          <span className="text-xs text-status-at_risk font-medium">ETA unknown</span>
        )}
        {incomingTime != null && (
          <span className="text-xs text-status-ok font-medium">{incomingTime} min</span>
        )}
      </div>

      {/* Travel mode picker */}
      <div className="flex gap-1.5">
        {TRAVEL_MODE_OPTIONS.map(m => (
          <button
            key={m.label}
            type="button"
            onClick={() => onModeChange(m.value)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
              incomingMode === m.value
                ? 'border-accent bg-accent/10 text-white'
                : 'border-surface-600 bg-surface-700 text-surface-400'
            }`}
          >
            <span className="text-base leading-none">{m.emoji}</span>
            <span className="text-[10px]">{m.label}</span>
          </button>
        ))}
      </div>

      {/* Maps estimate — primary CTA */}
      <MapsEstimateButton
        legId={legId}
        fromAddress={fromAddress}
        destAddress={destAddress}
        travelMode={incomingMode}
        onEstimate={onEstimate}
        onTimeUpdate={onTimeChange}
      />

      {/* Address hint when Maps can't run */}
      {missingAddress && (
        <p className="text-xs text-surface-500 text-center -mt-1">
          Add an address above to enable Maps estimates
        </p>
      )}

      {/* Manual entry — secondary fallback */}
      <div>
        <label className="text-xs text-surface-400 mb-1.5 block">
          Or enter {modeWord} manually (minutes)
        </label>
        <input
          type="number"
          min="0"
          placeholder="e.g. 75"
          value={incomingTime ?? ''}
          onChange={e => onTimeChange(e.target.value !== '' ? Number(e.target.value) : null)}
          className={inputCls}
        />
      </div>

      {/* Missing-state explanation */}
      {incomingTime == null && (
        <p className="text-xs text-surface-500">
          Without a travel time the app can't estimate when you'll arrive here — ETAs for this stop will show as unknown.
        </p>
      )}
    </div>
  )
}

// ============================================================
// Maps estimate button — calls /api/travel-time on tap
// ============================================================

function MapsEstimateButton({ legId, fromAddress, destAddress, travelMode, onEstimate, onTimeUpdate }) {
  const updateLeg                 = useSessionStore(s => s.updateLeg)
  const [status, setStatus]       = useState('idle')  // 'idle' | 'loading' | 'error'
  const [errorMsg, setErrorMsg]   = useState('')
  const [result, setResult]       = useState(null)

  const canEstimate = fromAddress.trim().length > 0 && destAddress.trim().length > 0

  const handleEstimate = async () => {
    if (!canEstimate || status === 'loading') return
    setStatus('loading')
    setErrorMsg('')
    setResult(null)

    try {
      const res = await fetch('/api/travel-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originAddress: fromAddress,
          destAddress,
          travelMode: travelMode || 'driving',
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setErrorMsg(data.message || 'Could not get estimate from Maps')
        setStatus('error')
        return
      }

      // Write to legData immediately so the live timeline reacts while the form is still open
      if (legId) {
        const legUpdate = { travelTimeMinutes: data.travelTimeMinutes, source: 'google' }
        if (data.distanceKm != null) legUpdate.distanceText = `${data.distanceKm} km`
        updateLeg(legId, legUpdate)
      }

      // Update the form's displayed incoming time
      onTimeUpdate?.(data.travelTimeMinutes)

      // Bubble up full result to CheckpointEditor (handles pending-estimate for new checkpoints)
      onEstimate?.({ travelTimeMinutes: data.travelTimeMinutes, distanceKm: data.distanceKm })

      setResult({ minutes: data.travelTimeMinutes, distanceKm: data.distanceKm })
      setStatus('idle')
    } catch {
      setErrorMsg('Network error — check your connection')
      setStatus('error')
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleEstimate}
        disabled={!canEstimate || status === 'loading'}
        className="w-full flex items-center justify-center gap-2 text-sm font-medium border border-surface-600 bg-surface-700 hover:bg-surface-600 hover:border-accent/60 rounded-xl px-4 py-3 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <MapPin size={14} className={status === 'loading' ? 'animate-pulse text-accent' : 'text-accent'} />
        {status === 'loading' ? 'Estimating…' : 'Get travel time from Maps'}
      </button>

      {status === 'error' && (
        <p className="text-xs text-status-at_risk text-center">{errorMsg}</p>
      )}

      {result && status === 'idle' && (
        <div className="flex items-center justify-between bg-status-ok/10 border border-status-ok/20 rounded-xl px-3 py-2">
          <span className="text-xs text-status-ok font-medium">
            ✓ {result.minutes} min{result.distanceKm != null ? ` · ${result.distanceKm} km` : ''}
          </span>
          <span className="text-xs text-surface-500">
            {legId ? 'applied' : 'will apply on save'}
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Shared helpers
// ============================================================

function FormField({ label, children }) {
  return (
    <div>
      <label className="text-xs text-surface-500 uppercase tracking-wider mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-surface-700 border border-surface-600 rounded-xl px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:border-accent text-sm'

function subtractMins(timeStr, mins) {
  if (!timeStr || !mins) return null
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m - mins
  if (total < 0) return null
  const rh = Math.floor(total / 60)
  const rm = total % 60
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}`
}

function namePlaceholder(kind, departureMode) {
  if (kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE) {
    const pls = {
      ferry:  'e.g. Gothenburg Ferry Terminal',
      train:  'e.g. Stockholm Central Station',
      flight: 'e.g. Arlanda Airport',
      bus:    'e.g. Bus terminal',
    }
    return pls[departureMode] || 'e.g. Terminal or station name'
  }
  const pls = {
    [CHECKPOINT_KIND.NORMAL_STOP]:       'e.g. Old Town, coffee stop',
    [CHECKPOINT_KIND.FUEL_STOP]:         'e.g. Statoil, motorway stop',
    [CHECKPOINT_KIND.OPENING_HOURS]:     'e.g. Vasa Museum',
    [CHECKPOINT_KIND.FIXED_APPOINTMENT]: 'e.g. Restaurant Frantzén',
    [CHECKPOINT_KIND.START]:             'e.g. Home',
    [CHECKPOINT_KIND.END]:               'e.g. Hotel Lindström',
  }
  return pls[kind] || 'Stop name'
}
