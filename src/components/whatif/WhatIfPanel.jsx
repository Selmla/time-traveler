import React from 'react'
import { X, Zap, AlertTriangle, CheckCircle, ChevronUp, ChevronDown } from 'lucide-react'
import { useSessionStore } from '../../stores/index.js'
import { CHECKPOINT_KIND } from '../../engine/models.js'
import { formatTime } from '../../utils/time.js'
import { StatusDot, Button } from '../ui/index.jsx'

// ============================================================
// WHAT-IF PANEL
// Bottom sheet that simulates adding time to a checkpoint.
// Shows the ripple effect on the entire timeline.
// Does NOT modify actual data until user confirms.
// ============================================================

export default function WhatIfPanel({ trip, timeline, whatIfTimeline }) {
  const whatIfCpId    = useSessionStore(s => s.whatIfCheckpointId)
  const whatIfMinutes = useSessionStore(s => s.whatIfExtraMinutes)
  const setMinutes    = useSessionStore(s => s.setWhatIfMinutes)
  const closeWhatIf   = useSessionStore(s => s.closeWhatIf)

  // whatIfTimeline is computed by useTimeline (with real session + ETA data) and passed in
  const simTimeline = whatIfTimeline

  if (!whatIfCpId || !timeline) return null

  const checkpoint = trip.checkpoints.find(c => c.id === whatIfCpId)
  if (!checkpoint) return null

  // Find which entries changed status
  const changedEntries = simTimeline?.entries.filter(simEntry => {
    const origEntry = timeline.entries.find(e => e.checkpointId === simEntry.checkpointId)
    return origEntry && origEntry.status !== simEntry.status && simEntry.checkpointId !== whatIfCpId
  }) || []

  const atRiskEntries = simTimeline?.entries.filter(e => e.status === 'at_risk') || []
  const isWorse = atRiskEntries.length > timeline.entries.filter(e => e.status === 'at_risk').length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
        onClick={closeWhatIf}
      />

      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-800 border-t border-surface-600/50 rounded-t-2xl animate-slide-up pb-safe">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-surface-600 rounded-full" />
        </div>

        <div className="px-4 pb-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-accent" />
              <span className="font-semibold text-white">What-If Simulator</span>
            </div>
            <button onClick={closeWhatIf} className="text-surface-500 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Checkpoint name */}
          <p className="text-sm text-surface-500 mb-4">
            {checkpoint.kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE
              ? <>What if we arrive <span className="text-white font-medium">later than planned</span> at {checkpoint.name}?</>
              : <>What if we spend longer at <span className="text-white font-medium">{checkpoint.name}</span>?</>
            }
          </p>

          {/* Time adjuster */}
          <div className="bg-surface-700 rounded-xl p-4 mb-4">
            <p className="text-xs text-surface-500 mb-3 uppercase tracking-wider">Extra time to add</p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMinutes(whatIfMinutes - 5)}
                disabled={whatIfMinutes <= 0}
                className="w-12 h-12 rounded-xl bg-surface-600 flex items-center justify-center text-white hover:bg-surface-500 active:scale-95 transition-all disabled:opacity-30"
              >
                <ChevronDown size={20} />
              </button>

              <div className="flex-1 text-center">
                <span className="font-mono text-3xl font-bold text-white">+{whatIfMinutes}</span>
                <span className="text-surface-500 text-sm ml-1">min</span>
              </div>

              <button
                onClick={() => setMinutes(whatIfMinutes + 5)}
                disabled={whatIfMinutes >= 180}
                className="w-12 h-12 rounded-xl bg-surface-600 flex items-center justify-center text-white hover:bg-surface-500 active:scale-95 transition-all disabled:opacity-30"
              >
                <ChevronUp size={20} />
              </button>
            </div>

            {/* Quick presets */}
            <div className="flex gap-2 mt-3">
              {[10, 15, 30, 60].map(m => (
                <button
                  key={m}
                  onClick={() => setMinutes(m)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    whatIfMinutes === m
                      ? 'bg-accent text-surface-900'
                      : 'bg-surface-600 text-surface-400 hover:text-white'
                  }`}
                >
                  +{m}m
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {simTimeline && whatIfMinutes > 0 && (
            <div className="bg-surface-700 rounded-xl p-4 mb-4">
              <p className="text-xs text-surface-500 mb-3 uppercase tracking-wider">Consequences</p>

              {changedEntries.length === 0 && !isWorse ? (
                <div className="flex items-center gap-2 text-status-ok text-sm">
                  <CheckCircle size={14} />
                  No impact — you're still on track
                </div>
              ) : (
                <div className="space-y-2">
                  {simTimeline.entries.map(simEntry => {
                    const origEntry = timeline.entries.find(e => e.checkpointId === simEntry.checkpointId)
                    if (!origEntry || simEntry.checkpointId === whatIfCpId) return null
                    const changed = origEntry.status !== simEntry.status
                    const newEta = simEntry.estimatedArrival ? formatTime(simEntry.estimatedArrival) : '--:--'
                    const origEta = origEntry.estimatedArrival ? formatTime(origEntry.estimatedArrival) : '--:--'

                    return (
                      <div key={simEntry.checkpointId} className="flex items-center gap-3">
                        <StatusDot status={simEntry.status} />
                        <span className={`text-sm flex-1 ${changed ? 'font-medium text-white' : 'text-surface-500'}`}>
                          {simEntry.checkpointName}
                        </span>
                        <div className="text-right">
                          <span className="font-mono text-xs text-white">{newEta}</span>
                          {changed && origEta !== newEta && (
                            <span className="font-mono text-xs text-surface-500 ml-1 line-through">{origEta}</span>
                          )}
                        </div>
                        {changed && (
                          <AlertTriangle size={12} className="text-status-at_risk flex-shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Overall verdict */}
          {simTimeline && whatIfMinutes > 0 && (
            <div className={`rounded-xl p-3 mb-4 text-sm font-medium ${
              simTimeline.tripStatus === 'at_risk'
                ? 'bg-status-at_risk/20 text-status-at_risk'
                : simTimeline.tripStatus === 'tight'
                ? 'bg-status-tight/20 text-status-tight'
                : 'bg-status-ok/20 text-status-ok'
            }`}>
              {simTimeline.tripStatus === 'at_risk'
                ? `⚠️ +${whatIfMinutes} minutes would put your trip at risk`
                : simTimeline.tripStatus === 'tight'
                ? `⏱ Getting tight — manageable but watch your pace`
                : `✓ Safe — +${whatIfMinutes} minutes still works`}
            </div>
          )}

          <Button variant="ghost" onClick={closeWhatIf} className="w-full">
            Close without changing anything
          </Button>
        </div>
      </div>
    </>
  )
}
