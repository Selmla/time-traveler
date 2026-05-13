import React, { useState, useEffect } from 'react'
import { Navigation, MapPin, Clock, AlertTriangle, CheckCircle, Play, ChevronRight, Zap, SkipForward, RotateCcw, StopCircle, Sun, Eye, ArrowRight, X } from 'lucide-react'
import { useActiveTimeline, useTimeline } from '../hooks/useTimeline.js'
import { useDepartConfirm } from '../hooks/useDepartConfirm.js'
import { useSessionStore, useTripStore, useUIStore } from '../stores/index.js'
import { formatTime, formatBuffer, formatDuration, formatDate } from '../utils/time.js'
import { openNavigation } from '../utils/maps.js'
import { STATUS, makeLegId } from '../engine/models.js'
import { getProfile, profileCopy } from '../utils/tripProfile.js'
import { renderWarning, renderConsequence } from '../utils/warningCopy.js'
import {
  Card, StatusBadge, StatusDot, Button, TimeBig, BufferMeter,
  AlertBanner, CheckpointTypeIcon, EmptyState
} from '../components/ui/index.jsx'
import WhatIfPanel from '../components/whatif/WhatIfPanel.jsx'
import TimelineView from '../components/timeline/TimelineView.jsx'
import GlanceMode from '../components/glance/GlanceMode.jsx'

// ============================================================
// NOW SCREEN — The main dashboard during an active trip
// ============================================================

// Session age thresholds for restore/expiration policy (contract §9.4)
const SESSION_STALE_MS  = 24 * 60 * 60 * 1000  // 24h  → show restore banner
const SESSION_EXPIRE_MS = 72 * 60 * 60 * 1000  // 72h  → auto-expire

function getSessionAge(startedAt) {
  if (!startedAt) return 'fresh'
  const age = Date.now() - startedAt
  if (age >= SESSION_EXPIRE_MS) return 'expired'
  if (age >= SESSION_STALE_MS)  return 'stale'
  return 'fresh'
}

