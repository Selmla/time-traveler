// ============================================================
// TIMELINE ENGINE
// ============================================================
// Pure function. No side effects. No React. No stores.
// Same input always produces same output.
// ============================================================

import { CHECKPOINT_KIND, STATUS, WARNING_TYPE, makeLegId } from './models.js'
import { parseTimeOnDate, addMinutes, diffMinutes } from '../utils/time.js'

// ============================================================
// MAIN EXPORT
// ============================================================

export function calculateTimeline(trip, sessionData = {}, legData = {}, now = new Date(), sessionIsActive = false, startedAt = null) {
  if (!trip || !trip.checkpoints || trip.checkpoints.length === 0) {
    return emptyResult()
  }

  const entries = []
  const plannedStart = parseTimeOnDate(trip.startTime, new Date(trip.date + 'T12:00:00'))

  // Effective departure baseline: planned start time by default.
  // When the session is active and the rider actually left LATER than planned,
  // advance the baseline to startedAt so downstream ETAs reflect reality.
  // If startedAt is earlier than planned (pre-configured session, early departure),
  // keep the planned time — conservative and correct for deadline math.
  let runningTime = plannedStart || now
  if (sessionIsActive && startedAt) {
    const actualStart = new Date(startedAt)
    if (!plannedStart || actualStart > plannedStart) {
      runningTime = actualStart
    }
  }

  // First leg: origin → first checkpoint.
  // START kind = the checkpoint IS the departure point; its "arrival" is startTime.
  // All other kinds = the checkpoint is a destination; we need real travel time.
  // If no travel time is known, set runningTime to null so the ETA is uncertain
  // (honest) rather than showing trip.startTime as a fake arrival time.
  const firstCp = trip.checkpoints[0]
  if (firstCp) {
    if (firstCp.kind === CHECKPOINT_KIND.START) {
      // Departure point — runningTime stays at startTime, no travel needed
    } else {
      const firstLeg     = legData[makeLegId('origin', firstCp.id)]
      const firstLegTime = firstLeg?.travelTimeMinutes      // session / Maps (highest priority)
                        ?? trip.origin?.travelTimeToFirst   // persisted manual entry
                        ?? null
      if (firstLegTime != null) {
        runningTime = addMinutes(runningTime, firstLegTime)
      } else {
        runningTime = null // first-leg travel time unknown → ETA is uncertain
      }
    }
  }

  for (let i = 0; i < trip.checkpoints.length; i++) {
    const cp      = trip.checkpoints[i]
    const session = sessionData[cp.id] || {}
    const entry   = buildEntry(cp, i, runningTime, trip, session)
    entries.push(entry)

    // Outgoing leg: from cp[i] to cp[i+1], used to compute the next runningTime
    const nextCp = trip.checkpoints[i + 1]
    const outLeg = nextCp ? (legData[makeLegId(cp.id, nextCp.id)] || null) : null
    runningTime = advanceRunningTime(entry, cp, outLeg)
  }

  calculateBuffers(entries)
  assignStatuses(entries, trip, now)
  generateWarnings(entries, trip)

  const nextStop = getNextStop(entries, now, sessionIsActive)

  return {
    entries,
    startEntry:      buildStartEntry(trip),
    tripStatus:      calculateTripStatus(entries),
    mostUrgentAlert: getMostUrgentAlert(entries),
    nextStop,
    nextCheckpoint:  nextStop,   // backward-compat alias — consumers migrate to nextStop
    nextCritical:    getNextCritical(entries),
    currentLeg:      getCurrentLeg(entries, trip, now, legData, sessionIsActive, startedAt),
    totalBufferMins: getTotalBuffer(entries),
    consequence:     getConsequence(entries, trip, sessionIsActive),
  }
}

// ============================================================
// ENTRY BUILDER
// ============================================================

