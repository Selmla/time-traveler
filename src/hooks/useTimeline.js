// ============================================================
// useTimeline — The bridge between the engine and React
// ============================================================
// This hook:
// 1. Pulls trip data from the store
// 2. Pulls session data from the session store
// 3. Runs calculateTimeline()
// 4. Returns the result to any component that needs it
// 5. Re-runs whenever any input changes
// 6. Optionally re-runs on a timer (for live ETA updates)
// ============================================================

import { useMemo, useEffect, useState } from 'react'
import { useTripStore, useSessionStore } from '../stores/index.js'
import { calculateTimeline, simulateDelay } from '../engine/timeline.js'
import { parseTime } from '../utils/time.js'

/**
 * Calculate and return the live timeline for a given trip.
 * @param {string} tripId
 * @returns {{ timeline, trip, isLoading }}
 */
export function useTimeline(tripId) {
  const trip         = useTripStore(state => state.trips.find(t => t.id === tripId))
  const actuals      = useSessionStore(state => state.checkpointActuals)
  const legData      = useSessionStore(state => state.legData)
  const isRunning    = useSessionStore(state => state.isRunning)
  const activeTripId = useSessionStore(state => state.activeTripId)
  const whatIfActive  = useSessionStore(state => state.whatIfActive)
  const whatIfCpId    = useSessionStore(state => state.whatIfCheckpointId)
  const whatIfMinutes = useSessionStore(state => state.whatIfExtraMinutes)

  // This trip is active when it is the currently running session trip.
  const tripIsActive = isRunning && activeTripId === tripId

  // Live wall clock — only ticks when this specific trip is active.
  const [liveNow, setLiveNow] = useState(() => new Date())
  useEffect(() => {
    if (!tripIsActive) return
    const interval = setInterval(() => setLiveNow(new Date()), 30_000)
    return () => clearInterval(interval)
  }, [tripIsActive])

  // Planning view: use the trip's scheduled start time as `now` so the plan
  // displays correctly regardless of what time the user opens it. A plan is a
  // model of the future — it should not be compared against the current clock.
  // Active session: use the real wall clock updated every 30 seconds.
  const tripStartTime = trip?.startTime
  const tripDate      = trip?.date
  const now = useMemo(() => {
    if (tripIsActive) return liveNow
    const planned = (tripStartTime && tripDate) ? parseTime(tripStartTime, tripDate) : null
    return planned || new Date()
  }, [tripIsActive, liveNow, tripStartTime, tripDate])

  const timeline = useMemo(() => {
    if (!trip) return null
    return calculateTimeline(trip, actuals, legData, now, tripIsActive)
  }, [trip, actuals, legData, now, tripIsActive])

  const whatIfTimeline = useMemo(() => {
    if (!whatIfActive || !trip || !whatIfCpId) return null
    return simulateDelay(trip, whatIfCpId, whatIfMinutes, actuals, legData, now, tripIsActive)
  }, [whatIfActive, trip, whatIfCpId, whatIfMinutes, actuals, legData, now, tripIsActive])

  return {
    trip,
    timeline,
    whatIfTimeline,
    now,
    isLoading: !trip,
  }
}

/**
 * Get the timeline for the currently active trip (session).
 */
export function useActiveTimeline() {
  const activeTripId = useSessionStore(state => state.activeTripId)
  return useTimeline(activeTripId)
}
