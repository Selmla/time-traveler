// ============================================================
// midnight.test.js
// Tests for trips that span midnight (depart evening, arrive next day).
// ============================================================

import { describe, it, expect } from 'vitest'
import { calculateTimeline } from './timeline.js'
import { CHECKPOINT_KIND } from './models.js'

// ============================================================
// Fixtures
// ============================================================

function makeMidnightFerryTrip({
  startTime      = '23:00',
  travelToFerry  = 90,          // minutes: 23:00 + 90 = 00:30 next day
  ferryTime      = '02:00',     // departure after midnight
  minBuffer      = 15,
} = {}) {
  return {
    id:           'overnight',
    title:        'Overnight Ferry',
    date:         '2026-05-15',
    startTime,
    defaultBuffer: 30,
    minBuffer:     5,
    origin: {
      name:              'Home',
      address:           '',
      travelTimeToFirst: travelToFerry,
    },
    checkpoints: [{
      id:                  'ferry',
      name:                'Ferry Terminal',
      kind:                CHECKPOINT_KIND.DEPARTURE_DEADLINE,
      departureTime:       ferryTime,
      minimumBufferMins:   minBuffer,
      preferredBufferMins: 30,
      isSkippable:         false,
    }],
  }
}

function makeTwoStopOvernightTrip({
  startTime      = '22:00',
  travelToStop1  = 60,   // → 23:00
  stop1Duration  = 90,   // → 00:30 next day
  travelToFerry  = 60,   // → 01:30
  ferryTime      = '03:00',
} = {}) {
  return {
    id:    'two-stop',
    title: 'Two-Stop Overnight',
    date:  '2026-05-15',
    startTime,
    defaultBuffer: 30,
    minBuffer:     5,
    origin: {
      name:              'Home',
      travelTimeToFirst: travelToStop1,
    },
    checkpoints: [
      {
        id:             'stop1',
        name:           'Midnight Diner',
        kind:           CHECKPOINT_KIND.NORMAL_STOP,
        plannedDuration: stop1Duration,
        travelTimeToNext: travelToFerry,
        isSkippable:    true,
      },
      {
        id:                  'ferry',
        name:                'Ferry Terminal',
        kind:                CHECKPOINT_KIND.DEPARTURE_DEADLINE,
        departureTime:       ferryTime,
        minimumBufferMins:   15,
        preferredBufferMins: 30,
        isSkippable:         false,
      },
    ],
  }
}

// ============================================================
// ETA propagation across midnight (travel times known)
// When addMinutes() carries runningTime past midnight,
// the refDate is on the correct next day — parsing is safe.
// ============================================================