function buildEntry(cp, index, runningTime, trip, session) {
  // Use runningTime as the date anchor so midnight-crossing trips place deadline times
  // on the correct local calendar day. Noon fallback avoids new Date("YYYY-MM-DD")
  // UTC-midnight parsing which would land on the wrong local day for UTC-X timezones.
  const refDate = runningTime ?? new Date(trip.date + 'T12:00:00')
  const kind = cp.kind || CHECKPOINT_KIND.NORMAL_STOP

  // Session status set by the user
  const sessionStatus = session.status || null  // 'arrived' | 'completed' | 'skipped' | null

  // For skipped stops: no timing needed — return a minimal entry immediately
  if (sessionStatus === 'skipped') {
    return {
      checkpointId:   cp.id,
      checkpointName: cp.name,
      kind,
      type:           kind,
      isFixed:        kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE || kind === CHECKPOINT_KIND.FIXED_APPOINTMENT,
      isSkippable:    cp.isSkippable ?? true,
      sessionStatus,

      plannedArrival:     null,
      estimatedArrival:   runningTime,
      actualArrival:      null,
      estimatedDeparture: runningTime, // zero stop time when skipped
      actualDeparture:    null,

      latestSafeArrival: null,
      recommendedArrival: null,
      deadlineTime:       null,

      travelTimeToNext: cp.travelTimeToNext ?? null,
      bufferMinutes:    null,
      status:           STATUS.SKIPPED,
      warnings:         [],
      delay:            0,
    }
  }

  // Actual times confirmed by user (HH:MM strings in session → Date objects)
  const actualArrival   = session.actualArrivalTime   ? parseTimeOnDate(session.actualArrivalTime,   refDate) : null
  const actualDeparture = session.actualDepartureTime ? parseTimeOnDate(session.actualDepartureTime, refDate) : null

  // Extra delay minutes recorded by user while at this stop
  const extraDelay = session.delayMinutes || 0

  // Estimated arrival: actual recorded time > runningTime derived from legData + travelTimeToNext
  // runningTime is null when the incoming leg has no travel time data at all.
  const estimatedArrival = actualArrival ?? runningTime

  // etaUncertain: we have no data source for this checkpoint's ETA
  const etaUncertain = estimatedArrival === null

  // Kind-specific computed times
  let plannedArrival     = null
  let estimatedDeparture = null
  let latestSafeArrival  = null
  let recommendedArrival = null
  let deadlineTime       = null

  if (kind === CHECKPOINT_KIND.START) {
    const plannedDep = cp.plannedDeparture ? parseTimeOnDate(cp.plannedDeparture, refDate) : null
    estimatedDeparture = actualDeparture || plannedDep || estimatedArrival

  } else if (kind === CHECKPOINT_KIND.END) {
    plannedArrival     = cp.plannedArrival ? parseTimeOnDate(cp.plannedArrival, refDate) : null
    estimatedDeparture = null

  } else if (kind === CHECKPOINT_KIND.NORMAL_STOP || kind === CHECKPOINT_KIND.FUEL_STOP) {
    plannedArrival     = cp.plannedArrival ? parseTimeOnDate(cp.plannedArrival, refDate) : null
    const stayDuration = (cp.plannedDuration || 0) + extraDelay
    estimatedDeparture = actualDeparture || addMinutes(estimatedArrival, stayDuration)

  } else if (kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE) {
    const depTime = cp.departureTime ? parseTimeOnDate(cp.departureTime, refDate) : null
    deadlineTime       = depTime
    estimatedDeparture = depTime // ferry/train/flight departs at fixed time regardless
    if (depTime) {
      latestSafeArrival  = addMinutes(depTime, -(cp.minimumBufferMins  || 15))
      const preferredBuf = cp.preferredBufferMins != null ? cp.preferredBufferMins : (trip.defaultBuffer ?? 30)
      recommendedArrival = addMinutes(depTime, -preferredBuf)
      plannedArrival     = recommendedArrival
    }

  } else if (kind === CHECKPOINT_KIND.OPENING_HOURS) {
    const opensAt  = cp.opensAt  ? parseTimeOnDate(cp.opensAt,  refDate) : null
    const closesAt = cp.closesAt ? parseTimeOnDate(cp.closesAt, refDate) : null
    plannedArrival = opensAt
    deadlineTime   = closesAt
    if (closesAt) {
      latestSafeArrival = addMinutes(closesAt, -(cp.minimumDuration || 30))
    }
    // Visitor cannot enter before the place opens. If arrival is before opensAt,
    // the visit begins at opensAt — arrival is recorded but stay duration starts later.
    const effectiveEntry = (opensAt && estimatedArrival && estimatedArrival < opensAt)
      ? opensAt
      : estimatedArrival
    const stayDuration = (cp.desiredDuration || 60) + extraDelay
    const desiredEnd  = addMinutes(effectiveEntry, stayDuration)
    const closesSoon  = closesAt ? addMinutes(closesAt, -5) : null
    estimatedDeparture = actualDeparture || (
      closesSoon && desiredEnd > closesSoon ? closesSoon : desiredEnd
    )

  } else if (kind === CHECKPOINT_KIND.FIXED_APPOINTMENT) {
    const apptTime = cp.appointmentTime ? parseTimeOnDate(cp.appointmentTime, refDate) : null
    deadlineTime   = apptTime
    if (apptTime) {
      latestSafeArrival  = addMinutes(apptTime, -(cp.arrivalBuffer || 15))
      recommendedArrival = latestSafeArrival
      plannedArrival     = latestSafeArrival
    }
    const stayDuration = (cp.duration || 60) + extraDelay
    estimatedDeparture = actualDeparture || (
      apptTime
        ? addMinutes(apptTime, stayDuration)
        : addMinutes(estimatedArrival, stayDuration)
    )
  }

  // For departure deadlines, delay > 0 should only fire when the rider is past the
  // hard safety cutoff (latestSafeArrival), not merely past the comfort buffer
  // (recommendedArrival). Using recommendedArrival as the baseline produces "+2m late"
  // when 13m of real buffer remains, which damages trust on rides where the buffer matters.
  const delayBaseline = kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE
    ? latestSafeArrival   // null when no departure time → delay stays 0
    : plannedArrival

  return {
    checkpointId:   cp.id,
    checkpointName: cp.name,
    kind,
    type:           kind, // alias kept for backward compat in display components
    isFixed:        kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE || kind === CHECKPOINT_KIND.FIXED_APPOINTMENT,
    isSkippable:    cp.isSkippable ?? true,
    sessionStatus,

    plannedArrival,
    estimatedArrival,
    actualArrival,

    estimatedDeparture,
    actualDeparture,

    // Deadline-specific times for display
    latestSafeArrival,
    recommendedArrival,
    deadlineTime,

    travelTimeToNext: cp.travelTimeToNext ?? null,
    etaUncertain,
    bufferMinutes:    0,   // filled in second pass
    status:           STATUS.PENDING,
    warnings:         [],

    delay: delayBaseline && estimatedArrival
      ? diffMinutes(delayBaseline, estimatedArrival)
      : 0,
  }
}

