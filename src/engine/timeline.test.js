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
import { calculateTimeline } from './timeline.js'
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
