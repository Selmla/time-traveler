// ============================================================
// TIME UTILITIES
// ============================================================
// All time manipulation goes here. The engine uses these.
// Rule: store times as HH:MM strings or Date objects.
// Never store timestamps directly in trip data.
// ============================================================

/**
 * Parse "HH:MM" + date string into a Date object.
 * @param {string} timeStr  - "HH:MM"
 * @param {string} dateStr  - "YYYY-MM-DD"
 * @returns {Date}
 */
export function parseTime(timeStr, dateStr) {
  if (!timeStr || !dateStr) return null
  const [hours, minutes] = timeStr.split(':').map(Number)
  const date = new Date(dateStr)
  date.setHours(hours, minutes, 0, 0)
  return date
}

/**
 * Format a Date to "HH:MM"
 * @param {Date} date
 * @returns {string}
 */
export function formatTime(date) {
  if (!date) return '--:--'
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

/**
 * Format a Date to "HH:MM" with optional relative indicator
 * @param {Date} date
 * @param {Date} reference  - compared against
 * @returns {{ time: string, delta: number }}  delta in minutes
 */
export function formatTimeWithDelta(date, reference) {
  if (!date) return { time: '--:--', delta: 0 }
  const time = formatTime(date)
  const delta = reference
    ? Math.round((date - reference) / 60000)
    : 0
  return { time, delta }
}

/**
 * Parse "HH:MM" onto the local calendar date of a reference Date object.
 * Safer than parseTime() for midnight-crossing trips and negative UTC offsets:
 * parseTime() uses new Date("YYYY-MM-DD") which is UTC midnight and places the
 * result on the wrong local day in UTC-X timezones. This function takes a Date
 * reference so it always stays on the correct local calendar day.
 * @param {string} timeStr  - "HH:MM"
 * @param {Date}   refDate  - anchor date whose local calendar date is preserved
 * @returns {Date|null}
 */
export function parseTimeOnDate(timeStr, refDate) {
  if (!timeStr || !refDate) return null
  const [hours, minutes] = timeStr.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return null
  const d = new Date(refDate)
  d.setHours(hours, minutes, 0, 0)
  return d
}

/**
 * Add minutes to a Date, returning a new Date.
 * @param {Date} date
 * @param {number} minutes
 * @returns {Date}
 */
export function addMinutes(date, minutes) {
  if (!date) return null
  return new Date(date.getTime() + minutes * 60000)
}

/**
 * Difference between two dates in minutes.
 * Positive if b > a (b is later).
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */
export function diffMinutes(a, b) {
  if (!a || !b) return 0
  return Math.round((b - a) / 60000)
}

/**
 * Format a minute count as human-readable duration.
 * 75 → "1h 15m"
 * 45 → "45m"
 * -10 → "-10m"
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (minutes === null || minutes === undefined) return '--'
  const abs = Math.abs(minutes)
  const sign = minutes < 0 ? '-' : ''
  if (abs < 60) return `${sign}${abs}m`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h ${m}m`
}

/**
 * Format buffer minutes for display.
 * Positive buffer → "+15m buffer"
 * Negative buffer → "12m overdue"
 * @param {number} minutes
 * @returns {{ label: string, isOver: boolean }}
 */
export function formatBuffer(minutes) {
  if (minutes === null || minutes === undefined) return { label: '--', isOver: false }
  if (minutes >= 0) {
    return { label: `+${formatDuration(minutes)}`, isOver: false }
  }
  return { label: `${formatDuration(minutes)} over`, isOver: true }
}

/**
 * Parse HH:MM string into { hours, minutes }
 * @param {string} timeStr
 * @returns {{ hours: number, minutes: number } | null}
 */
export function parseHHMM(timeStr) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return { hours: h, minutes: m }
}

/**
 * Convert { hours, minutes } to HH:MM string
 */
export function toHHMM(hours, minutes) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

/**
 * Extract local calendar date from a Date object as "YYYY-MM-DD".
 * Uses local time (getFullYear/Month/Date), NOT toISOString() which is UTC
 * and would return the wrong date in timezones behind UTC.
 * @param {Date} date
 * @returns {string}
 */
export function toLocalISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Format date for display: "Mon 12 Jan"
 */
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Is a time string in the past relative to now?
 */
export function isInPast(timeStr, dateStr) {
  const t = parseTime(timeStr, dateStr)
  if (!t) return false
  return t < new Date()
}

/**
 * Minutes until a given time (negative if past)
 */
export function minutesUntil(timeStr, dateStr) {
  const t = parseTime(timeStr, dateStr)
  if (!t) return null
  return diffMinutes(new Date(), t)
}