// ============================================================
// RUNNING TIME ADVANCEMENT
// ============================================================

// outLeg: legData entry for the leg FROM cp to the next checkpoint (may be null).
// Priority: legData.travelTimeMinutes (maps or manual) > cp.travelTimeToNext > unknown.
function advanceRunningTime(entry, cp, outLeg = null) {
  const base = entry.estimatedDeparture || entry.estimatedArrival
  if (!base) return null
  const travel = outLeg?.travelTimeMinutes ?? cp.travelTimeToNext ?? null
  if (travel === null) return null
  return addMinutes(base, travel)
}

// ============================================================
// BUFFER CALCULATION (Second Pass)
// Walk backwards to find the next deadline for each entry.
// Skipped entries don't contribute to or receive buffers.
// ============================================================

function calculateBuffers(entries) {
  let nextDeadlineEntry = null

  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]

    if (entry.status === STATUS.SKIPPED) {
      entry.bufferMinutes = null
      continue
    }

    // Completed/arrived stops are resolved — don't let them set nextDeadlineEntry
    // and don't assign them a buffer (their deadline is already done).
    if (entry.sessionStatus === 'completed' || entry.sessionStatus === 'arrived') {
      entry.bufferMinutes = null
      continue
    }

    if (entry.deadlineTime && entry.estimatedArrival) {
      const safeBy = entry.latestSafeArrival || entry.deadlineTime
      entry.bufferMinutes = diffMinutes(entry.estimatedArrival, safeBy)
      nextDeadlineEntry = entry
    } else if (nextDeadlineEntry && entry.estimatedArrival) {
      const safeBy = nextDeadlineEntry.latestSafeArrival || nextDeadlineEntry.deadlineTime
      entry.bufferMinutes = safeBy ? diffMinutes(entry.estimatedArrival, safeBy) : null
    } else {
      entry.bufferMinutes = null
    }
  }
}

// ============================================================
// STATUS ASSIGNMENT (Third Pass)
// Session status takes priority over buffer-based status.
// ============================================================

