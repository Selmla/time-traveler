// ============================================================
// timeline.js — currentLeg.departureTime regression tests
// ============================================================
// These tests guard the fix for: progress/elapsed calculations
// anchoring to trip.startTime (planned) instead of startedAt
// (actual departure) on the first leg of an active session.
//
// GlanceMode derives legElapsed from currentLeg.departureTime,
// so correctness here is the foundation for correct display.
// ============================================================

import { describe, it, expect } from 'vitest'
import { calculateTimeline, simulateDelay } from './timeline.js'
import { CHECKPOINT_KIND } from './models.js'

// ============================================================
// Minimal trip fixture
// Departs 11:30, 60 min to ferry terminal, ferry at 14:00.
// Buffer at 12:30 vs 13:45 cutoff = 75 min (well within OK).
// ============================================================

function makeTrip({ startTime = '11:30', date = '2026-05-15', travelToFirst = 60 } = {}) {
  return {
    id:           'trip-1',
    title:        'Test Trip',
    date,
    startTime,
    defaultBuffer: 30,
    minBuffer:     5,
    origin: {
      name:             'Start',
      address:          '',
      travelTimeToFirst: travelToFirst,
    },
    checkpoints: [{
      id:                 'cp1',
      name:               'Ferry Terminal',
      kind:               CHECKPOINT_KIND.DEPARTURE_DEADLINE,
      departureTime:      '14:00',
      minimumBufferMins:  15,
      preferredBufferMins: 30,
      isSkippable:        false,
    }],
  }
}

// Helper: compute elapsed minutes the same way GlanceMode does.
function elapsedMins(departureTime, now) {
  return Math.max(0, Math.round((now - departureTime) / 60000))
}

// ============================================================
// Planning view (no active session)
// ============================================================

describe('currentLeg.departureTime — planning view', () => {
  it('uses trip.startTime when no session is active', () => {
    const trip = makeTrip({ startTime: '11:30' })
    const now  = new Date(2026, 4, 15, 11, 0, 0) // before departure

    const { currentLeg } = calculateTimeline(trip, {}, {}, now, false, null)

    expect(currentLeg).not.toBeNull()
    expect(currentLeg.departureTime.getHours()).toBe(11)
    expect(currentLeg.departureTime.getMinutes()).toBe(30)
  })
})

// ============================================================
// Active session — first leg departure anchor
// ============================================================

describe('currentLeg.departureTime — active session, first leg', () => {
  it('on-time departure: departureTime matches startedAt = planned', () => {
    const trip      = makeTrip({ startTime: '11:30' })
    const startedAt = new Date(2026, 4, 15, 11, 30, 0).getTime() // exactly on time
    const now       = new Date(2026, 4, 15, 12,  0, 0)           // 30 min in

    const { currentLeg } = calculateTimeline(trip, {}, {}, now, true, startedAt)

    expect(currentLeg.departureTime.getHours()).toBe(11)
    expect(currentLeg.departureTime.getMinutes()).toBe(30)
    expect(elapsedMins(currentLeg.departureTime, now)).toBe(30)
  })

  it('early departure: departureTime uses startedAt, not planned start', () => {
    // Planned 11:30, actual 11:15 — 15 min early.
    // At 11:45 the user has been traveling 30 min, not 15 min.
    const trip      = makeTrip({ startTime: '11:30' })
    const startedAt = new Date(2026, 4, 15, 11, 15, 0).getTime() // 15 min early
    const now       = new Date(2026, 4, 15, 11, 45, 0)           // 30 min after actual

    const { currentLeg } = calculateTimeline(trip, {}, {}, now, true, startedAt)

    // Departure anchor must be actual (11:15), not planned (11:30)
    expect(currentLeg.departureTime.getHours()).toBe(11)
    expect(currentLeg.departureTime.getMinutes()).toBe(15)

    // Elapsed reflects physical travel time since actual departure
    const elapsed = elapsedMins(currentLeg.departureTime, now)
    expect(elapsed).toBe(30) // not 15 (from planned)
  })

  it('late departure: departureTime uses startedAt, not planned start', () => {
    // Planned 11:30, actual 12:00 — 30 min late.
    // At 12:30 the user has been traveling 30 min, not 60 min.
    const trip      = makeTrip({ startTime: '11:30' })
    const startedAt = new Date(2026, 4, 15, 12,  0, 0).getTime() // 30 min late
    const now       = new Date(2026, 4, 15, 12, 30, 0)           // 30 min after actual

    const { currentLeg } = calculateTimeline(trip, {}, {}, now, true, startedAt)

    // Departure anchor must be actual (12:00), not planned (11:30)
    expect(currentLeg.departureTime.getHours()).toBe(12)
    expect(currentLeg.departureTime.getMinutes()).toBe(0)

    // Elapsed reflects physical travel time since actual departure
    const elapsed = elapsedMins(currentLeg.departureTime, now)
    expect(elapsed).toBe(30) // not 60 (from planned)
  })

  it('no startedAt provided: falls back to trip.startTime', () => {
    // sessionIsActive=true but startedAt is null (edge case — guard regression)
    const trip = makeTrip({ startTime: '11:30' })
    const now  = new Date(2026, 4, 15, 12,  0, 0)

    const { currentLeg } = calculateTimeline(trip, {}, {}, now, true, null)

    expect(currentLeg.departureTime.getHours()).toBe(11)
    expect(currentLeg.departureTime.getMinutes()).toBe(30)
  })
})