export default function NowScreen() {
  const isRunning    = useSessionStore(s => s.isRunning)
  const activeTripId = useSessionStore(s => s.activeTripId)
  const startedAt    = useSessionStore(s => s.startedAt)
  const endTrip      = useSessionStore(s => s.endTrip)
  const trips        = useTripStore(s => s.trips)
  const setTab       = useUIStore(s => s.setTab)

  // Local state: banner dismissed means user chose to continue this specific stale session.
  // NowScreen is always mounted (never hidden via unmount — see App.jsx), so we reset
  // explicitly when the session changes (new trip started or session ended).
  const [staleBannerDismissed,  setStaleBannerDismissed]  = useState(false)
  const [sessionExpiredNotice,  setSessionExpiredNotice]  = useState(false)

  // Reset dismiss state whenever the session identity changes so a new stale session
  // always shows the banner even if the previous one was dismissed in the same app lifecycle.
  useEffect(() => {
    setStaleBannerDismissed(false)
  }, [activeTripId, startedAt])

  const sessionAge = (isRunning && activeTripId) ? getSessionAge(startedAt) : null

  // Auto-expire sessions older than 72h. Called on every render where the condition
  // holds — but since endTrip() sets isRunning=false, this only fires once.
  useEffect(() => {
    if (sessionAge === 'expired') {
      endTrip()
      setSessionExpiredNotice(true)
    }
  }, [sessionAge, endTrip])

  // Stale session: show confirmation banner before resuming.
  if (isRunning && activeTripId && sessionAge === 'stale' && !staleBannerDismissed) {
    return (
      <StaleSessionBanner
        tripId={activeTripId}
        startedAt={startedAt}
        trips={trips}
        onContinue={() => setStaleBannerDismissed(true)}
        onEnd={endTrip}
      />
    )
  }

  // Active session (fresh or banner dismissed): hand off to dashboard.
  // Guard against the one render where sessionAge='expired' but endTrip hasn't fired yet.
  if (isRunning && activeTripId && sessionAge !== 'expired') {
    return <ActiveDashboard tripId={activeTripId} />
  }

  if (trips.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6">
        {sessionExpiredNotice && (
          <SessionExpiredNotice onDismiss={() => setSessionExpiredNotice(false)} />
        )}
        <EmptyState
          icon={Navigation}
          title="No trips yet"
          description="Create a trip to start tracking your timeline."
          action={<Button onClick={() => setTab('trips')}>Create your first trip</Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full px-4 pt-6">
      {sessionExpiredNotice && (
        <SessionExpiredNotice onDismiss={() => setSessionExpiredNotice(false)} />
      )}
      <h2 className="text-xl font-bold text-white mb-2">No active trip</h2>
      <p className="text-surface-500 text-sm mb-6">Pick a trip to start tracking.</p>
      <div className="space-y-3">
        {trips.map(trip => (
          <TripStartCard key={trip.id} trip={trip} />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// STALE SESSION BANNER
// Shown when a persisted session is 24–72h old.
// User must confirm before resuming or ending the trip.
// ============================================================

function StaleSessionBanner({ tripId, startedAt, trips, onContinue, onEnd }) {
  const trip = trips.find(t => t.id === tripId)
  const hoursAgo = Math.round((Date.now() - startedAt) / (60 * 60 * 1000))
  const timeLabel = hoursAgo < 48
    ? `${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`
    : `${Math.round(hoursAgo / 24)} days ago`

  return (
    <div className="flex flex-col h-full px-4 pt-6">
      <div className="bg-surface-700 border border-surface-600/50 rounded-2xl px-5 py-5">
        <p className="text-xs text-surface-500 uppercase tracking-wider mb-2">Trip in progress</p>
        <h2 className="text-white font-semibold text-lg mb-1">
          {trip?.title ?? 'Unnamed trip'}
        </h2>
        <p className="text-surface-400 text-sm mb-5">
          Started {timeLabel}. Continue where you left off?
        </p>
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={onContinue}>
            Continue trip
          </Button>
          <Button variant="ghost" onClick={onEnd}>
            End trip
          </Button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SESSION EXPIRED NOTICE
// Brief dismissible notice after a 72h+ session is auto-cleared.
// ============================================================

function SessionExpiredNotice({ onDismiss }) {
  return (
    <div className="flex items-start justify-between bg-surface-800/80 border border-surface-700 rounded-xl px-4 py-3 mb-4 w-full">
      <p className="text-surface-400 text-sm">
        Previous trip session ended — started over 72 hours ago.
      </p>
      <button
        onClick={onDismiss}
        className="text-surface-500 hover:text-white ml-3 flex-shrink-0 p-0.5"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function getStatusMessage(status, buffer, isRunningLate = false, copy = {}) {
  const deadlineAtRisk = copy.deadlineAtRisk  ?? 'Deadline at risk'
  const deadlineMissed = copy.deadlineMissed  ?? 'Deadline missed'
  const gettingTight   = copy.gettingTight    ?? 'Getting tight'
  const bufferLow      = copy.bufferLow       ?? 'Buffer running low'
  const cuttingItClose = copy.cuttingItClose  ?? 'Cutting it close'

  if (status === STATUS.OK) {
    if (buffer !== null && buffer < 0) return deadlineAtRisk
    if (isRunningLate) return 'Running late'
    return 'On track'
  }
  if (status === STATUS.COMPLETED) return 'Trip complete'
  if (status === STATUS.MISSED)    return deadlineMissed
  if (status === STATUS.TIGHT)     return buffer !== null && buffer < 10 ? bufferLow : gettingTight
  if (status === STATUS.AT_RISK)   return buffer !== null && buffer < 0  ? deadlineAtRisk : cuttingItClose
  return 'On track'
}

// ============================================================
// ACTIVE DASHBOARD
// ============================================================

function ActiveDashboard({ tripId }) {
  const { trip, timeline, whatIfTimeline, now } = useTimeline(tripId)
  const [view, setView]       = useState('dashboard')
  const [confirmEnd, setConfirmEnd] = useState(false)

  const glanceModeActive = useUIStore(s => s.glanceModeActive)
  const toggleGlanceMode = useUIStore(s => s.toggleGlanceMode)

  const whatIfActive   = useSessionStore(s => s.whatIfActive)
  const openWhatIf     = useSessionStore(s => s.openWhatIf)
  const endTrip        = useSessionStore(s => s.endTrip)
  const markArrived    = useSessionStore(s => s.markArrived)
  const markDeparted   = useSessionStore(s => s.markDeparted)
  const markSkipped    = useSessionStore(s => s.markSkipped)
  const addDelay       = useSessionStore(s => s.addDelay)
  const undoLastAction = useSessionStore(s => s.undoLastAction)

  const [screenAwake, setScreenAwake] = useState(false)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return
    let lock = null
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        setScreenAwake(true)
        lock.addEventListener('release', () => setScreenAwake(false))
      } catch (_) {}
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') acquire() }
    acquire()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      lock?.release()
    }
  }, [])

  // Safety net: trip was deleted while session was still running
  if (!trip) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 gap-4">
        <p className="text-white font-semibold text-center">Trip data not found.</p>
        <p className="text-surface-500 text-sm text-center">The trip was deleted while the session was running.</p>
        <button
          onClick={endTrip}
          className="flex items-center gap-1.5 text-sm font-medium text-status-at_risk hover:text-white bg-status-at_risk/10 hover:bg-status-at_risk/20 border border-status-at_risk/30 px-4 py-2 rounded-xl transition-colors"
        >
          <StopCircle size={15} />
          Clear session
        </button>
      </div>
    )
  }

  if (!timeline) return null

  const next         = timeline.nextStop
  const nextCritical = timeline.nextCritical
  const status       = timeline.tripStatus
  const alert        = timeline.mostUrgentAlert
  const totalBuffer  = timeline.totalBufferMins

  // Detect when ETA data is absent: engine returned OK only because there's nothing
  // to be late for yet — not because we're genuinely on schedule.
  const hasUncertainETA = timeline.entries.some(
    e => e.etaUncertain && e.status !== STATUS.COMPLETED && e.status !== STATUS.SKIPPED
  )
  const showUncertain = hasUncertainETA && status === STATUS.OK

  const isRunningLate = !showUncertain && status === STATUS.OK
    && timeline.entries.some(e =>
        e.delay > 0 &&
        e.status !== STATUS.COMPLETED &&
        e.status !== STATUS.SKIPPED
      )

  const copy = profileCopy(getProfile(trip))

  const statusColors = {
    ok:        'text-status-ok',
    tight:     'text-status-tight',
    at_risk:   'text-status-at_risk',
    missed:    'text-status-missed',
    completed: 'text-status-completed',
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-start justify-between">
        <div>
          <p className="text-xs text-surface-500 uppercase tracking-wider mb-0.5">
            {formatDate(trip.date)}
          </p>
          <h1 className="text-xl font-bold text-white leading-tight">{trip.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {screenAwake && (
            <Sun size={13} className="text-status-tight" title="Screen kept awake" />
          )}
          <button
            onClick={toggleGlanceMode}
            className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white px-2 py-1.5 rounded-lg bg-surface-700 border border-surface-600/50 transition-colors"
            title="Glance Mode — riding view"
          >
            <Eye size={13} />
            Glance
          </button>
          <button
            onClick={undoLastAction}
            className="text-xs text-surface-500 hover:text-white px-2 py-1.5 rounded-lg bg-surface-700 border border-surface-600/50"
            title="Undo last action"
          >
            <RotateCcw size={13} />
          </button>
          {confirmEnd ? (
            <>
              <button
                onClick={() => setConfirmEnd(false)}
                className="text-xs text-surface-500 hover:text-white px-3 py-1.5 rounded-lg bg-surface-700 border border-surface-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={endTrip}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-status-at_risk hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors"
              >
                <StopCircle size={13} />
                Confirm end
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmEnd(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-status-at_risk hover:text-white bg-status-at_risk/10 hover:bg-status-at_risk/20 border border-status-at_risk/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <StopCircle size={13} />
              End trip
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 mb-4">
        <Card className="px-4 py-3 flex items-center gap-3">
          <StatusDot status={showUncertain ? 'pending' : isRunningLate ? 'tight' : status} pulse={status === 'at_risk'} />
          <span className={`font-semibold text-sm ${showUncertain ? 'text-surface-400' : isRunningLate ? 'text-status-tight' : (statusColors[status] || 'text-white')}`}>
            {showUncertain ? 'Add travel times to see your ETA' : getStatusMessage(status, totalBuffer, isRunningLate, copy)}
          </span>
          {!showUncertain && totalBuffer !== null && (
            <BufferMeter bufferMinutes={totalBuffer} minBuffer={trip.minBuffer} className="ml-auto" />
          )}
        </Card>
      </div>

      {/* Alert banner */}
      {alert && (() => {
        const alertText = renderWarning(alert.warning, getProfile(trip))
        return alertText ? (
          <div className="px-4 mb-3">
            <AlertBanner
              message={`${alert.entry.checkpointName}: ${alertText}`}
              status={alert.entry.status}
            />
          </div>
        ) : null
      })()}

      {/* Tab switcher */}
      <div className="px-4 mb-4">
        <div className="flex gap-1 bg-surface-700 rounded-xl p-1">
          <button
            className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${view === 'dashboard' ? 'bg-surface-600 text-white' : 'text-surface-500'}`}
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${view === 'timeline' ? 'bg-surface-600 text-white' : 'text-surface-500'}`}
            onClick={() => setView('timeline')}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {view === 'dashboard' ? (
          <DashboardView
            trip={trip}
            timeline={timeline}
            next={next}
            nextCritical={nextCritical}
            now={now}
            profile={getProfile(trip)}
            onMarkArrived={markArrived}
            onMarkDeparted={markDeparted}
            onMarkSkipped={markSkipped}
            onAddDelay={addDelay}
            onOpenWhatIf={openWhatIf}
          />
        ) : (
          <TimelineView
            trip={trip}
            timeline={timeline}
            interactive
            onMarkArrived={markArrived}
            onMarkDeparted={markDeparted}
          />
        )}
      </div>

      {whatIfActive && <WhatIfPanel trip={trip} timeline={timeline} whatIfTimeline={whatIfTimeline} />}

      {glanceModeActive && (
        <GlanceMode
          trip={trip}
          timeline={timeline}
          now={now}
          onClose={toggleGlanceMode}
          onMarkArrived={markArrived}
          onMarkDeparted={markDeparted}
        />
      )}
    </div>
  )
}

// ============================================================
// DASHBOARD VIEW
// ============================================================

function DashboardView({ trip, timeline, next, nextCritical, now, profile, onMarkArrived, onMarkDeparted, onMarkSkipped, onAddDelay, onOpenWhatIf }) {
  const allDone = timeline.entries.every(
    e => e.status === STATUS.COMPLETED || e.status === STATUS.SKIPPED
  )

  if (allDone) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">🎉</p>
        <p className="text-status-ok font-bold text-lg">All stops complete!</p>
        <p className="text-surface-500 text-sm mt-1">Trip finished.</p>
      </div>
    )
  }

  if (!next) return null

  const cp = trip.checkpoints.find(c => c.id === next.checkpointId)

  // Show nextCritical separately only when it's a different stop from next
  const showNextCritical = nextCritical && nextCritical.checkpointId !== next.checkpointId

  return (
    <div className="space-y-4">
      {/* Current leg context — shown while traveling, hidden when arrived at a stop */}
      {timeline.currentLeg && (
        <LegContextCard leg={timeline.currentLeg} trip={trip} consequence={timeline.consequence} />
      )}

      <div>
        <p className="text-xs text-surface-500 uppercase tracking-wider mb-2">
          {next.status === STATUS.ARRIVED ? 'Currently at' : 'Next stop'}
        </p>
        <NextCheckpointCard
          entry={next}
          checkpoint={cp}
          now={now}
          profile={profile}
          consequence={timeline.consequence}
          onMarkArrived={onMarkArrived}
          onMarkDeparted={onMarkDeparted}
          onMarkSkipped={onMarkSkipped}
          onAddDelay={onAddDelay}
          onOpenWhatIf={onOpenWhatIf}
        />
      </div>

      {/* Next critical deadline — only when it's ahead of next stop */}
      {showNextCritical && (
        <NextCriticalCard entry={nextCritical} trip={trip} />
      )}

      {/* Upcoming list */}
      <div>
        <p className="text-xs text-surface-500 uppercase tracking-wider mb-2">Coming up</p>
        <div className="space-y-2">
          {timeline.entries
            .filter(e =>
              e.checkpointId !== next.checkpointId &&
              !(showNextCritical && e.checkpointId === nextCritical.checkpointId) &&
              e.status !== STATUS.COMPLETED &&
              e.status !== STATUS.SKIPPED
            )
            .slice(0, 4)
            .map(entry => (
              <UpcomingRow key={entry.checkpointId} entry={entry} trip={trip} />
            ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// NEXT CHECKPOINT CARD — Kind-aware, state-aware
// ============================================================

function NextCheckpointCard({ entry, checkpoint: cp, now, profile, consequence, onMarkArrived, onMarkDeparted, onMarkSkipped, onAddDelay, onOpenWhatIf }) {
  const kind      = entry.kind
  const eta       = entry.etaUncertain ? '?' : entry.estimatedArrival ? formatTime(entry.estimatedArrival) : '--:--'
  const isArrived = entry.status === STATUS.ARRIVED

  const { pending: departPending, requestDepart: onDepartTap, confirm: onDepartConfirm, cancel: onDepartCancel } =
    useDepartConfirm(() => onMarkDeparted(entry.checkpointId))

  return (
    <Card className="p-4">
      {/* Title row */}
      <div className="flex items-start gap-3 mb-4">
        <CheckpointTypeIcon kind={kind} departureMode={cp?.departureMode} className="mt-0.5" />
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-lg leading-tight">{entry.checkpointName}</h2>
          {cp?.address && (
            <p className="text-surface-500 text-sm truncate mt-0.5">{cp.address}</p>
          )}
        </div>
        <StatusDot status={entry.status} pulse={entry.status === 'at_risk' || entry.status === 'arrived'} />
      </div>

      {/* Notes */}
      {cp?.notes && (
        <p className="text-xs text-surface-400 italic mb-3">{cp.notes}</p>
      )}

      {/* Unknown ETA notice */}
      {!isArrived && entry.etaUncertain && (
        <div className="flex items-start gap-2 text-surface-400 text-xs mb-3">
          <Clock size={12} className="mt-0.5 flex-shrink-0" />
          <span>Travel time not set — tap 'Add travel time' above to calculate your ETA</span>
        </div>
      )}

      {/* Stop timer — shown when arrived but not departed */}
      {isArrived && (
        <StopTimer
          entry={entry}
          checkpoint={cp}
          consequence={consequence}
          profile={profile}
          onAddDelay={onAddDelay}
          onMarkDeparted={onMarkDeparted}
        />
      )}

      {/* Kind-specific timing block — only for upcoming */}
      {!isArrived && (
        kind === 'departure_deadline' ? (
          <DepartureTimingBlock entry={entry} checkpoint={cp} />
        ) : kind === 'opening_hours' ? (
          <OpeningHoursTimingBlock entry={entry} checkpoint={cp} eta={eta} />
        ) : kind === 'fixed_appointment' ? (
          <AppointmentTimingBlock entry={entry} checkpoint={cp} eta={eta} />
        ) : (
          <NormalTimingBlock entry={entry} eta={eta} />
        )
      )}

      {/* Warnings — rendered through the profile-aware presenter */}
      {entry.warnings?.length > 0 && (() => {
        const texts = entry.warnings.map(w => renderWarning(w, profile)).filter(Boolean)
        return texts.length > 0 ? (
          <div className="mt-3 mb-3 space-y-1">
            {texts.map((text, i) => (
              <div key={i} className="flex items-start gap-2 text-status-tight text-xs">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        ) : null
      })()}

      {/* Action buttons — state-aware */}
      <div className="flex gap-2 mt-4 flex-wrap">
        {cp?.address && (
          <Button variant="secondary" size="sm" onClick={() => openNavigation(cp)}>
            <Navigation size={14} />
            Navigate
          </Button>
        )}

        {isArrived ? (
          // Arrived state: depart (with inline confirm), add time, skip
          <>
            {departPending ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-surface-400">Depart?</span>
                <Button variant="ghost" size="sm" onClick={onDepartCancel}>Wait</Button>
                <Button variant="success" size="sm" onClick={onDepartConfirm}>Depart</Button>
              </div>
            ) : (
              <Button variant="success" size="sm" onClick={onDepartTap}>
                <CheckCircle size={14} />
                Depart now
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onAddDelay(entry.checkpointId, 5)}>
              <Zap size={14} />
              +5 min
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onAddDelay(entry.checkpointId, 15)}>
              <Zap size={14} />
              +15 min
            </Button>
            {entry.isSkippable && (
              <Button variant="danger" size="sm" onClick={() => onMarkSkipped(entry.checkpointId)}>
                <SkipForward size={14} />
                Skip
              </Button>
            )}
          </>
        ) : (
          // Upcoming state: mark arrived, simulate delays, skip
          <>
            <Button variant="success" size="sm" onClick={() => onMarkArrived(entry.checkpointId)}>
              <CheckCircle size={14} />
              Mark arrived
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenWhatIf(entry.checkpointId, 5)}>
              <Zap size={14} />
              What if +5m?
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenWhatIf(entry.checkpointId, 15)}>
              <Zap size={14} />
              What if +15m?
            </Button>
            {entry.isSkippable && (
              <Button variant="danger" size="sm" onClick={() => onMarkSkipped(entry.checkpointId)}>
                <SkipForward size={14} />
                Skip
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

// ============================================================
// STOP TIMER — shown when arrived but not yet departed
// ============================================================

function StopTimer({ entry, checkpoint: cp, consequence, profile, onAddDelay, onMarkDeparted }) {
  const [now, setNow] = useState(() => new Date())

  const isUrgent = entry.status === STATUS.AT_RISK || entry.status === STATUS.TIGHT

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), isUrgent ? 5000 : 30000)
    return () => clearInterval(id)
  }, [isUrgent])

  if (!entry.actualArrival) return null

  const minutesHere    = Math.max(0, Math.round((now - entry.actualArrival) / 60000))
  const plannedStay    = cp?.plannedDuration ?? cp?.desiredDuration ?? cp?.duration ?? null
  const staleThreshold = Math.max(plannedStay !== null ? plannedStay + 10 : 20, 20)
  const isStale        = minutesHere >= staleThreshold

  if (entry.kind === 'departure_deadline' && entry.deadlineTime) {
    const minsUntilDep = Math.round((entry.deadlineTime - now) / 60000)
    return (
      <div className="bg-surface-800 rounded-xl p-3 mb-4 space-y-1.5">
        <div className="flex justify-between">
          <span className="text-xs text-surface-500">You've been here</span>
          <span className="font-mono text-sm text-white">{minutesHere}m</span>
        </div>
        <div className="flex justify-between">
          <span className="text-xs text-surface-500">Until departure</span>
          <span className={`font-mono text-sm font-semibold ${minsUntilDep < 5 ? 'text-status-at_risk' : minsUntilDep < 15 ? 'text-status-tight' : 'text-status-ok'}`}>
            {minsUntilDep >= 0 ? `${minsUntilDep}m` : 'Departed!'}
          </span>
        </div>
        {isStale && onMarkDeparted && (
          <StalePrompt checkpointId={entry.checkpointId} onMarkDeparted={onMarkDeparted} onAddDelay={onAddDelay} />
        )}
        <ConsequenceBlock consequence={consequence} profile={profile} />
      </div>
    )
  }

  const remaining  = plannedStay !== null ? plannedStay - minutesHere : null
  const isOverTime = remaining !== null && remaining < 0
  const leaveBy    = entry.estimatedDeparture ? formatTime(entry.estimatedDeparture) : null

  return (
    <div className={`rounded-xl p-3 mb-4 space-y-1.5 ${isOverTime ? 'bg-status-at_risk/10 border border-status-at_risk/20' : 'bg-surface-800'}`}>
      <div className="flex justify-between">
        <span className="text-xs text-surface-500">You've been here</span>
        <span className="font-mono text-sm text-white">{minutesHere}m</span>
      </div>
      {plannedStay !== null && (
        <div className="flex justify-between">
          <span className="text-xs text-surface-500">Planned stop</span>
          <span className="font-mono text-sm text-surface-400">{plannedStay}m</span>
        </div>
      )}
      {remaining !== null && (
        <div className="flex justify-between">
          <span className={`text-xs ${isOverTime ? 'text-status-at_risk' : 'text-surface-500'}`}>
            {isOverTime ? 'Past plan' : 'Leave within'}
          </span>
          <span className={`font-mono text-sm font-semibold ${isOverTime ? 'text-status-at_risk' : remaining < 5 ? 'text-status-tight' : 'text-status-ok'}`}>
            {Math.abs(remaining)}m
          </span>
        </div>
      )}
      {leaveBy && !isOverTime && (
        <div className="flex justify-between">
          <span className="text-xs text-surface-500">Leave by</span>
          <span className="font-mono text-sm text-surface-300">{leaveBy}</span>
        </div>
      )}
      {isOverTime && (
        <p className="text-xs text-status-at_risk pt-0.5">
          Departing now recalculates all upcoming stops
        </p>
      )}
      {isStale && onMarkDeparted && (
        <StalePrompt checkpointId={entry.checkpointId} onMarkDeparted={onMarkDeparted} onAddDelay={onAddDelay} />
      )}
      <ConsequenceBlock consequence={consequence} profile={profile} />
    </div>
  )
}

function ConsequenceBlock({ consequence, profile }) {
  if (!consequence) return null
  const rendered = renderConsequence(consequence, profile)
  if (!rendered) return null
  const color = consequence.severity === 'ok'    ? 'text-status-ok'
    : consequence.severity === 'tight'           ? 'text-status-tight'
    : 'text-status-at_risk'
  return (
    <div className="border-t border-surface-700/50 pt-2.5 mt-1">
      <p className={`text-xs font-semibold ${color}`}>{rendered.headlineLine}</p>
      <p className="text-xs text-surface-500 mt-0.5">{rendered.contextLine}</p>
    </div>
  )
}

function StalePrompt({ checkpointId, onMarkDeparted, onAddDelay }) {
  const { pending, requestDepart, confirm, cancel } = useDepartConfirm(() => onMarkDeparted(checkpointId))

  return (
    <div className="border-t border-surface-700/50 pt-2.5 mt-1">
      <p className="text-xs text-surface-400 mb-2">Still at this stop?</p>
      <div className="flex gap-2">
        {pending ? (
          <>
            <span className="text-xs text-surface-400 self-center">Depart?</span>
            <button
              onClick={confirm}
              className="flex-1 text-xs font-semibold bg-status-ok text-surface-900 py-2 rounded-lg active:scale-95 transition-transform"
            >
              Depart
            </button>
            <button
              onClick={cancel}
              className="text-xs text-surface-400 bg-surface-700 px-3 py-2 rounded-lg active:scale-95 transition-transform"
            >
              Wait
            </button>
          </>
        ) : (
          <>
            <button
              onClick={requestDepart}
              className="flex-1 text-xs font-semibold bg-status-ok text-surface-900 py-2 rounded-lg active:scale-95 transition-transform"
            >
              Depart now
            </button>
            <button
              onClick={() => onAddDelay(checkpointId, 5)}
              className="text-xs text-surface-400 bg-surface-700 px-3 py-2 rounded-lg active:scale-95 transition-transform"
            >
              +5m
            </button>
            <button
              onClick={() => onAddDelay(checkpointId, 15)}
              className="text-xs text-surface-400 bg-surface-700 px-3 py-2 rounded-lg active:scale-95 transition-transform"
            >
              +15m
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// TIMING BLOCKS — kind-specific detail panels
// ============================================================

function DepartureTimingBlock({ entry, checkpoint: cp }) {
  const depTime   = entry.deadlineTime       ? formatTime(entry.deadlineTime)       : '--:--'
  const recArr    = entry.recommendedArrival ? formatTime(entry.recommendedArrival) : null
  const latestArr = entry.latestSafeArrival  ? formatTime(entry.latestSafeArrival)  : null
  const eta       = entry.estimatedArrival   ? formatTime(entry.estimatedArrival)   : '--:--'

  const buffer      = entry.bufferMinutes
  const bufferLabel = buffer === null ? null
    : buffer >= 0 ? `+${buffer}m to spare`
    : `${Math.abs(buffer)}m late`
  const bufferColor = buffer === null ? '' : buffer >= 0 ? 'text-status-ok' : 'text-status-at_risk'

  return (
    <div className="bg-surface-800 rounded-xl p-3 space-y-2 mb-1">
      <TimeRow label="Departure" value={depTime} valueClass="text-white font-bold" />
      {recArr    && <TimeRow label="Recommended arrival" value={recArr}    valueClass="text-status-ok" />}
      {latestArr && <TimeRow label="Latest safe arrival" value={latestArr} valueClass="text-status-tight" />}
      <div className="border-t border-surface-600/40 pt-2 flex justify-between items-center">
        <span className="text-xs text-surface-500">Your ETA</span>
        <div className="text-right">
          <span className="font-mono text-sm text-white">{eta}</span>
          {bufferLabel && (
            <span className={`font-mono text-xs ml-2 ${bufferColor}`}>{bufferLabel}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function OpeningHoursTimingBlock({ entry, checkpoint: cp, eta }) {
  const opens  = cp?.opensAt  || null
  const closes = cp?.closesAt || null
  const latest = entry.latestSafeArrival ? formatTime(entry.latestSafeArrival) : null
  const buffer = entry.bufferMinutes

  return (
    <div className="space-y-1 mb-1">
      <div className="flex items-end gap-6">
        <TimeBig label="Your ETA" time={eta} delta={entry.delay || null} />
        {latest && <TimeBig label="Arrive by" time={latest} />}
      </div>
      {opens && closes && (
        <p className="text-xs text-surface-500 mt-1">Open {opens}–{closes}</p>
      )}
      {buffer !== null && (
        <p className={`text-xs font-mono ${buffer >= 20 ? 'text-status-ok' : buffer >= 0 ? 'text-status-tight' : 'text-status-at_risk'}`}>
          {buffer >= 0 ? `${buffer}m before close cutoff` : `${Math.abs(buffer)}m past useful arrival`}
        </p>
      )}
    </div>
  )
}

function AppointmentTimingBlock({ entry, checkpoint: cp, eta }) {
  const apptTime = entry.deadlineTime ? formatTime(entry.deadlineTime) : null
  const latest   = entry.latestSafeArrival ? formatTime(entry.latestSafeArrival) : null
  const buffer   = entry.bufferMinutes

  return (
    <div className="space-y-1 mb-1">
      <div className="flex items-end gap-6">
        <TimeBig label="Your ETA" time={eta} delta={entry.delay || null} />
        {latest   && <TimeBig label="Arrive by" time={latest} />}
        {apptTime && <TimeBig label="Appointment" time={apptTime} />}
      </div>
      {buffer !== null && (
        <p className={`text-xs font-mono mt-1 ${buffer >= 0 ? 'text-status-ok' : 'text-status-at_risk'}`}>
          {buffer >= 0 ? `${buffer}m buffer before appointment` : `Running ${Math.abs(buffer)}m late`}
        </p>
      )}
    </div>
  )
}

function NormalTimingBlock({ entry, eta }) {
  const planned = entry.plannedArrival    ? formatTime(entry.plannedArrival)    : null
  const departs = entry.estimatedDeparture ? formatTime(entry.estimatedDeparture) : null
  const delta   = entry.delay || 0

  return (
    <div className="flex items-end gap-6 mb-1">
      <TimeBig label="ETA" time={eta} delta={delta !== 0 ? delta : null} />
      {planned && delta !== 0 && (
        <TimeBig label="Planned" time={planned} className="opacity-50" />
      )}
      {departs && (
        <TimeBig label="Depart" time={departs} />
      )}
    </div>
  )
}

function TimeRow({ label, value, valueClass = 'text-white' }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-surface-500">{label}</span>
      <span className={`font-mono text-sm ${valueClass}`}>{value}</span>
    </div>
  )
}

// ============================================================
// LEG CONTEXT CARD — detailed leg info while traveling
// ============================================================

const LEG_MODE_OPTIONS = [
  { value: null,       emoji: '?',  label: 'Unknown' },
  { value: 'walking',  emoji: '🚶', label: 'Walk'    },
  { value: 'driving',  emoji: '🚗', label: 'Drive'   },
  { value: 'cycling',  emoji: '🚲', label: 'Cycle'   },
  { value: 'transit',  emoji: '🚌', label: 'Transit' },
]

function travelTimeLabelFor(mode) {
  if (mode === 'walking') return 'Walk time'
  if (mode === 'driving') return 'Drive time'
  if (mode === 'cycling') return 'Cycle time'
  if (mode === 'transit') return 'Transit time'
  return 'Travel time'
}

function LegContextCard({ leg, trip, consequence }) {
  const {
    fromId, toId, fromName, toName,
    departureTime, estimatedArrival,
    travelTimeMinutes, travelTimeSource,
    travelMode,
    etaUncertain,
  } = leg

  const updateLeg        = useSessionStore(s => s.updateLeg)
  const updateTrip       = useTripStore(s => s.updateTrip)
  const updateCheckpoint = useTripStore(s => s.updateCheckpoint)

  const [editingTime, setEditingTime] = useState(false)
  const [timeValue,   setTimeValue]   = useState(15)
  const [modeValue,   setModeValue]   = useState(travelMode ?? null)

  const legId     = makeLegId(fromId, toId)
  const depStr    = departureTime ? formatTime(departureTime) : '--:--'
  const travelStr = travelTimeMinutes !== null ? `${travelTimeMinutes}m` : null

  const sourceLabel = { manual: 'You set this', maps: 'Live traffic' }[travelTimeSource] ?? null

  // Pre-fill with the currently persisted value so the user edits rather than re-types
  const persistedTime = fromId === 'origin'
    ? (trip?.origin?.travelTimeToFirst ?? '')
    : (trip?.checkpoints.find(c => c.id === fromId)?.travelTimeToNext ?? '')

  const handleSave = () => {
    if (timeValue >= 0) {
      if (fromId === 'origin') {
        updateTrip(trip.id, { origin: { ...trip.origin, travelTimeToFirst: timeValue, travelModeToFirst: modeValue } })
      } else {
        updateCheckpoint(trip.id, fromId, { travelTimeToNext: timeValue, travelModeToNext: modeValue })
      }
      updateLeg(legId, { travelTimeMinutes: timeValue, source: 'manual', mode: modeValue })
    }
    setEditingTime(false)
  }

  return (
    <Card className="px-4 py-3 space-y-3">
      {/* From → To */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-surface-400 truncate max-w-[40%]">{fromName}</span>
        <ArrowRight size={12} className="text-surface-600 flex-shrink-0" />
        <span className="text-sm text-white font-medium truncate flex-1">{toName}</span>
        <span className="text-[10px] text-surface-600 bg-surface-700 px-2 py-0.5 rounded-full flex-shrink-0">
          En route
        </span>
      </div>

      {/* Stats row — departure time and travel time for this leg */}
      <div className="flex gap-4 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-surface-500">Departed</span>
          <span className="font-mono text-surface-300">{depStr}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-surface-500">{travelTimeLabelFor(travelMode)}</span>
          <span className={`font-mono ${travelStr ? 'text-surface-300' : 'text-surface-600'}`}>
            {travelStr || '—?'}
          </span>
        </div>
        {sourceLabel && (
          <div className="flex justify-between gap-2 ml-auto">
            <span className={`font-mono text-[10px] ${travelTimeSource === 'maps' ? 'text-accent' : 'text-surface-600'}`}>
              {sourceLabel}
            </span>
          </div>
        )}
      </div>

      {/* Unknown ETA — prompt to add manual travel time */}
      {etaUncertain && !editingTime && (
        <div className="flex items-center justify-between border-t border-surface-700/60 pt-2.5">
          <span className="text-xs text-surface-500">Travel time not set</span>
          <button
            onClick={() => { setEditingTime(true); setTimeValue(Number(persistedTime) || 15) }}
            className="text-xs font-medium text-accent hover:text-white transition-colors"
          >
            Add travel time
          </button>
        </div>
      )}

      {/* Consequence — downstream deadline impact while traveling */}
      {!editingTime && consequence?.context === 'traveling' && (() => {
        const rendered = renderConsequence(consequence, getProfile(trip))
        if (!rendered) return null
        const color = consequence.severity === 'ok'    ? 'text-status-ok'
          : consequence.severity === 'tight'           ? 'text-status-tight'
          : 'text-status-at_risk'
        return (
          <div className="border-t border-surface-700/60 pt-2.5">
            <p className={`text-xs font-semibold ${color}`}>{rendered.headlineLine}</p>
            <p className="text-xs text-surface-500 mt-0.5">{rendered.contextLine}</p>
          </div>
        )
      })()}

      {editingTime && (
        <div className="border-t border-surface-700/60 pt-3 space-y-3">
          {/* Mode selector */}
          <div className="flex gap-1.5">
            {LEG_MODE_OPTIONS.map(m => (
              <button
                key={m.label}
                type="button"
                onClick={() => setModeValue(m.value)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
                  modeValue === m.value
                    ? 'border-accent bg-accent/10 text-white'
                    : 'border-surface-600 bg-surface-700 text-surface-400'
                }`}
              >
                <span className="text-base leading-none">{m.emoji}</span>
                <span className="text-[10px]">{m.label}</span>
              </button>
            ))}
          </div>
          {/* Stepper */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTimeValue(v => Math.max(0, v - 15))}
              className="w-12 h-12 flex items-center justify-center bg-surface-700 text-surface-300 rounded-xl font-bold active:scale-95 transition-transform"
            >−15</button>
            <button
              onClick={() => setTimeValue(v => Math.max(0, v - 5))}
              className="w-12 h-12 flex items-center justify-center bg-surface-700 text-surface-300 rounded-xl font-bold active:scale-95 transition-transform"
            >−5</button>
            <span className="flex-1 text-center font-mono text-white text-2xl font-bold">{timeValue}m</span>
            <button
              onClick={() => setTimeValue(v => Math.min(600, v + 5))}
              className="w-12 h-12 flex items-center justify-center bg-surface-700 text-surface-300 rounded-xl font-bold active:scale-95 transition-transform"
            >+5</button>
            <button
              onClick={() => setTimeValue(v => Math.min(600, v + 15))}
              className="w-12 h-12 flex items-center justify-center bg-surface-700 text-surface-300 rounded-xl font-bold active:scale-95 transition-transform"
            >+15</button>
          </div>
          {/* Quick presets */}
          <div className="flex gap-1.5">
            {[15, 30, 45, 60, 90].map(p => (
              <button
                key={p}
                onClick={() => setTimeValue(p)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  timeValue === p ? 'bg-accent text-surface-900' : 'bg-surface-700 text-surface-400'
                }`}
              >{p}m</button>
            ))}
          </div>
          {/* Save / Cancel */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-status-ok text-surface-900 active:scale-[0.98] transition-transform"
            >
              Save
            </button>
            <button
              onClick={() => setEditingTime(false)}
              className="px-5 py-2.5 rounded-xl text-sm text-surface-400 bg-surface-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// NEXT CRITICAL CARD — compact deadline card when ahead of next stop
// ============================================================

function NextCriticalCard({ entry, trip }) {
  const cp           = trip.checkpoints.find(c => c.id === entry.checkpointId)
  const deadlineTime = entry.deadlineTime       ? formatTime(entry.deadlineTime)       : '--:--'
  const latestSafe   = entry.latestSafeArrival  ? formatTime(entry.latestSafeArrival)  : null
  const eta          = entry.etaUncertain ? '?' : entry.estimatedArrival ? formatTime(entry.estimatedArrival) : '--:--'
  const buffer       = entry.bufferMinutes

  const bufferColor = buffer === null ? 'text-surface-400'
    : buffer < 0  ? 'text-status-at_risk'
    : buffer < 10 ? 'text-status-tight'
    : 'text-status-ok'

  const bufferStr = buffer === null ? null
    : buffer >= 0 ? `+${buffer}m to deadline`
    : `${Math.abs(buffer)}m late`

  return (
    <div>
      <p className="text-xs text-surface-500 uppercase tracking-wider mb-2">Next deadline</p>
      <Card className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <CheckpointTypeIcon kind={entry.kind} departureMode={cp?.departureMode} />
          <span className="text-white font-semibold text-sm flex-1 truncate">{entry.checkpointName}</span>
          <span className="font-mono text-sm text-white font-bold">{deadlineTime}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-surface-500">Your ETA </span>
            <span className="font-mono text-surface-300">{eta}</span>
          </div>
          {latestSafe && (
            <div>
              <span className="text-surface-500">Arrive by </span>
              <span className="font-mono text-status-tight">{latestSafe}</span>
            </div>
          )}
          {bufferStr && (
            <span className={`font-mono ml-auto ${bufferColor}`}>{bufferStr}</span>
          )}
        </div>
      </Card>
    </div>
  )
}

function UpcomingRow({ entry, trip }) {
  const eta = entry.etaUncertain ? '?' : entry.estimatedArrival ? formatTime(entry.estimatedArrival) : '--:--'
  const cp  = trip?.checkpoints.find(c => c.id === entry.checkpointId)

  const timeLabel = entry.kind === 'departure_deadline' && entry.deadlineTime
    ? formatTime(entry.deadlineTime)
    : eta

  return (
    <Card className="px-4 py-3 flex items-center gap-3">
      <StatusDot status={entry.status} />
      <CheckpointTypeIcon kind={entry.kind} departureMode={cp?.departureMode} />
      <span className="flex-1 text-sm text-white truncate">{entry.checkpointName}</span>
      <span className="font-mono text-sm text-surface-500">{timeLabel}</span>
      {entry.status === 'at_risk' && <AlertTriangle size={14} className="text-status-at_risk" />}
    </Card>
  )
}

// ============================================================
// TRIP START CARD
// ============================================================

function TripStartCard({ trip }) {
  const startTrip = useSessionStore(s => s.startTrip)
  const openTrip  = useUIStore(s => s.openTrip)
  const cpCount   = trip.checkpoints.length

  return (
    <Card className="px-4 py-4" onClick={() => openTrip(trip.id)}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold">{trip.title}</h3>
          <p className="text-surface-500 text-sm">{formatDate(trip.date)} · {cpCount} stops</p>
        </div>
        <ChevronRight size={18} className="text-surface-500" />
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={(e) => { e.stopPropagation(); startTrip(trip.id) }}
      >
        <Play size={14} />
        Start trip
      </Button>
    </Card>
  )
}