function assignStatuses(entries, trip, now) {
  for (const entry of entries) {
    // Skipped: already set in buildEntry
    if (entry.status === STATUS.SKIPPED) continue

    // Session-confirmed states
    if (entry.sessionStatus === 'completed') {
      entry.status = STATUS.COMPLETED
      continue
    }
    if (entry.sessionStatus === 'arrived') {
      entry.status = STATUS.ARRIVED
      continue
    }

    // Hard deadline has already passed → missed
    if (entry.deadlineTime && entry.deadlineTime < now) {
      entry.status = STATUS.MISSED
      continue
    }

    // Buffer-based for upcoming checkpoints
    if (entry.bufferMinutes !== null) {
      entry.status = bufferToStatus(entry.bufferMinutes, trip.minBuffer ?? 5)
    } else {
      entry.status = STATUS.PENDING
    }
  }
}

function bufferToStatus(bufferMinutes, minBuffer = 5) {
  if (bufferMinutes === null) return STATUS.PENDING
  if (bufferMinutes < 0)         return STATUS.AT_RISK
  if (bufferMinutes < minBuffer) return STATUS.AT_RISK
  if (bufferMinutes < 20)        return STATUS.TIGHT
  return STATUS.OK
}

// ============================================================
// WARNING GENERATION (Fourth Pass)
// Skip completed/arrived/skipped — they don't need forward warnings.
// ============================================================

function generateWarnings(entries, trip) {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const cp    = trip.checkpoints[i]

    if (
      entry.status === STATUS.COMPLETED ||
      entry.status === STATUS.ARRIVED   ||
      entry.status === STATUS.SKIPPED   ||
      entry.status === STATUS.MISSED
    ) {
      entry.warnings = []
      continue
    }

    const warnings = []

    if (cp.kind === CHECKPOINT_KIND.DEPARTURE_DEADLINE && entry.estimatedArrival) {
      if (entry.latestSafeArrival && entry.estimatedArrival > entry.latestSafeArrival) {
        warnings.push({
          type:          WARNING_TYPE.WILL_MISS_DEPARTURE,
          overByMins:    diffMinutes(entry.latestSafeArrival, entry.estimatedArrival),
          departureMode: cp.departureMode || 'departure',
        })
      } else if (entry.recommendedArrival && entry.estimatedArrival > entry.recommendedArrival) {
        warnings.push({
          type:     WARNING_TYPE.TIGHT_ON_DEPARTURE,
          diffMins: diffMinutes(entry.recommendedArrival, entry.estimatedArrival),
        })
      }
    }

    if (cp.kind === CHECKPOINT_KIND.OPENING_HOURS && entry.estimatedArrival) {
      if (cp.opensAt && entry.plannedArrival) {
        if (entry.estimatedArrival < entry.plannedArrival) {
          warnings.push({ type: WARNING_TYPE.ARRIVES_BEFORE_OPEN, opensAt: cp.opensAt })
        }
      }
      if (entry.latestSafeArrival && entry.estimatedArrival > entry.latestSafeArrival) {
        warnings.push({ type: WARNING_TYPE.TOO_LATE_FOR_VISIT, closesAt: cp.closesAt })
      }
    }

    if (cp.kind === CHECKPOINT_KIND.FIXED_APPOINTMENT && entry.estimatedArrival) {
      if (entry.latestSafeArrival && entry.estimatedArrival > entry.latestSafeArrival) {
        warnings.push({
          type:       WARNING_TYPE.LATE_FOR_APPOINTMENT,
          overByMins: diffMinutes(entry.latestSafeArrival, entry.estimatedArrival),
        })
      }
    }

    entry.warnings = warnings
  }
}

// ============================================================
// RESULT HELPERS
// ============================================================

function calculateTripStatus(entries) {
  const relevant = entries.filter(
    e => e.status !== STATUS.SKIPPED && e.status !== STATUS.COMPLETED
  )
  if (relevant.length === 0) return STATUS.COMPLETED
  // Only hard deadlines (isFixed) can drive the trip to MISSED or AT_RISK.
  // Soft issues (opening hours, normal stops) cap at TIGHT so a missed museum
  // visit doesn't read the same as a missed ferry.
  if (relevant.some(e => e.isFixed && e.status === STATUS.MISSED))  return STATUS.MISSED
  if (relevant.some(e => e.isFixed && e.status === STATUS.AT_RISK)) return STATUS.AT_RISK
  if (relevant.some(e => e.status === STATUS.MISSED || e.status === STATUS.AT_RISK)) return STATUS.TIGHT
  if (relevant.some(e => e.status === STATUS.TIGHT)) return STATUS.TIGHT
  return STATUS.OK
}

