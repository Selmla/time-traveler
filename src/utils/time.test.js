// ============================================================
// time.js unit tests — focus on timezone-safe date parsing
// ============================================================
// Run with: npm test
// ============================================================

import { describe, it, expect } from 'vitest'
import { parseTime, parseTimeOnDate, formatCountdown } from './time.js'

// ============================================================
// parseTimeOnDate — regression tests for UTC-negative offset bug
// ============================================================

describe('parseTimeOnDate', () => {
  it('sets HH:MM on the same local calendar date as the reference', () => {
    // new Date(year, month, day, ...) always uses local time — timezone-agnostic
    const ref = new Date(2026, 4, 15, 0, 54, 0)  // May 15 00:54 local
    const result = parseTimeOnDate('02:55', ref)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(4)    // May (0-indexed)
    expect(result.getDate()).toBe(15)    // stays on May 15, not May 14
    expect(result.getHours()).toBe(2)
    expect(result.getMinutes()).toBe(55)
  })

  it('midnight crossing: reference just past midnight keeps deadline on the same day', () => {
    // The key midnight-rollover regression: trip departs 23:39, ferry at 02:55 next day.
    // After adding 75 min travel, runningTime = 00:54 on May 15.
    // parseTimeOnDate must place '02:55' on May 15, not May 14.
    const runningTime = new Date(2026, 4, 15, 0, 54, 0)  // May 15 00:54
    const ferry = parseTimeOnDate('02:55', runningTime)
    expect(ferry.getDate()).toBe(15)   // May 15, not May 14
    expect(ferry.getHours()).toBe(2)
    expect(ferry.getMinutes()).toBe(55)
    // Buffer = ferry - runningTime should be ~121 minutes, not negative ~-1319
    const bufferMin = Math.round((ferry - runningTime) / 60000)
    expect(bufferMin).toBe(121)
  })

  it('does not shift the date for a late-in-the-day reference', () => {
    const ref = new Date(2026, 4, 15, 23, 30, 0)  // May 15 23:30 local
    const result = parseTimeOnDate('02:00', ref)
    // 02:00 set on the May 15 reference → May 15 02:00 (NOT May 16)
    expect(result.getDate()).toBe(15)
    expect(result.getHours()).toBe(2)
  })

  it('returns null for missing inputs', () => {
    expect(parseTimeOnDate(null, new Date())).toBe(null)
    expect(parseTimeOnDate('02:55', null)).toBe(null)
    expect(parseTimeOnDate(undefined, new Date())).toBe(null)
  })

  it('returns null for malformed time string', () => {
    expect(parseTimeOnDate('not-a-time', new Date())).toBe(null)
  })
})

// ============================================================
// parseTime — documents the UTC-midnight string behavior
// The tests below illustrate WHY parseTimeOnDate is preferred
// for cases where the correct local calendar date matters.
// ============================================================

// ============================================================
// formatCountdown
// ============================================================

describe('formatCountdown', () => {
  it('shows "in X min" for minutes under an hour', () => {
    expect(formatCountdown(26)).toBe('in 26 min')
    expect(formatCountdown(1)).toBe('in 1 min')
    expect(formatCountdown(59)).toBe('in 59 min')
  })

  it('shows hours only when no remainder', () => {
    expect(formatCountdown(60)).toBe('in 1h')
    expect(formatCountdown(120)).toBe('in 2h')
  })

  it('shows hours and minutes when remainder', () => {
    expect(formatCountdown(90)).toBe('in 1h 30m')
    expect(formatCountdown(65)).toBe('in 1h 5m')
  })

  it('shows "depart now" at 0', () => {
    expect(formatCountdown(0)).toBe('depart now')
    expect(formatCountdown(-0)).toBe('depart now')
  })

  it('shows "X min ago" for negative (overdue)', () => {
    expect(formatCountdown(-1)).toBe('1 min ago')
    expect(formatCountdown(-26)).toBe('26 min ago')
  })

  it('rounds fractional minutes', () => {
    expect(formatCountdown(26.4)).toBe('in 26 min')
    expect(formatCountdown(26.6)).toBe('in 27 min')
    expect(formatCountdown(-0.3)).toBe('depart now')
  })
})

describe('parseTime (string-based)', () => {
  it('parses HH:MM + YYYY-MM-DD into a Date', () => {
    const result = parseTime('14:30', '2026-05-15')
    // 14:30 is unambiguous (well inside any UTC offset range)
    expect(result.getHours()).toBe(14)
    expect(result.getMinutes()).toBe(30)
  })

  it('is safe for UTC+N timezones when given a valid date string', () => {
    // UTC+2 (CEST): new Date('2026-05-15') = May 15 02:00 local → setHours(2,55) stays May 15 ✓
    // This test runs correctly in any UTC+ timezone.
    const result = parseTime('14:00', '2026-05-15')
    expect(result.getHours()).toBe(14)
  })
})
