import React from 'react'
import { CheckCircle, AlertTriangle, Clock, Navigation, ChevronDown, SkipForward, MapPin } from 'lucide-react'
import { formatTime } from '../../utils/time.js'
import { openNavigation } from '../../utils/maps.js'
import { STATUS, CHECKPOINT_KIND } from '../../engine/models.js'
import { StatusDot, CheckpointTypeIcon, Card, Button } from '../ui/index.jsx'

// ============================================================
// TIMELINE VIEW
// Full scrollable list of all checkpoints with their times.
// Used in both planning mode and active trip mode.
// ============================================================

export default function TimelineView({ trip, timeline, interactive = false, onMarkArrived, onMarkDeparted }) {
  if (!timeline || !trip) return null

  const { entries, startEntry } = timeline

  // For each entry, find the next upcoming checkpoint that has its own deadline time.
  // Used in the expanded detail to show actionable leave-by info for non-deadline stops.
  const nextDeadlines = entries.map((_, i) =>
    entries.slice(i + 1).find(e =>
      e.deadlineTime != null &&
      e.status !== STATUS.SKIPPED &&
      e.status !== STATUS.COMPLETED
    ) ?? null
  )

  return (
    <div className="space-y-0">
      {startEntry && <StartRow startEntry={startEntry} />}
      {entries.map((entry, index) => (
        <TimelineRow
          key={entry.checkpointId}
          entry={entry}
          checkpoint={trip.checkpoints.find(c => c.id === entry.checkpointId)}
          isLast={index === entries.length - 1}
          interactive={interactive}
          onMarkArrived={onMarkArrived}
          onMarkDeparted={onMarkDeparted}
          nextDeadline={nextDeadlines[index]}
        />
      ))}
    </div>
  )
}

// ============================================================
// START ROW — trip origin / departure point
// ============================================================