function getMostUrgentAlert(entries) {
  const atRisk = entries.find(e => e.status === STATUS.AT_RISK && e.warnings.length > 0)
  if (atRisk) return { entry: atRisk, warning: atRisk.warnings[0] }
  const tight = entries.find(e => e.status === STATUS.TIGHT && e.warnings.length > 0)
  if (tight) return { entry: tight, warning: tight.warnings[0] }
  return null
}

// Next physical stop in sequence (or current stop if arrived).
function getNextStop(entries, now, sessionIsActive = false) {
  const current = entries.find(e => e.status === STATUS.ARRIVED)
  if (current) return current
  // When the session is active, bypass the time filter entirely — a late traveler's
  // next stop may have estimatedArrival < now, but they're clearly heading there.
  // sessionIsActive is true as soon as isRunning, not only after the first completion.
  const sessionActive = sessionIsActive || entries.some(e => e.status === STATUS.COMPLETED)
  return entries.find(e =>
    e.status !== STATUS.COMPLETED &&
    e.status !== STATUS.SKIPPED   &&
    (sessionActive || e.etaUncertain || (e.estimatedArrival && e.estimatedArrival >= now))
  ) || null
}

// Next upcoming hard deadline (departure, appointment, closing time).
// Distinct from nextStop: the next connection/event may be several stops ahead.
function getNextCritical(entries) {
  return entries.find(e =>
    e.deadlineTime != null         &&
    e.status !== STATUS.COMPLETED  &&
    e.status !== STATUS.SKIPPED    &&
    e.status !== STATUS.MISSED
  ) || null
}

// Consequence: how the current moment propagates to the next fixed deadline.
// Returns structured facts only — no copy, no tone.
// The presenter layer (warningCopy.renderConsequence) converts these to profile strings.
function getConsequence(entries, trip, sessionIsActive) {
  if (!sessionIsActive) return null

  // Find the next unresolved fixed deadline (includes MISSED — that's still a consequence)
  const affected = entries.find(e =>
    e.isFixed                      &&
    e.deadlineTime != null         &&
    e.bufferMinutes !== null       &&
    e.status !== STATUS.COMPLETED  &&
    e.status !== STATUS.SKIPPED
  )
  if (!affected) return null

  const arrivedEntry = entries.find(e => e.status === STATUS.ARRIVED)

  // User is already AT the deadline — no downstream consequence to surface
  if (arrivedEntry && arrivedEntry.checkpointId === affected.checkpointId) return null

  const context = arrivedEntry ? 'arrived' : 'traveling'
  const affectedCp = trip.checkpoints.find(c => c.id === affected.checkpointId)

  return {
    affectedEntryId:   affected.checkpointId,
    affectedName:      affected.checkpointName,
    affectedKind:      affected.kind,
    affectedDeadline:  affected.deadlineTime,
    latestSafeArrival: affected.latestSafeArrival,
    departureMode:     affectedCp?.departureMode ?? null,
    bufferMins:        affected.bufferMinutes,
    severity:          affected.status,   // mirrors engine STATUS: ok/tight/at_risk/missed
    context,
  }
}

