import React, { useEffect, useRef, useState } from 'react'
import { useDepartConfirm } from '../../hooks/useDepartConfirm.js'
import { X, Navigation, CheckCircle, ArrowRight, Sun, Moon } from 'lucide-react'
import { formatTime, addMinutes } from '../../utils/time.js'
import { openNavigation } from '../../utils/maps.js'
import { STATUS, makeLegId } from '../../engine/models.js'
import { useUIStore, useSessionStore } from '../../stores/index.js'
import { getProfile, profileCopy } from '../../utils/tripProfile.js'
import { renderConsequence } from '../../utils/warningCopy.js'

// ============================================================
// GLANCE MODE
// Full-screen riding overlay. Designed to be read in 1-2 seconds.
// Large text, high contrast, single dominant status color.
// ============================================================

function legModeText(minutes, mode) {
  const prefix = `~${minutes} min`
  if (mode === 'walking') return `${prefix} walk`
  if (mode === 'driving') return `${prefix} drive`
  if (mode === 'cycling') return `${prefix} ride`
  if (mode === 'transit') return `${prefix} by transit`
  return `${prefix} away`
}

export default function GlanceMode({ trip, timeline, now, onClose, onMarkArrived, onMarkDeparted }) {
  const next        = timeline.nextStop
  const status      = timeline.tripStatus
  const totalBuffer = timeline.totalBufferMins
  const theme       = useUIStore(s => s.theme)
  const toggleTheme = useUIStore(s => s.toggleTheme)

  // Vibrate once when status transitions into at_risk or missed
  const prevStatusRef = useRef(status)
  useEffect(() => {
    const prev = prevStatusRef.current
    if (
      (status === STATUS.AT_RISK || status === STATUS.MISSED) &&
      prev !== STATUS.AT_RISK &&
      prev !== STATUS.MISSED
    ) {
      navigator.vibrate?.([200, 100, 200])
    }
    prevStatusRef.current = status
  }, [status])

  const updateLeg = useSessionStore(s => s.updateLeg)

  const { pending: departPending, requestDepart: onDepartTap, confirm: onDepartConfirm, cancel: onDepartCancel } =
    useDepartConfirm(() => { if (next?.checkpointId) onMarkDeparted(next.checkpointId) })

  // ETA entry — degraded-mode recovery when travel time is unknown
  const [etaCustomOpen, setEtaCustomOpen] = useState(false)
  const [etaCustomMins, setEtaCustomMins]  = useState('')

  const profile = getProfile(trip)
  const copy    = profileCopy(profile)

  const cp = next ? trip.checkpoints.find(c => c.id === next.checkpointId) : null

  const STATUS_CFG = {
    ok:        { label: 'ON TRACK',        color: 'text-status-ok',        dimColor: 'text-status-ok/60' },
    tight:     { label: 'GETTING TIGHT',   color: 'text-status-tight',     dimColor: 'text-status-tight/60' },
    at_risk:   { label: 'DEADLINE AT RISK', color: 'text-status-at_risk',  dimColor: 'text-status-at_risk/60' },
    missed:    { label: 'MISSED',          color: 'text-status-at_risk',   dimColor: 'text-status-at_risk/60' },
    completed: { label: 'COMPLETE',        color: 'text-status-completed', dimColor: 'text-status-completed/60' },
    pending:   { label: 'PLANNED',         color: 'text-surface-400',      dimColor: 'text-surface-500' },
  }

  // View-layer safety net: if buffer is actually negative, treat as danger regardless
  // of engine status (can occur when ETA is uncertain at the time of last calculation).
  const isDanger  = status === STATUS.AT_RISK || status === STATUS.MISSED
    || (totalBuffer !== null && totalBuffer < 0)
  const isWarning = !isDanger && status === STATUS.TIGHT
  const isUrgent  = isDanger || isWarning
  const isAtRisk  = isDanger  // alias kept for vibrate guard above
  const isArrived = next?.status === STATUS.ARRIVED

  // Leg identity for updateLeg; null when there is no active leg to edit
  const legId = timeline.currentLeg
    ? makeLegId(timeline.currentLeg.fromId, timeline.currentLeg.toId)
    : null

  // Show the degraded-mode ETA entry when traveling with unknown ETA
  const showEtaEntry = !isArrived && !!timeline.currentLeg?.etaUncertain && !!legId

  // Reset custom input when ETA is resolved so stale digits don't persist
  useEffect(() => {
    if (!showEtaEntry) {
      setEtaCustomOpen(false)
      setEtaCustomMins('')
    }
  }, [showEtaEntry])

  const handleEtaSet = (minutes) => {
    const mins = Math.round(Number(minutes))
    if (!legId || !mins || mins < 1) return
    updateLeg(legId, { travelTimeMinutes: mins, source: 'manual' })
    setEtaCustomOpen(false)
    setEtaCustomMins('')
  }

  // Uncertain: ETA unknown with no urgency signal — must not show "ON TRACK" / "KEEP GOING"
  const isUncertain = !isUrgent && next?.etaUncertain
    && (status === STATUS.OK || status === STATUS.PENDING)

  // Running late: on-time overall but behind the planned pace on at least one pending stop
  const isRunningLate = !isUrgent && !isUncertain && status === STATUS.OK
    && timeline.entries.some(e =>
        e.delay > 0 &&
        e.status !== STATUS.COMPLETED &&
        e.status !== STATUS.SKIPPED
      )

  // cfg drives color and default label — escalate to at_risk when buffer is negative
  const cfg = isDanger ? STATUS_CFG.at_risk : (STATUS_CFG[status] || STATUS_CFG.pending)

  // headline color escalates to amber for running-late even though engine status is ok
  const headlineColor = isRunningLate ? 'text-status-tight' : cfg.color

  const eta = next?.etaUncertain
    ? null
    : next?.estimatedArrival
    ? formatTime(next.estimatedArrival)
    : null

  const bufferColor = totalBuffer === null ? 'text-surface-400'
    : totalBuffer < 0  ? 'text-status-at_risk'
    : totalBuffer < 10 ? 'text-status-tight'
    : 'text-status-ok'

  const bufferStr = totalBuffer === null ? null
    : totalBuffer >= 0 ? `+${totalBuffer}m`
    : `${totalBuffer}m`

  const directive = (() => {
    if (isArrived) {
      if (isDanger) {
        if (totalBuffer !== null && totalBuffer <= 0) return copy.departImmediate
        if (totalBuffer !== null)                     return copy.departWithin(totalBuffer)
        return copy.departNow
      }
      if (isWarning) return totalBuffer !== null && totalBuffer > 0
        ? copy.leaveWithin(totalBuffer) : copy.leaveNow
      return copy.youAreHere
    }
    if (status === STATUS.MISSED) return copy.replan
    if (isDanger) {
      const modeStr = { ferry: 'FERRY', train: 'TRAIN', flight: 'FLIGHT', bus: 'BUS' }[cp?.departureMode]
      if (next?.kind === 'departure_deadline') return `${modeStr ?? 'CONNECTION'} WINDOW CLOSING`
      if (next?.kind === 'fixed_appointment')  return copy.appointmentAtRisk
      return cp?.address ? 'Open Maps now' : copy.deadlineClose
    }
    if (isUncertain)                       return 'Check Maps — tap a time'
    if (isRunningLate)                     return copy.behindPlan
    if (isWarning && totalBuffer !== null) return `Leave within ${totalBuffer}m`
    if (status === STATUS.COMPLETED)       return 'Trip complete!'
    return copy.keepGoing
  })()

  const headlineLabel = isDanger && isArrived  ? copy.leaveNow
    : isDanger                                 ? copy.timeCritical
    : isWarning && isArrived                   ? copy.leaveSoon
    : isUncertain                              ? 'NO ETA YET'
    : isRunningLate                            ? 'RUNNING LATE'
    : cfg.label

  const headlineSize = isDanger ? 'text-6xl' : isWarning ? 'text-5xl' : 'text-4xl'

  const leaveByTime = isArrived && isUrgent && totalBuffer !== null && now
    ? formatTime(new Date(now.getTime() + Math.max(0, totalBuffer) * 60000))
    : null

  // Mini timeline: most recent completed, current, next deadline
  const entries  = timeline.entries
  const nextIdx  = next ? entries.findIndex(e => e.checkpointId === next.checkpointId) : -1
  const prevEntry = nextIdx > 0
    ? entries.slice(0, nextIdx).reverse().find(e =>
        e.status === STATUS.COMPLETED || e.status === STATUS.SKIPPED
      )
    : null
  // Prefer nextCritical (already computed by engine); fall back to scanning
  const nextDeadline = (() => {
    const crit = timeline.nextCritical
    if (crit && crit.checkpointId !== next?.checkpointId) return crit
    if (nextIdx < 0) return null
    return entries.slice(nextIdx + 1).find(e =>
      e.isFixed &&
      e.status !== STATUS.SKIPPED &&
      e.status !== STATUS.COMPLETED
    ) || null
  })()

  const allDone = entries.every(
    e => e.status === STATUS.COMPLETED || e.status === STATUS.SKIPPED
  )

  // Next stop after current — for "what comes next" context in stop panel
  const afterCurrent = isArrived && nextIdx >= 0
    ? entries.slice(nextIdx + 1).find(e =>
        e.status !== STATUS.COMPLETED && e.status !== STATUS.SKIPPED
      )
    : null

  // Departure transparency: planned departure from the previous stop
  // Used to show "planned 11:57 / actual 12:03 / +6m late" during travel state
  const prevCp = prevEntry ? trip.checkpoints.find(c => c.id === prevEntry.checkpointId) : null
  const prevPlannedDeparture = prevEntry?.plannedArrival != null && prevCp?.plannedDuration != null
    ? addMinutes(prevEntry.plannedArrival, prevCp.plannedDuration)
    : null

  // Stop metrics — derived from live timer; only meaningful when arrived
  const elapsed = isArrived && next?.actualArrival
    ? Math.max(0, Math.round((now - next.actualArrival) / 60000))
    : null
  const minsUntilDepart = isArrived && next?.estimatedDeparture
    ? Math.round((next.estimatedDeparture - now) / 60000)
    : null
  const leaveByStr = isArrived && next?.estimatedDeparture
    ? formatTime(next.estimatedDeparture)
    : null

  // Show Navigate in the arrived-state bottom row when the current stop has an address.
  // Hidden during departPending — the two-tap confirmation is a focused interaction.
  const showArrivalNavigate = !!(next && isArrived && !departPending && cp?.address)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface-900 overflow-hidden select-none">

      {/* Alert stripe — scales by urgency level */}
      {isDanger  && <div className="h-2 bg-status-at_risk animate-pulse flex-shrink-0" />}
      {isWarning && <div className="h-1 bg-status-tight flex-shrink-0" />}

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
        <span className="text-xs font-semibold text-surface-400 uppercase tracking-widest">Glance Mode</span>
        <div className="flex items-center gap-1 -mr-1">
          {/* Theme toggle — accessible without leaving Glance Mode (lighting changes while riding) */}
          <button
            onClick={toggleTheme}
            className="text-surface-400 hover:text-surface-300 p-3 rounded-xl transition-colors"
            title={theme === 'night' ? 'Day mode' : 'Night mode'}
            style={{ minWidth: 56, minHeight: 56 }}
          >
            {theme === 'night' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
          </button>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-300 p-3 rounded-xl transition-colors" style={{ minWidth: 56, minHeight: 56 }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Status headline */}
      <div className="px-5 pb-3 flex-shrink-0">
        <h1 className={`font-black tracking-tight leading-none ${headlineSize} ${headlineColor}`}>
          {headlineLabel}
        </h1>
        {/* Precision indicator: deadline is still safe, but stop is running over planned time.
            Separates "deadline safety" (green headline) from "operational precision" (amber note). */}
        {isArrived && !isUrgent && minsUntilDepart !== null && minsUntilDepart < 0 && (
          <p className="text-status-tight text-sm font-semibold mt-0.5">
            {Math.abs(minsUntilDepart)}m past plan
          </p>
        )}
        <p className="text-surface-400 text-xs mt-1 truncate">{trip.title}</p>
      </div>

      <div className="h-px mx-5 bg-surface-800 flex-shrink-0" />

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

        {allDone ? (
          <div className="py-10 text-center">
            <p className="text-5xl mb-3">🎉</p>
            <p className="text-status-completed font-bold text-2xl">All stops complete!</p>
          </div>

        ) : next ? (
          <>
            {/* Next / current checkpoint */}
            <div>
              <p className="text-surface-300 text-xs font-semibold uppercase tracking-wider mb-1">
                {isArrived ? 'Currently at' : 'Next stop'}
              </p>
              <h2 className="text-white text-2xl font-bold leading-tight">{next.checkpointName}</h2>
            </div>

            {/* Current leg — context chip with departure transparency, only when traveling */}
            {timeline.currentLeg && !isArrived && (
              <div className="bg-surface-800 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-surface-400 text-xs font-medium truncate">
                    from {timeline.currentLeg.fromName}
                  </span>
                  {timeline.currentLeg.travelTimeSource === 'maps' && (
                    <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                      Live
                    </span>
                  )}
                </div>
                {/* Departure transparency: when / planned / drift */}
                {timeline.currentLeg.departureTime && (
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className="text-surface-500 text-xs">Left</span>
                    <span className="font-mono text-surface-300 text-xs">{formatTime(timeline.currentLeg.departureTime)}</span>
                    {prevPlannedDeparture && (
                      <>
                        <span className="text-surface-700 text-xs">·</span>
                        <span className="text-surface-500 text-xs">planned</span>
                        <span className="font-mono text-surface-500 text-xs">{formatTime(prevPlannedDeparture)}</span>
                      </>
                    )}
                    {next?.delay > 0 && (
                      <>
                        <span className="text-surface-700 text-xs">·</span>
                        <span className="font-mono text-status-tight text-xs font-semibold">+{next.delay}m late</span>
                      </>
                    )}
                    {next?.delay < 0 && (
                      <>
                        <span className="text-surface-700 text-xs">·</span>
                        <span className="font-mono text-status-ok text-xs font-semibold">{Math.abs(next.delay)}m early</span>
                      </>
                    )}
                  </div>
                )}
                <p className="text-surface-100 text-base font-semibold">
                  {timeline.currentLeg.travelTimeMinutes !== null
                    ? legModeText(timeline.currentLeg.travelTimeMinutes, timeline.currentLeg.travelMode)
                    : timeline.currentLeg.etaUncertain ? 'travel time not set' : '—'}
                </p>
              </div>
            )}

            {/* Main metrics section */}
            {isArrived && isDanger && totalBuffer !== null ? (

              /* Danger countdown — buffer exhaustion display */
              <div className="text-center py-2">
                <p className="text-xs text-surface-300 font-semibold uppercase tracking-widest mb-1">
                  {totalBuffer <= 0 ? 'BUFFER EXHAUSTED' : 'MIN LEFT'}
                </p>
                <p className={`font-black leading-none ${cfg.color} text-8xl animate-pulse`}>
                  {Math.max(0, totalBuffer)}
                </p>
                {leaveByTime && (
                  <p className={`font-mono text-sm mt-3 ${cfg.color}`}>leave by {leaveByTime}</p>
                )}
              </div>

            ) : isArrived ? (

              /* Stop panel — action-first: when to leave / how long here / what's next */
              <div className="bg-surface-800 rounded-xl overflow-hidden">
                {/* Priority 1: Leave timing (or not-recorded fallback) */}
                {minsUntilDepart !== null ? (
                  <>
                    <div className="flex justify-between items-center px-4 py-3 border-b border-surface-700/50">
                      <span className="text-surface-300 text-sm font-medium">
                        {minsUntilDepart < 0 ? 'Past plan' : 'Leave within'}
                      </span>
                      <span className={`font-mono font-bold text-2xl ${
                        minsUntilDepart <= 0   ? 'text-status-at_risk animate-pulse'
                        : minsUntilDepart < 5  ? 'text-status-at_risk'
                        : minsUntilDepart < 10 ? 'text-status-tight'
                        : 'text-status-ok'
                      }`}>
                        {Math.abs(minsUntilDepart)}m
                      </span>
                    </div>
                    {leaveByStr && (
                      <div className="flex justify-between items-center px-4 py-3 border-b border-surface-700/50">
                        <span className="text-surface-300 text-sm font-medium">Leave by</span>
                        <span className={`font-mono font-semibold text-lg ${
                          minsUntilDepart < 5 ? 'text-status-tight' : 'text-white'
                        }`}>
                          {leaveByStr}
                        </span>
                      </div>
                    )}
                  </>
                ) : elapsed === null && (
                  <div className="flex justify-between items-center px-4 py-3 border-b border-surface-700/50">
                    <span className="text-surface-400 text-sm">Arrival time not recorded</span>
                  </div>
                )}
                {/* Context: how long you've been here */}
                {elapsed !== null && (
                  <div className="flex justify-between items-center px-4 py-3 border-b border-surface-700/50">
                    <span className="text-surface-300 text-sm font-medium">Here for</span>
                    <span className="font-mono text-white font-semibold text-lg">{elapsed}m</span>
                  </div>
                )}
                {/* Consequence — downstream deadline impact; suppress very large ok buffers in Glance */}
                {(() => {
                  const c = timeline.consequence
                  if (!c || c.context !== 'arrived') return null
                  if (c.severity === 'ok' && c.bufferMins > 30) return null
                  const rendered = renderConsequence(c, profile)
                  if (!rendered) return null
                  const color = c.severity === 'ok'      ? 'text-status-ok'
                    : c.severity === 'tight'             ? 'text-status-tight'
                    : 'text-status-at_risk'
                  return (
                    <div className="px-4 py-3 border-b border-surface-700/50">
                      <p className={`text-sm font-semibold ${color}`}>{rendered.headlineLine}</p>
                      <p className="text-surface-500 text-xs mt-0.5">{rendered.contextLine}</p>
                    </div>
                  )
                })()}
                {/* Next destination */}
                {afterCurrent ? (
                  <div className="flex justify-between items-center px-4 py-3">
                    <div>
                      <span className="text-surface-500 text-[10px] uppercase tracking-wider font-semibold">Next stop</span>
                      <p className="text-white text-sm font-semibold mt-0.5 truncate max-w-[160px]">{afterCurrent.checkpointName}</p>
                    </div>
                    <span className="font-mono text-surface-300 text-base font-medium flex-shrink-0">
                      {afterCurrent.etaUncertain ? '—?' : afterCurrent.estimatedArrival ? formatTime(afterCurrent.estimatedArrival) : '—'}
                    </span>
                  </div>
                ) : (
                  <div className="px-4 py-3">
                    <span className="text-surface-500 text-sm">Last stop on itinerary</span>
                  </div>
                )}
              </div>

            ) : (

              /* Traveling: ETA with drift + deadline buffer, or degraded-mode ETA entry */
              <div className="bg-surface-800 rounded-xl overflow-hidden">
                {showEtaEntry ? (
                  /* Degraded mode — ETA unknown; rider enters travel time directly from HUD */
                  <div className="px-4 py-3">
                    <p className="text-surface-400 text-xs font-semibold uppercase tracking-wider mb-3">
                      How long from Maps?
                    </p>
                    {etaCustomOpen ? (
                      /* Custom minute entry */
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="360"
                          step="1"
                          value={etaCustomMins}
                          onChange={e => setEtaCustomMins(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleEtaSet(etaCustomMins)}
                          placeholder="min"
                          className="flex-1 bg-surface-700 text-white font-mono text-xl text-center rounded-xl py-3 border border-surface-600 min-w-0 min-h-[52px]"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEtaSet(etaCustomMins)}
                          disabled={!etaCustomMins || Number(etaCustomMins) < 1}
                          className="px-5 py-3 bg-accent text-surface-900 font-bold rounded-xl disabled:opacity-40 min-h-[52px]"
                        >
                          Set
                        </button>
                        <button
                          onClick={() => { setEtaCustomOpen(false); setEtaCustomMins('') }}
                          className="p-3 text-surface-400 min-h-[52px] min-w-[52px] flex items-center justify-center"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      /* Preset grid — 3 columns; each button is comfortably glove-sized */
                      <div className="grid grid-cols-3 gap-2">
                        {[15, 25, 30, 45, 60, null].map(m =>
                          m !== null ? (
                            <button
                              key={m}
                              onClick={() => handleEtaSet(m)}
                              className="py-3.5 bg-surface-700 text-white font-bold text-base rounded-xl border border-surface-600 active:scale-[0.96] transition-transform min-h-[56px]"
                            >
                              {m}m
                            </button>
                          ) : (
                            <button
                              key="custom"
                              onClick={() => setEtaCustomOpen(true)}
                              className="py-3.5 bg-surface-700 text-surface-400 font-bold text-base rounded-xl border border-surface-600 active:scale-[0.96] transition-transform min-h-[56px]"
                              aria-label="Enter custom travel time"
                            >
                              ···
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Normal traveling state — ETA known */
                  <div className="flex justify-between items-start px-4 py-3 border-b border-surface-700/50">
                    <span className="text-surface-300 text-sm font-medium">ETA</span>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-bold text-white leading-none">{eta ?? '—?'}</p>
                      {next?.delay > 0 && (
                        <p className="font-mono text-xs text-status-tight mt-0.5">+{next.delay}m behind plan</p>
                      )}
                      {next?.delay < 0 && (
                        <p className="font-mono text-xs text-status-ok mt-0.5">{Math.abs(next.delay)}m ahead of plan</p>
                      )}
                    </div>
                  </div>
                )}
                {bufferStr && (
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-surface-300 text-sm font-medium">Deadline buffer</span>
                    <span className={`font-mono font-bold text-2xl ${bufferColor}`}>{bufferStr}</span>
                  </div>
                )}
              </div>

            )}

            {/* Latest safe arrival — traveling only */}
            {!isArrived && next.latestSafeArrival && (
              <div className="flex items-baseline gap-2">
                <span className="text-surface-300 text-sm font-medium">Arrive by</span>
                <span className={`font-mono font-bold ${
                  isDanger                                   ? 'text-2xl text-status-at_risk'
                  : totalBuffer !== null && totalBuffer < 5  ? 'text-xl text-status-at_risk'
                  : 'text-xl text-status-tight'
                }`}>
                  {formatTime(next.latestSafeArrival)}
                </span>
              </div>
            )}

            {/* Directive — traveling only; stop panel handles arrived state */}
            {!isArrived && (
              <p className={`font-bold ${headlineColor} ${isDanger ? 'text-xl' : 'text-lg'}`}>{directive}</p>
            )}

            {/* Mini timeline strip */}
            <MiniTimeline prev={prevEntry} current={next} nextDeadline={nextDeadline} />
          </>
        ) : null}

      </div>

      {/* Sticky action area */}
      <div className="px-5 pt-3 pb-5 space-y-2.5 flex-shrink-0 border-t border-surface-800">

        {/* Primary action — two-tap confirm model to prevent gloved mis-fires */}
        {next && isArrived && (
          departPending ? (
            <div className="space-y-2">
              <p className="text-center text-surface-300 text-sm font-semibold">Confirm depart?</p>
              <div className="flex gap-2.5">
                <button
                  onClick={onDepartCancel}
                  className="flex-1 flex items-center justify-center bg-surface-700 text-surface-300 font-bold text-xl py-4 rounded-2xl active:scale-[0.98] transition-transform border border-surface-600"
                >
                  Wait
                </button>
                <button
                  onClick={onDepartConfirm}
                  className={`flex-1 flex items-center justify-center bg-status-ok text-surface-900 font-bold rounded-2xl active:scale-[0.98] transition-transform ${isDanger ? 'text-xl py-5' : 'text-xl py-4'}`}
                >
                  Depart
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onDepartTap}
              className={`w-full flex items-center justify-center gap-3 bg-status-ok text-surface-900 font-bold rounded-2xl active:scale-[0.98] transition-transform ${isDanger ? 'text-2xl py-5' : 'text-xl py-5'}`}
            >
              <CheckCircle size={isDanger ? 26 : 22} />
              {isDanger ? 'DEPART NOW' : 'Depart now'}
            </button>
          )
        )}

        {next && !isArrived && cp?.address && (
          <button
            onClick={() => openNavigation(cp)}
            className="w-full flex items-center justify-center gap-3 bg-accent text-surface-900 font-bold text-xl py-5 rounded-2xl active:scale-[0.98] transition-transform"
          >
            <Navigation size={22} />
            Open Maps
          </button>
        )}

        {next && !isArrived && !cp?.address && (
          <button
            onClick={() => onMarkArrived(next.checkpointId)}
            className="w-full flex items-center justify-center gap-3 bg-status-ok text-surface-900 font-bold text-xl py-5 rounded-2xl active:scale-[0.98] transition-transform"
          >
            <CheckCircle size={22} />
            Mark arrived
          </button>
        )}

        {/* Navigate (arrived, no pending confirmation) + Exit — share one row to preserve footer height */}
        <div className="flex gap-2.5">
          {showArrivalNavigate && (
            <button
              onClick={() => openNavigation(cp)}
              className="flex-1 flex items-center justify-center gap-2 bg-surface-700 text-surface-200 font-semibold text-sm min-h-[56px] rounded-2xl border border-surface-600 active:scale-[0.98] transition-transform"
            >
              <Navigation size={16} />
              Navigate
            </button>
          )}
          <button
            onClick={onClose}
            className={`${showArrivalNavigate ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 text-surface-400 hover:text-white text-sm min-h-[56px] rounded-xl bg-surface-800 border border-surface-700 transition-colors`}
          >
            <X size={14} />
            Exit Glance Mode
          </button>
        </div>

      </div>
    </div>
  )
}

// ============================================================
// MINI TIMELINE — prev completed / current / next deadline
// ============================================================

const DOT_COLOR = {
  ok:        'bg-status-ok',
  tight:     'bg-status-tight',
  at_risk:   'bg-status-at_risk animate-pulse',
  missed:    'bg-status-at_risk',
  completed: 'bg-status-completed',
  arrived:   'bg-accent animate-pulse',
  skipped:   'bg-surface-600',
  pending:   'bg-surface-600',
}

function MiniTimeline({ prev, current, nextDeadline }) {
  if (!current) return null

  const rows = []
  if (prev)         rows.push({ entry: prev,         role: 'prev' })
  rows.push(        { entry: current,               role: 'current' })
  if (nextDeadline) rows.push({ entry: nextDeadline, role: 'next' })

  if (rows.length < 2) return null

  return (
    <div className="rounded-xl overflow-hidden border border-surface-700">
      {rows.map(({ entry, role }, idx) => {
        const isCurrent = role === 'current'
        const isPrev    = role === 'prev'

        const timeVal = entry.actualArrival
          ? formatTime(entry.actualArrival)
          : entry.etaUncertain
          ? '?'
          : entry.estimatedArrival
          ? formatTime(entry.estimatedArrival)
          : entry.deadlineTime
          ? formatTime(entry.deadlineTime)
          : '--'

        return (
          <div
            key={entry.checkpointId}
            className={`flex items-center gap-3 px-4 py-3
              ${isCurrent ? 'bg-surface-700' : ''}
              ${idx < rows.length - 1 ? 'border-b border-surface-700/50' : ''}
            `}
          >
            {isPrev ? (
              <CheckCircle size={11} className="text-status-completed flex-shrink-0" />
            ) : (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLOR[entry.status] || 'bg-surface-600'}`} />
            )}

            <span className={`flex-1 text-sm truncate ${
              isCurrent ? 'text-white font-semibold' : isPrev ? 'text-surface-500' : 'text-surface-300'
            }`}>
              {entry.checkpointName}
            </span>

            <span className={`font-mono text-xs flex-shrink-0 ${isCurrent ? 'text-white' : isPrev ? 'text-surface-500' : 'text-surface-400'}`}>
              {timeVal}
            </span>
          </div>
        )
      })}
    </div>
  )
}
