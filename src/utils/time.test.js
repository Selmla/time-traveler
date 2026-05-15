// ============================================================
// time.js unit tests — focus on timezone-safe date parsing
// ============================================================
// Run with: npm test
// ============================================================

import { describe, it, expect } from 'vitest'
import { parseTime, parseTimeOnDate } from './time.js'

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
