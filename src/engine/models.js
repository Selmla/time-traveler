// ============================================================
// TIME TRAVELER — Core Data Models
// ============================================================

/**
 * CheckpointKind
 * Each kind has distinct fields and distinct engine behavior.
 */
export const CHECKPOINT_KIND = {
  START:              'start',              // Trip origin — planned departure time
  END:                'end',               // Trip destination — optional target arrival
  NORMAL_STOP:        'normal_stop',       // Generic stop with optional planned arrival + duration
  FUEL_STOP:          'fuel_stop',         // Quick stop, short default duration
  DEPARTURE_DEADLINE: 'departure_deadline',// Any hard deadline: ferry, flight, train, hotel check-in, event…
  OPENING_HOURS:      'opening_hours',     // Museum/attraction — has open/close times
  FIXED_APPOINTMENT:  'fixed_appointment', // Restaurant booking, event, hotel check-in
}

export const DEPARTURE_MODE = {
  FERRY:  'ferry',
  TRAIN:  'train',
  FLIGHT: 'flight',
  BUS:    'bus',
  OTHER:  'other',
}

// Per-leg travel mode — how the traveler gets from one checkpoint to the next.
// Maps-API aligned: 'driving' covers car, motorcycle, van.
// Used by: checkpoint.travelModeToNext, trip.origin.travelModeToFirst, legData.mode, currentLeg.travelMode.
export const TRAVEL_MODE = {
  WALKING: 'walking',
  DRIVING: 'driving',
  CYCLING: 'cycling',
  TRANSIT: 'transit',
  UNKNOWN: 'unknown',  // default — show neutral "X min away", Maps picks best route
}

// Default arrival buffers by departure mode (minutes)
export const DEFAULT_BUFFERS = {
  ferry:  { preferred: 30, minimum: 15 },
  train:  { preferred: 20, minimum: 10 },
  flight: { preferred: 120, minimum: 90 },
  bus:    { preferred: 15, minimum: 5 },
  other:  { preferred: 30, minimum: 15 },
}

export const STATUS = {
  OK:        'ok',        // buffer > 20 min (green)
  TIGHT:     'tight',     // buffer 5–20 min (amber)
  AT_RISK:   'at_risk',   // buffer < 5 min or missed deadline (red)
  MISSED:    'missed',    // deadline passed (gray)
  COMPLETED: 'completed', // user has departed (blue)
  ARRIVED:   'arrived',   // user is at stop, hasn't departed
  SKIPPED:   'skipped',   // user skipped this stop
  PENDING:   'pending',   // not yet reached
}

// Structured warning types emitted by the engine.
// Each type carries only operational facts — no user-facing text.
// The presenter layer (warningCopy.js) converts these to profile-appropriate strings.
export const WARNING_TYPE = {
  WILL_MISS_DEPARTURE:  'WILL_MISS_DEPARTURE',  // ETA past latestSafeArrival for a departure
  TIGHT_ON_DEPARTURE:   'TIGHT_ON_DEPARTURE',   // ETA past preferredArrival but before latestSafeArrival
  ARRIVES_BEFORE_OPEN:  'ARRIVES_BEFORE_OPEN',  // ETA before opening time
  TOO_LATE_FOR_VISIT:   'TOO_LATE_FOR_VISIT',   // ETA past useful arrival cutoff for opening hours stop
  LATE_FOR_APPOINTMENT: 'LATE_FOR_APPOINTMENT', // ETA past arrival buffer for a fixed appointment
}

// Per-checkpoint session status (stored in activeSessionStore)
export const CHECKPOINT_SESSION_STATUS = {
  ARRIVED:   'arrived',   // user marked arrival, still at stop
  COMPLETED: 'completed', // user departed (stop done)
  SKIPPED:   'skipped',   // user skipped
}

export const TRIP_MODE = {
  ROAD_TRIP: 'road_trip',
  DAY_TRIP:  'day_trip',
}

export const TRIP_PROFILE = {
  ROADTRIP:     'roadtrip',
  CITY_TOURISM: 'city_tourism',
  CUSTOM:       'custom',
}

