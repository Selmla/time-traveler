import { parseTimeOnDate } from './time.js'

/**
 * Find the most imminent qualifying pre-departure trip.
 *
 * A trip qualifies when its planned departure time (trip.startTime on trip.date)
 * is strictly in the future relative to `now`. Among all qualifying trips, the one
 * with the soonest departure is returned.
 *
 * Returns null when no trips qualify (all past, empty array, or unparseable times).
 *
 * @param {Array}  trips - array of trip objects from the trip store
 * @param {Date}   now   - current wall-clock time (real, not trip.startTime)
 * @returns {object|null}
 */
export function findPreDepartureTrip(trips, now) {
  const candidates = trips
    .map(trip => ({
      trip,
      departureTime: parseTimeOnDate(trip.startTime, new Date(trip.date + 'T12:00:00')),
    }))
    .filter(({ departureTime }) => departureTime !== null && departureTime > now)
    .sort((a, b) => a.departureTime - b.departureTime)

  return candidates.length > 0 ? candidates[0].trip : null
}