function StartRow({ startEntry }) {
  const { name, address, departureTime } = startEntry
  const depStr = departureTime ? formatTime(departureTime) : '--:--'

  return (
    <div className="flex gap-0">
      <div className="flex flex-col items-center w-8 flex-shrink-0">
        <div className="w-3 h-3 rounded-full border-2 mt-5 flex-shrink-0 bg-accent border-accent" />
        <div className="w-px flex-1 my-1 bg-surface-600/50" />
      </div>
      <div className="flex-1 mb-3 ml-2">
        <div className="bg-surface-700 rounded-xl border border-surface-600/50 border-l-2 border-l-accent overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <MapPin size={14} className="text-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-accent">{name}</span>
                <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">START</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="font-mono text-xs text-surface-400">Departs {depStr}</span>
                {address && (
                  <span className="text-xs text-surface-500 truncate">{address}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// TIMELINE ROW
// ============================================================

function TimelineRow({ entry, checkpoint, isLast, interactive, onMarkArrived, onMarkDeparted, nextDeadline }) {
  const [expanded, setExpanded] = React.useState(false)
  if (!checkpoint) return null

  const isCompleted = entry.status === STATUS.COMPLETED
  const isArrived   = entry.status === STATUS.ARRIVED
  const isSkipped   = entry.status === STATUS.SKIPPED

  // Display time: actual arrival if known, else estimated
  const displayTime    = entry.actualArrival
    ? `✓ ${formatTime(entry.actualArrival)}`
    : entry.etaUncertain
    ? '—?'
    : entry.estimatedArrival ? formatTime(entry.estimatedArrival) : '--:--'
  const plannedTime    = entry.plannedArrival   ? formatTime(entry.plannedArrival)   : null
  const departTime     = entry.estimatedDeparture ? formatTime(entry.estimatedDeparture) : null
  const actualDeptTime = entry.actualDeparture  ? formatTime(entry.actualDeparture)  : null
  const delay          = entry.delay || 0

  // Spine dot style
  const dotClass = isCompleted
    ? 'bg-status-completed border-status-completed'
    : isArrived
    ? 'bg-accent border-accent animate-pulse'
    : isSkipped
    ? 'bg-surface-700 border-surface-600 opacity-40'
    : entry.status === 'at_risk'
    ? 'bg-status-at_risk border-status-at_risk animate-pulse'
    : entry.status === 'tight'
    ? 'bg-status-tight border-status-tight'
    : 'bg-surface-700 border-surface-500'

  // Card border color
  const borderColors = {
    ok:        'border-l-status-ok',
    tight:     'border-l-status-tight',
    at_risk:   'border-l-status-at_risk',
    missed:    'border-l-status-missed',
    completed: 'border-l-status-completed',
    arrived:   'border-l-accent',
    skipped:   'border-l-surface-600',
    pending:   'border-l-surface-600',
  }

  return (
    <div className="flex gap-0">
      {/* Timeline spine */}
      <div className="flex flex-col items-center w-8 flex-shrink-0">
        <div className={`w-3 h-3 rounded-full border-2 mt-5 flex-shrink-0 ${dotClass}`} />
        {!isLast && (
          <div className={`w-px flex-1 my-1 ${isCompleted || isSkipped ? 'bg-surface-700' : 'bg-surface-600/50'}`} />
        )}
      </div>

      {/* Checkpoint content */}
      <div className="flex-1 mb-3 ml-2">
        <div
          className={`
            bg-surface-700 rounded-xl border border-surface-600/50 overflow-hidden
            border-l-2 ${borderColors[entry.status] || borderColors.pending}
            ${isCompleted ? 'opacity-60' : ''}
            ${isSkipped   ? 'opacity-40' : ''}
            ${isArrived   ? 'ring-1 ring-accent/30' : ''}
          `}
        >
          {/* Main row */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            onClick={() => interactive && setExpanded(!expanded)}
          >
            <CheckpointTypeIcon kind={entry.kind} departureMode={checkpoint.departureMode} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${
                  isCompleted || isSkipped
                    ? 'line-through text-surface-500'
                    : isArrived
                    ? 'text-accent'
                    : 'text-white'
                }`}>
                  {entry.checkpointName}
                </span>
                {checkpoint.isFixed && (
                  <span className="text-[10px] bg-surface-600 text-surface-400 px-1.5 py-0.5 rounded">FIXED</span>
                )}
                {isArrived && (
                  <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">HERE</span>
                )}
                {isSkipped && (
                  <span className="text-[10px] bg-surface-600 text-surface-500 px-1.5 py-0.5 rounded">SKIPPED</span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-0.5">
                {/* Time display */}
                <span className={`font-mono text-xs ${isArrived ? 'text-accent' : 'text-white'}`}>
                  {displayTime}
                </span>
                {/* Actual departure for completed */}
                {isCompleted && actualDeptTime && (
                  <span className="font-mono text-xs text-surface-500">→ {actualDeptTime}</span>
                )}
                {/* Planned time if delayed — suppressed for deadline checkpoints
                    (the "planned" time there is the recommended arrival, not a user choice,
                     and the strikethrough + delta confuses more than it informs) */}
                {!isCompleted && !isArrived && plannedTime && delay !== 0 &&
                  entry.kind !== CHECKPOINT_KIND.DEPARTURE_DEADLINE && (
                  <span className="font-mono text-xs text-surface-500 line-through">{plannedTime}</span>
                )}
                {!isCompleted && !isSkipped && delay !== 0 &&
                  entry.kind !== CHECKPOINT_KIND.DEPARTURE_DEADLINE && (
                  <span className={`text-xs font-mono ${delay > 0 ? 'text-status-tight' : 'text-status-ok'}`}>
                    {delay > 0 ? `+${delay}m late` : `${Math.abs(delay)}m early`}
                  </span>
                )}
                {/* Estimated departure for upcoming */}
                {!isCompleted && !isArrived && !isSkipped && departTime && (
                  <span className="text-xs text-surface-500">→ {departTime}</span>
                )}
              </div>
            </div>

            {/* Warnings */}
            {entry.warnings?.length > 0 && (
              <AlertTriangle size={14} className="text-status-at_risk flex-shrink-0" />
            )}

            {/* Completed checkmark */}
            {isCompleted && (
              <CheckCircle size={14} className="text-status-completed flex-shrink-0" />
            )}

            {/* Expand indicator */}
            {interactive && !isSkipped && (
              <ChevronDown
                size={14}
                className={`text-surface-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            )}
          </div>

          {/* Expanded details */}
          {expanded && !isSkipped && (
            <div className="border-t border-surface-600/50 px-4 py-3 space-y-3">
              {/* Notes */}
              {checkpoint.notes && (
                <p className="text-xs text-surface-400 italic">{checkpoint.notes}</p>
              )}

              {/* Uncertain ETA */}
              {entry.etaUncertain && (
                <p className="text-xs text-surface-500">Travel time to this stop is unknown — ETA unavailable</p>
              )}

              {/* Warnings */}
              {entry.warnings?.length > 0 && (
                <div className="space-y-1">
                  {entry.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-status-tight text-xs">
                      <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actual times if recorded */}
              {(entry.actualArrival || entry.actualDeparture) && (
                <div className="space-y-1 text-xs">
                  {entry.actualArrival && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">Arrived</span>
                      <span className="font-mono text-status-completed">{formatTime(entry.actualArrival)}</span>
                    </div>
                  )}
                  {entry.actualDeparture && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">Departed</span>
                      <span className="font-mono text-status-completed">{formatTime(entry.actualDeparture)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Departure deadline timing */}
              {entry.kind === 'departure_deadline' && (
                <div className="space-y-1.5 text-xs">
                  {entry.recommendedArrival && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">Recommended arrival</span>
                      <span className="font-mono text-status-ok">{formatTime(entry.recommendedArrival)}</span>
                    </div>
                  )}
                  {entry.latestSafeArrival && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">Latest safe arrival</span>
                      <span className="font-mono text-status-tight">{formatTime(entry.latestSafeArrival)}</span>
                    </div>
                  )}
                  {entry.deadlineTime && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">Departure</span>
                      <span className="font-mono text-white font-semibold">{formatTime(entry.deadlineTime)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Opening hours */}
              {entry.kind === 'opening_hours' && (checkpoint.opensAt || checkpoint.closesAt) && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-surface-500">Open</span>
                    <span className="font-mono text-white">{checkpoint.opensAt || '--'} – {checkpoint.closesAt || '--'}</span>
                  </div>
                  {entry.latestSafeArrival && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">Latest useful arrival</span>
                      <span className="font-mono text-status-tight">{formatTime(entry.latestSafeArrival)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Fixed appointment timing */}
              {entry.kind === 'fixed_appointment' && entry.deadlineTime && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-surface-500">Appointment</span>
                    <span className="font-mono text-white">{formatTime(entry.deadlineTime)}</span>
                  </div>
                  {entry.latestSafeArrival && (
                    <div className="flex justify-between">
                      <span className="text-surface-500">Arrive by</span>
                      <span className="font-mono text-status-tight">{formatTime(entry.latestSafeArrival)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Buffer / leave-by info */}
              {entry.deadlineTime ? (
                /* Checkpoint has its own deadline — show how much buffer you have at it */
                entry.bufferMinutes !== null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-500">Deadline buffer</span>
                    <span className={`font-mono ${
                      entry.bufferMinutes < 0 ? 'text-status-at_risk' :
                      entry.bufferMinutes < 10 ? 'text-status-tight' : 'text-status-ok'
                    }`}>
                      {entry.bufferMinutes >= 0 ? `+${entry.bufferMinutes}m` : `${entry.bufferMinutes}m`}
                    </span>
                  </div>
                )
              ) : (
                /* Non-deadline stop — answer "how long can I stay here?" */
                entry.status !== STATUS.COMPLETED && entry.status !== STATUS.SKIPPED &&
                (entry.estimatedDeparture || nextDeadline) && (
                  <div className="space-y-1 text-xs">
                    {entry.estimatedDeparture && (
                      <div className="flex justify-between">
                        <span className="text-surface-500">Leave by</span>
                        <span className="font-mono text-surface-300">{formatTime(entry.estimatedDeparture)}</span>
                      </div>
                    )}
                    {nextDeadline?.deadlineTime && (
                      <div className="flex justify-between gap-2">
                        <span className="text-surface-500 flex-shrink-0">Next deadline</span>
                        <span className="font-mono text-surface-400 text-right">
                          {nextDeadline.checkpointName} · {formatTime(nextDeadline.deadlineTime)}
                        </span>
                      </div>
                    )}
                    {nextDeadline?.bufferMinutes != null && (
                      <div className="flex justify-between">
                        <span className="text-surface-500">Expected buffer after this stop</span>
                        <span className={`font-mono ${
                          nextDeadline.bufferMinutes < 0 ? 'text-status-at_risk' :
                          nextDeadline.bufferMinutes < 10 ? 'text-status-tight' : 'text-status-ok'
                        }`}>
                          {nextDeadline.bufferMinutes >= 0
                            ? `+${nextDeadline.bufferMinutes}m`
                            : `${nextDeadline.bufferMinutes}m`}
                        </span>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {checkpoint.address && (
                  <Button variant="secondary" size="sm" onClick={() => openNavigation(checkpoint)}>
                    <Navigation size={12} /> Navigate
                  </Button>
                )}
                {interactive && !isCompleted && !isSkipped && (
                  <>
                    {!entry.actualArrival && (
                      <Button variant="success" size="sm" onClick={() => onMarkArrived?.(checkpoint.id)}>
                        <CheckCircle size={12} /> Arrived
                      </Button>
                    )}
                    {entry.actualArrival && !entry.actualDeparture && (
                      <Button variant="secondary" size="sm" onClick={() => onMarkDeparted?.(checkpoint.id)}>
                        Departed
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