export const TRANSPORT_MODE = {
  CAR:        'car',
  MOTORCYCLE: 'motorcycle',
  TRANSIT:    'transit',
  WALKING:    'walking',
  CYCLING:    'cycling',
}

// ============================================================
// Factory functions
// Always use factories — never construct raw objects.
// ============================================================

export function createTrip(overrides = {}) {
  return {
    id:            generateId(),
    title:         'New Trip',
    date:          todayISO(),
    startTime:     '09:00',
    tripProfile:   TRIP_PROFILE.ROADTRIP,
    mode:          TRIP_MODE.ROAD_TRIP,
    transportMode: TRANSPORT_MODE.CAR,
    defaultBuffer: 15,
    minBuffer:     5,
    // Explicit trip origin — separate from the checkpoint list.
    // Provides the "from" context for the first leg and feeds Maps API in Phase 3.
    // Optional: old trips without this field fall back gracefully to trip.title.
    origin: {
      name:              '',
      address:           '',
      lat:               null,
      lng:               null,
      travelTimeToFirst: null, // minutes from origin to first checkpoint (persisted)
      travelModeToFirst: null, // TRAVEL_MODE for first leg (null = unknown)
    },
    checkpoints:   [],
    createdAt:     Date.now(),
    updatedAt:     Date.now(),
    ...overrides,
  }
}

export function createCheckpoint(overrides = {}) {
  const kind = overrides.kind || CHECKPOINT_KIND.NORMAL_STOP

  const base = {
    id:               generateId(),
    kind,
    name:             '',
    address:          '',
    lat:              null,
    lng:              null,
    notes:            '',
    travelTimeToNext: null, // minutes to next checkpoint (null = unknown/use Maps)
    travelModeToNext: null, // TRAVEL_MODE for this leg (null = unknown)
    isSkippable:      true,
  }

  switch (kind) {
    case CHECKPOINT_KIND.START:
      return {
        ...base,
        plannedDeparture: null, // HH:MM
        ...overrides,
      }

    case CHECKPOINT_KIND.END:
      return {
        ...base,
        plannedArrival: null, // HH:MM
        ...overrides,
      }

    case CHECKPOINT_KIND.FUEL_STOP:
      return {
        ...base,
        plannedArrival:  null, // HH:MM — optional
        plannedDuration: 15,   // minutes
        ...overrides,
      }

    case CHECKPOINT_KIND.DEPARTURE_DEADLINE: {
      const mode = overrides.departureMode || DEPARTURE_MODE.FERRY
      const buffers = DEFAULT_BUFFERS[mode]
      return {
        ...base,
        departureMode:       mode,
        departureTime:       null,            // HH:MM — the scheduled departure
        preferredBufferMins: buffers.preferred, // arrive this many minutes before
        minimumBufferMins:   buffers.minimum,   // absolute minimum before departure
        ...overrides,
      }
    }

    case CHECKPOINT_KIND.OPENING_HOURS:
      return {
        ...base,
        opensAt:         null, // HH:MM
        closesAt:        null, // HH:MM
        desiredDuration: 60,   // minutes — how long you want to stay
        minimumDuration: 30,   // minutes — below this, not worth going
        ...overrides,
      }

    case CHECKPOINT_KIND.FIXED_APPOINTMENT:
      return {
        ...base,
        appointmentTime:  null, // HH:MM — when the thing starts
        arrivalBuffer:    15,   // minutes before appointment to arrive
        duration:         60,   // minutes — how long it lasts
        ...overrides,
      }

    default: // NORMAL_STOP
      return {
        ...base,
        plannedArrival:  null, // HH:MM — optional
        plannedDuration: 30,   // minutes
        ...overrides,
      }
  }
}

// ============================================================
// Utilities
// ============================================================

/**
 * Stable leg identifier used as the key in session.legData.
 *   origin → first checkpoint   : makeLegId('origin', cpId)
 *   checkpoint → checkpoint     : makeLegId(cpId1, cpId2)
 */
export const makeLegId = (fromId, toId) => `${fromId}_to_${toId}`

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}
