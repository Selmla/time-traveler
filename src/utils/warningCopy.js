import { TRIP_PROFILE, WARNING_TYPE, CHECKPOINT_KIND, STATUS } from '../engine/models.js'
import { formatTime } from './time.js'

/**
 * Convert a structured engine warning into a profile-appropriate display string.
 * Returns null for unrecognised warning types (caller should filter).
 *
 * @param {{ type: string, [key: string]: any }} warning  - raw warning from entry.warnings
 * @param {string} profile  - TRIP_PROFILE value
 * @returns {string | null}
 */
export function renderWarning(warning, profile) {
  if (!warning?.type) return null
  const city = profile === TRIP_PROFILE.CITY_TOURISM

  switch (warning.type) {
    case WARNING_TYPE.WILL_MISS_DEPARTURE: {
      const { overByMins, departureMode } = warning
      return city
        ? `You may miss this ${departureMode} — arriving ${overByMins}m past the safe window`
        : `ETA is ${overByMins}m past the safe arrival cutoff — ${departureMode} at risk`
    }

    case WARNING_TYPE.TIGHT_ON_DEPARTURE: {
      const { diffMins } = warning
      return city
        ? `Arriving a little later than ideal — slightly less time to settle in`
        : `Arriving ${diffMins}m later than preferred — less time to spare than planned`
    }

    case WARNING_TYPE.ARRIVES_BEFORE_OPEN: {
      const { opensAt } = warning
      return `You'll arrive before it opens (opens ${opensAt})`
    }

    case WARNING_TYPE.TOO_LATE_FOR_VISIT: {
      const { closesAt } = warning
      return city
        ? `Arriving too late to enjoy a full visit — closes at ${closesAt}`
        : `Arriving too late for a worthwhile stop — closes at ${closesAt}`
    }

    case WARNING_TYPE.LATE_FOR_APPOINTMENT: {
      const { overByMins } = warning
      return city
        ? `Running ${overByMins}m late for your reservation`
        : `Running ${overByMins}m late for your appointment`
    }

    default:
      return null
  }
}

/**
 * Convert a consequence fact object into profile-appropriate display lines.
 * Returns { headlineLine, contextLine } or null if consequence is null.
 *
 * headlineLine — short, scannable urgency signal
 * contextLine  — supporting context (which stop, what deadline)
 *
 * @param {object | null} consequence  - from timeline.consequence
 * @param {string} profile             - TRIP_PROFILE value
 * @returns {{ headlineLine: string, contextLine: string } | null}
 */
export function renderConsequence(consequence, profile) {
  if (!consequence) return null
  const city = profile === TRIP_PROFILE.CITY_TOURISM
  const { affectedName, affectedKind, affectedDeadline, departureMode, bufferMins, severity, context } = consequence

  // Label for the type of deadline — used in operational (roadtrip) wording
  const kindLabel = affectedKind === CHECKPOINT_KIND.DEPARTURE_DEADLINE
    ? (departureMode || 'departure')
    : city ? 'reservation' : 'appointment'

  // "14:30 ferry" or just "ferry" when no time
  const timeStr       = affectedDeadline ? formatTime(affectedDeadline) : null
  const labelWithTime = timeStr ? `${timeStr} ${kindLabel}` : kindLabel

  if (context === 'arrived') {
    switch (severity) {
      case STATUS.OK:
        return city
          ? { headlineLine: `About ${bufferMins} more minutes here`,
              contextLine:   `before ${affectedName} is affected` }
          : { headlineLine: `About ${bufferMins} more minutes here`,
              contextLine:   `without affecting the ${kindLabel}` }

      case STATUS.TIGHT:
        return city
          ? { headlineLine: `Start wrapping up`,
              contextLine:   `${affectedName} has ${bufferMins} minutes of buffer` }
          : { headlineLine: `Leave within ${bufferMins} minutes`,
              contextLine:   `to keep the ${labelWithTime} safe` }

      case STATUS.AT_RISK:
        return city
          ? { headlineLine: `Time to head out`,
              contextLine:   `${affectedName} is getting tight` }
          : { headlineLine: `Leave soon`,
              contextLine:   `no time left for the ${kindLabel}` }

      case STATUS.MISSED:
        return city
          ? { headlineLine: `${affectedName} has passed`,
              contextLine:   `consider adjusting your plans` }
          : { headlineLine: `${affectedName} has been missed`,
              contextLine:   `consider adjusting the plan` }

      default:
        return null
    }
  }

  if (context === 'traveling') {
    switch (severity) {
      case STATUS.OK:
        return city
          ? { headlineLine: `${bufferMins} minutes of buffer`,
              contextLine:   `before ${affectedName} is affected` }
          : { headlineLine: `${bufferMins} minutes of buffer`,
              contextLine:   `at the ${labelWithTime}` }

      case STATUS.TIGHT:
        return city
          ? { headlineLine: `${bufferMins} minutes of buffer remaining`,
              contextLine:   `${affectedName} is getting close` }
          : { headlineLine: `${bufferMins} minutes of buffer remaining`,
              contextLine:   `at the ${labelWithTime}` }

      case STATUS.AT_RISK:
        return city
          ? { headlineLine: `Running very tight`,
              contextLine:   `${affectedName} may be affected — consider adjusting your plans` }
          : { headlineLine: `Running out of time`,
              contextLine:   `${labelWithTime} is at risk — consider adjusting the plan` }

      case STATUS.MISSED:
        return city
          ? { headlineLine: `${affectedName} has passed`,
              contextLine:   `consider adjusting your plans` }
          : { headlineLine: `${affectedName} has been missed`,
              contextLine:   `consider adjusting the plan` }

      default:
        return null
    }
  }

  return null
}
