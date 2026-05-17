// ============================================================
// preDeparture.test.js
// Regression tests for pre-departure trip selection logic.
// ============================================================

import { describe, it, expect } from 'vitest'
import { findPreDepartureTrip } from './preDeparture.js'

function makeTrip(id, date, startTime) {
  return { id, date, startTime, checkpoints: [] }
}

// All wall-clock times use May 17 2026 (a Sunday) as the anchor date.
// 'now' is 14:00 local unless noted.
const NOW = new Date(2026, 4, 17, 14, 0, 0)  // May 17 2026 14:00 local

describe('findPreDepartureTrip — selection logic', () => {
  it('returns null for an empty trip list', () => {
    expect(findPreDepartureTrip([], NOW)).toBeNull()
  })

  it('returns null when the only trip departure has already passed today', () => {
    const past = makeTrip('t1', '2026-05-17', '09:00')
    expect(findPreDepartureTrip([past], NOW)).toBeNull()
  })

  it('returns null when the departure is exactly at now (not strictly future)', () => {
    const exact = makeTrip('t1', '2026-05-17', '14:00')
    expect(findPreDepartureTrip([exact], NOW)).toBeNull()
  })

  it('returns a trip whose departure is 1 minute in the future', () => {
    const trip = makeTrip('t1', '2026-05-17', '14:01')
    expect(findPreDepartureTrip([trip], NOW)).toBe(trip)
  })

  it('returns a qualifying trip when departure is 2 hours away', () => {
    const trip = makeTrip('t1', '2026-05-17', '16:00')
    expect(findPreDepartureTrip([trip], NOW)).toBe(trip)
  })

  it('returns a trip scheduled for tomorrow', () => {
    const trip = makeTrip('t1', '2026-05-18', '09:00')
    expect(findPreDepartureTrip([trip], NOW)).toBe(trip)
  })

  it('ignores the past trip and returns the future one', () => {
    const past   = makeTrip('past',   '2026-05-17', '10:00')
    const future = makeTrip('future', '2026-05-17', '16:00')
    const result = findPreDepartureTrip([past, future], NOW)
    expect(result?.id).toBe('future')
  })

  it('returns the most imminent trip when multiple qualify', () => {
    const later   = makeTrip('later',   '2026-05-17', '18:00')
    const earlier = makeTrip('earlier', '2026-05-17', '16:00')
    const result  = findPreDepartureTrip([later, earlier], NOW)
    expect(result?.id).toBe('earlier')
  })

  it('input order does not affect which trip is selected', () => {
    const a = makeTrip('a', '2026-05-17', '17:00')
    const b = makeTrip('b', '2026-05-17', '16:00')
    const c = makeTrip('c', '2026-05-17', '18:00')

    // b has the earliest future departure regardless of list order
    expect(findPreDepartureTrip([a, b, c], NOW)?.id).toBe('b')
    expect(findPreDepartureTrip([c, a, b], NOW)?.id).toBe('b')
  })

  it('prefers same-day trip over next-day trip when both qualify', () => {
    const today    = makeTrip('today',    '2026-05-17', '16:00')
    const tomorrow = makeTrip('tomorrow', '2026-05-18', '09:00')
    const result   = findPreDepartureTrip([today, tomorrow], NOW)
    expect(result?.id).toBe('today')
  })
})

// ============================================================
// Countdown arithmetic (pure math, no component needed)
// ============================================================

describe('countdown minutes arithmetic', () => {
  it('is positive when departure is in the future', () => {
    const departure = new Date(2026, 4, 17, 16, 0, 0)
    const mins = Math.round((departure - NOW) / 60000)
    expect(mins).toBe(120)
  })

  it('is zero when departure equals now', () => {
    const mins = Math.round((NOW - NOW) / 60000)
    expect(mins).toBe(0)
  })

  it('is negative when departure is in the past', () => {
    const past = new Date(2026, 4, 17, 13, 0, 0)
    const mins = Math.round((past - NOW) / 60000)
    expect(mins).toBe(-60)
  })
})

// ============================================================
// Pre-departure → active transition (store-level contract)
// ============================================================
// The gate is: when isRunning === true, ActiveDashboard renders
// and PreDepartureCard does not. This is a NowScreen conditional
// render (not unit-testable without React), so we test the
// precondition: findPreDepartureTrip behavior is unaffected by
// whether isRunning is set — NowScreen is responsible for the gate.
// A trip that qualifies by time still qualifies here; the screen
// guards against showing it when isRunning is true.

describe('transition contract (pre-departure → active)', () => {
  it('findPreDepartureTrip returns a trip regardless of running state — screen owns the gate', () => {
    // Confirms: if we accidentally call findPreDepartureTrip when a session is running,
    // it would still return a qualifying trip. The gate lives in NowScreen, not here.
    const trip = makeTrip('t1', '2026-05-17', '16:00')
    // Both before and after isRunning changes, the function returns the same result.
    // NowScreen guards: if (isRunning && activeTripId) return <ActiveDashboard>
    expect(findPreDepartureTrip([trip], NOW)?.id).toBe('t1')
  })
})