// The leg the traveler is currently on: last completed stop → next pending stop.
// Returns null when arrived at a stop (traveler is stationary, not in motion).
function getCurrentLeg(entries, trip, now, legData = {}, sessionIsActive = false, startedAt = null) {
  // Arrived at a stop → stationary, no active leg
  if (entries.some(e => e.status === STATUS.ARRIVED)) return null

  // When the session is active, bypass the time filter — same logic as getNextStop.
  const sessionActive = sessionIsActive || entries.some(e => e.status === STATUS.COMPLETED)
  const next = entries.find(e =>
    e.status !== STATUS.COMPLETED &&
    e.status !== STATUS.SKIPPED   &&
    (sessionActive || e.etaUncertain || (e.estimatedArrival && e.estimatedArrival >= now))
  )
  if (!next) return null

  // From: last completed stop, or the trip origin if nothing completed yet
  const nextIdx  = entries.findIndex(e => e.checkpointId === next.checkpointId)
  const lastDone = nextIdx > 0
    ? entries.slice(0, nextIdx).reverse().find(e => e.status === STATUS.COMPLETED)
    : null

  const fromId   = lastDone?.checkpointId || 'origin'
  const fromName = lastDone
    ? lastDone.checkpointName
    : (trip.origin?.name?.trim() || trip.title)

  // Structured leg record from session (Maps or manual)
  const leg = legData[makeLegId(fromId, next.checkpointId)] || null

  // Travel time: legData → cp.travelTimeToNext (non-origin) → trip.origin.travelTimeToFirst (origin)
  const fromCp = lastDone
    ? trip.checkpoints.find(c => c.id === lastDone.checkpointId)
    : null
  const originPersistedTime = !lastDone ? (trip.origin?.travelTimeToFirst ?? null) : null
  const travelTimeMinutes = leg?.travelTimeMinutes
                         ?? fromCp?.travelTimeToNext
                         ?? originPersistedTime
                         ?? null

  // Source: explicit leg record > cp.travelTimeToNext > trip.origin.travelTimeToFirst > unknown
  const travelTimeSource =
    leg?.source                              ? leg.source  :
    leg?.travelTimeMinutes    != null        ? 'manual'    :
    fromCp?.travelTimeToNext  != null        ? 'manual'    :
    originPersistedTime       != null        ? 'manual'    :
    'unknown'

  // Travel mode priority: legData.mode (future Maps) > checkpoint field > origin field > unknown
  const travelMode = leg?.mode
    ?? fromCp?.travelModeToNext
    ?? (!lastDone ? (trip.origin?.travelModeToFirst ?? null) : null)
    ?? 'unknown'

  // Departure time: when we left the from-point (actual or estimated).
  // First leg (lastDone = null): use startedAt (actual press of "I'm leaving") when available,
  // so elapsed/progress calculations reflect real physical travel time rather than planned time.
  const departureTime = lastDone
    ? (lastDone.actualDeparture || lastDone.estimatedDeparture)
    : (startedAt ? new Date(startedAt) : parseTimeOnDate(trip.startTime, new Date(trip.date + 'T12:00:00')))

  const minsRemaining = next.estimatedArrival && now && !next.etaUncertain
    ? Math.max(0, Math.round((next.estimatedArrival - now) / 60000))
    : null

  return {
    fromId,
    fromName,
    toId:              next.checkpointId,
    toName:            next.checkpointName,
    estimatedArrival:  next.estimatedArrival,
    departureTime,
    minsRemaining,
    travelTimeMinutes,
    travelTimeSource,
    travelMode,
    etaSource:         travelTimeSource,   // backward-compat alias
    distanceText:      leg?.distanceText   ?? null,
    durationText:      leg?.durationText   ?? null,
    routeRisk:         leg?.routeRisk      ?? 'none',
    updatedAt:         leg?.updatedAt      ?? null,
    etaUncertain:      next.etaUncertain   ?? false,
  }
}

function getTotalBuffer(entries) {
  const deadlineEntries = entries.filter(
    e => e.isFixed && e.bufferMinutes !== null &&
         e.status !== STATUS.SKIPPED && e.status !== STATUS.COMPLETED
  )
  if (!deadlineEntries.length) return null
  return Math.min(...deadlineEntries.map(e => e.bufferMinutes))
}

// Synthetic start entry for the timeline view — not a checkpoint, just display data.
function buildStartEntry(trip) {
  return {
    name:          trip.origin?.name?.trim() || trip.title,
    address:       trip.origin?.address || '',
    departureTime: parseTimeOnDate(trip.startTime, new Date(trip.date + 'T12:00:00')),
  }
}

function emptyResult() {
  return {
    entries:         [],
    startEntry:      null,
    tripStatus:      STATUS.PENDING,
    mostUrgentAlert: null,
    nextStop:        null,
    nextCheckpoint:  null,   // alias
    nextCritical:    null,
    currentLeg:      null,
    totalBufferMins: null,
  }
}

// ============================================================
// WHAT-IF SIMULATION
// ============================================================

export function simulateDelay(trip, checkpointId, extraMinutes, sessionData = {}, legData = {}, now = new Date(), sessionIsActive = false, startedAt = null) {
  const modifiedTrip = {
    ...trip,
    checkpoints: trip.checkpoints.map(cp => {
      if (cp.id !== checkpointId) return cp
      return {
        ...cp,
        plannedDuration: (cp.plannedDuration || 0) + extraMinutes,
        desiredDuration: (cp.desiredDuration || 0) + extraMinutes,
        duration:        (cp.duration        || 0) + extraMinutes,
      }
    }),
  }
  return calculateTimeline(modifiedTrip, sessionData, legData, now, sessionIsActive, startedAt)
}