describe('midnight crossing — ETA propagation via travel time', () => {
  it('ETA is on the next calendar day when travel carries past midnight', () => {
    // Depart 23:00, 90 min → ETA 00:30 on May 16
    const trip = makeMidnightFerryTrip({ startTime: '23:00', travelToFerry: 90 })
    const now  = new Date(2026, 4, 15, 23, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    const eta = entries[0].estimatedArrival

    expect(eta).not.toBeNull()
    expect(eta.getDate()).toBe(16)    // May 16, not May 15
    expect(eta.getHours()).toBe(0)
    expect(eta.getMinutes()).toBe(30)
  })

  it('deadlineTime is on the correct next-day calendar date', () => {
    // Ferry at 02:00; ETA 00:30 → refDate is May 16 → deadlineTime must be May 16 02:00
    const trip = makeMidnightFerryTrip({ startTime: '23:00', travelToFerry: 90, ferryTime: '02:00' })
    const now  = new Date(2026, 4, 15, 23, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    const deadline = entries[0].deadlineTime

    expect(deadline).not.toBeNull()
    expect(deadline.getDate()).toBe(16)   // May 16, not May 15
    expect(deadline.getHours()).toBe(2)
    expect(deadline.getMinutes()).toBe(0)
  })

  it('buffer is positive when ETA is well before ferry on the next day', () => {
    // ETA 00:30 May 16, ferry 02:00 May 16, minBuffer 15 → latestSafe 01:45 → buffer = 75 min
    const trip = makeMidnightFerryTrip({ startTime: '23:00', travelToFerry: 90, ferryTime: '02:00' })
    const now  = new Date(2026, 4, 15, 23, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    expect(entries[0].bufferMinutes).toBe(75)
  })

  it('buffer is not hugely negative when crossing midnight (regression guard)', () => {
    // A negative buffer in the thousands would indicate the deadline was placed on the wrong day
    const trip = makeMidnightFerryTrip({ startTime: '23:00', travelToFerry: 90, ferryTime: '02:00' })
    const now  = new Date(2026, 4, 15, 23, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    expect(entries[0].bufferMinutes).toBeGreaterThan(-60)
  })
})

// ============================================================
// Bug scenario: ETA before midnight, deadline string after midnight
// When runningTime is still on May 15 (e.g. 22:45) and the ferry
// time string is '00:30', parseTimeOnDate('00:30', May15-22:45)
// places the deadline on May 15 00:30 — seven hours in the past.
// Buffer becomes roughly -1350 min instead of +45 min.
// ============================================================

describe('midnight crossing — ETA before midnight, deadline after midnight', () => {
  it('deadlineTime is on May 16 when ETA is 22:45 May 15 and ferry is at 00:30', () => {
    // Depart 22:00, 45 min → ETA 22:45 May 15. Ferry at 00:30 (May 16).
    // refDate = 22:45 May 15 → parseTimeOnDate('00:30', that) naively gives May 15 00:30 (BUG)
    const trip = makeMidnightFerryTrip({ startTime: '22:00', travelToFerry: 45, ferryTime: '00:30' })
    const now  = new Date(2026, 4, 15, 22, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    const deadline = entries[0].deadlineTime

    expect(deadline).not.toBeNull()
    expect(deadline.getDate()).toBe(16)   // May 16, not May 15
    expect(deadline.getHours()).toBe(0)
    expect(deadline.getMinutes()).toBe(30)
  })

  it('buffer is positive when ETA 22:45 and ferry 00:30 next day', () => {
    // latestSafe = 00:15 May 16, ETA = 22:45 May 15 → buffer = 90 min
    const trip = makeMidnightFerryTrip({ startTime: '22:00', travelToFerry: 45, ferryTime: '00:30' })
    const now  = new Date(2026, 4, 15, 22, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    expect(entries[0].bufferMinutes).toBeGreaterThan(0)
  })

  it('buffer is not deeply negative (confirms deadline is not placed on wrong day)', () => {
    const trip = makeMidnightFerryTrip({ startTime: '22:00', travelToFerry: 45, ferryTime: '00:30' })
    const now  = new Date(2026, 4, 15, 22, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    expect(entries[0].bufferMinutes).toBeGreaterThan(-60)
  })
})

// ============================================================
// Two-stop trip crossing midnight
// Stop 1 departs before midnight, stop 2 (ferry) after midnight.
// Both ETAs and the ferry deadline must land on the correct day.
// ============================================================

describe('midnight crossing — two stops, second stop after midnight', () => {
  it('stop 1 ETA is before midnight', () => {
    // 22:00 + 60 min = 23:00 May 15
    const trip = makeTwoStopOvernightTrip()
    const now  = new Date(2026, 4, 15, 22, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    expect(entries[0].estimatedArrival.getDate()).toBe(15)
    expect(entries[0].estimatedArrival.getHours()).toBe(23)
  })

  it('ferry ETA is after midnight on the next day', () => {
    // 23:00 + 90 min stay + 60 min travel = 00:30 + 60 = 01:30 May 16
    const trip = makeTwoStopOvernightTrip()
    const now  = new Date(2026, 4, 15, 22, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    const ferryEta = entries[1].estimatedArrival

    expect(ferryEta.getDate()).toBe(16)
    expect(ferryEta.getHours()).toBe(1)
    expect(ferryEta.getMinutes()).toBe(30)
  })

  it('ferry deadlineTime is on May 16', () => {
    const trip = makeTwoStopOvernightTrip({ ferryTime: '03:00' })
    const now  = new Date(2026, 4, 15, 22, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    expect(entries[1].deadlineTime.getDate()).toBe(16)
    expect(entries[1].deadlineTime.getHours()).toBe(3)
  })

  it('buffer is positive when ferry has comfortable margin', () => {
    // ETA to ferry 01:30, ferry 03:00, minBuffer 15 → latestSafe 02:45 → buffer = 75 min
    const trip = makeTwoStopOvernightTrip({ ferryTime: '03:00' })
    const now  = new Date(2026, 4, 15, 22, 0, 0)

    const { entries } = calculateTimeline(trip, {}, {}, now, false, null)
    expect(entries[1].bufferMinutes).toBe(75)
  })
})