// ============================================================
// What-if simulation — departure_deadline regression
// ============================================================
// Before the fix: simulateDelay modified plannedDuration/desiredDuration/duration
// on the target checkpoint. For DEPARTURE_DEADLINE, the engine ignores those fields —
// the departure time is fixed. So the simulation always returned an identical timeline,
// showing "No impact" at any delay value. Fix: add delay to the incoming travel leg
// so the estimated arrival shifts and the buffer shrinks correctly.
// ============================================================

describe('simulateDelay — departure_deadline', () => {
  it('reduces buffer by exactly extraMinutes (regression: was always showing no impact)', () => {
    // 11:30 departure, 60-min drive → 12:30 arrival at ferry.
    // Ferry departs 14:00, minimumBuffer=15 → latestSafeArrival=13:45 → buffer=75 min.
    // After +30m simulation: arrival=13:00, buffer=45 min (75-30).
    const trip = makeTrip({ startTime: '11:30', travelToFirst: 60 })
    const now  = new Date(2026, 4, 15, 11, 0, 0) // before departure

    const baseline  = calculateTimeline(trip, {}, {}, now, false, null)
    const simulated = simulateDelay(trip, 'cp1', 30, {}, {}, now, false, null)

    const baselineBuffer  = baseline.entries[0].bufferMinutes
    const simulatedBuffer = simulated.entries[0].bufferMinutes

    expect(baselineBuffer).toBe(75)
    expect(simulatedBuffer).toBe(45) // 75 - 30
  })

  it('deadline time itself is unchanged (ferry still departs at 14:00)', () => {
    const trip = makeTrip({ startTime: '11:30', travelToFirst: 60 })
    const now  = new Date(2026, 4, 15, 11, 0, 0)

    const simulated = simulateDelay(trip, 'cp1', 45, {}, {}, now, false, null)
    const entry = simulated.entries[0]

    expect(entry.deadlineTime.getHours()).toBe(14)
    expect(entry.deadlineTime.getMinutes()).toBe(0)
  })

  it('large delay tips status from ok to tight or at_risk', () => {
    // +90m pushes arrival to 13:00+30=14:00 start+90=13:30, buffer = 13:45-13:30 = 15 → tight
    const trip = makeTrip({ startTime: '11:30', travelToFirst: 60 })
    const now  = new Date(2026, 4, 15, 11, 0, 0)

    // +80m: arrival at 13:50, past latestSafeArrival 13:45 → at_risk
    const simulated = simulateDelay(trip, 'cp1', 80, {}, {}, now, false, null)

    expect(simulated.entries[0].bufferMinutes).toBeLessThan(0)
    expect(simulated.entries[0].status).toBe('at_risk')
  })

  it('legData travel time takes priority over travelTimeToFirst when present', () => {
    // If legData already has a travel time (e.g. from Maps), use that as the base, not origin.travelTimeToFirst
    const trip = makeTrip({ startTime: '11:30', travelToFirst: 60 })
    const now  = new Date(2026, 4, 15, 11, 0, 0)

    const legData = { 'origin_to_cp1': { travelTimeMinutes: 90 } } // Maps says 90 min, not 60
    const baseline  = calculateTimeline(trip, {}, legData, now, false, null)
    const simulated = simulateDelay(trip, 'cp1', 20, {}, legData, now, false, null)

    // baseline buffer: arrival at 13:00, latestSafe 13:45 → 45 min
    expect(baseline.entries[0].bufferMinutes).toBe(45)
    // simulated: arrival at 13:20, latestSafe 13:45 → 25 min
    expect(simulated.entries[0].bufferMinutes).toBe(25)
  })
})
