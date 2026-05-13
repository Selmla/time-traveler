Time Traveler — MVP Product Contract
Version: 0.3 (companion-first reframe)
Status: Engine and core UX stabilized — Blocks 1–5B implemented and field-test ready
Last updated: 2026-05-13

1. Product Vision
What it is
Time Traveler is a deadline-aware travel companion for people with time-sensitive connections. It tells you, in real time, whether your journey is on track — and what the downstream consequences are if it isn't.

This is a companion, not a planner. Setup data enriches the engine's precision; setup data does not gate operational usefulness. A trip with one ferry deadline and no travel times is operationally useful on day one. A trip with fully-modeled travel times is more precise. The app must never feel broken because a travel time is missing.

The core problem it solves
Travelers on multi-stop trips (motorcyclists catching ferries, tourists visiting attractions with closing times, commuters with fixed appointments) currently have no tool that:

Converts a schedule into a live consequence model
Tells them specifically how a delay at one stop affects a fixed deadline two stops ahead
Gives that information in a glanceable, non-alarming format appropriate for travel conditions
Calendar apps don't model travel time. Navigation apps don't model stop sequences. Time Traveler bridges that gap.

Positioning
Time Traveler is a consequence-awareness companion to navigation — not a replacement for it. The intended riding workflow is: Google Maps on the bottom half of the screen handling the route, Time Traveler on the top half monitoring the plan. The app tells you whether your schedule is still viable while navigation tells you where to turn. These two jobs should never compete.

What makes it different
Consequence awareness, not just scheduling. The app doesn't just show times — it shows what those times mean for the things you actually care about.
Fixed vs. soft deadline distinction. A missed museum opening is not the same as a missed ferry. The app models this explicitly.
Profile-aware language. A motorcyclist on a ferry run and a tourist on a city day trip see the same facts, in different emotional registers.
Glance Mode. A full-screen riding HUD that communicates the essentials without requiring the user to read the screen.

2. Core UX Principles
2.1 Consequence awareness
The app's primary job is not to display times — it's to surface what those times mean downstream. Every status display should answer: "What does this mean for what I care about?"

2.2 Trustworthiness over completeness
An uncertain ETA is never silently replaced with a guess. Unknown travel times are shown as unknown. The app says "travel time not set" rather than computing a fabricated ETA. Trust is preserved by being honest.

2.3 Calm but clear urgency
Status escalation (OK → TIGHT → AT_RISK) should feel like a dial, not an alarm. The transition from amber to red means something. The app avoids alarmist language even at AT_RISK, and avoids under-communication at TIGHT.

2.4 Engine facts, copy layer tone
The engine speaks in operational facts: buffer minutes, status values, warning types, consequence propagation. The copy layer translates those facts into language. These two layers must never be conflated. A hardcoded string in the engine is always a violation.

2.5 Fixed deadlines vs. soft stops
A DEPARTURE_DEADLINE or FIXED_APPOINTMENT is a hard constraint. Its miss escalates the trip to MISSED. An OPENING_HOURS or NORMAL_STOP is soft — its miss escalates the trip only to TIGHT. This distinction is preserved throughout the engine and UI.

2.6 Glance Mode as a low-friction HUD
Glance Mode is designed for use in conditions where reading the screen is difficult (riding, driving). It must be operable with one glance and one tap. Information hierarchy: status first, action second, context third.

2.7 No technical language in the UI
Terms like "buffer", "ETA", "session", "deadline", "checkpoint" are engine vocabulary. The UI translates these. The only partial exception is "buffer" which may appear in dashboard-level stats where it has established meaning.

2.8 Safety-conscious wording
The app never implies the user should drive faster or take risks to make time. Operational urgency is expressed through planning language: "leave soon", "consider adjusting the plan", "deadline is at risk" — not "push the pace" or speed-implying phrases.

2.9 Primary information must be visible without scrolling
In Glance Mode: zero scroll, ever. In the NowScreen dashboard: the current status, the most urgent action, and the primary consequence must all be visible without scrolling on a standard mounted-phone layout (roughly 390×844 pt, with the top half of the screen visible in split-screen). Secondary detail (upcoming stops list, full timeline, notes) may require scrolling. This is not a "no scroll" rule — it is a "no scroll to find out you're in trouble" rule.

2.10 Platform usage model
Android split-screen with Google Maps in the bottom half is the primary riding workflow. Time Traveler occupies the top half; Maps occupies the bottom. The app must function correctly and readably at approximately half-screen height. iOS does not support split-screen natively; the iOS workflow is app-switching — user taps back to Time Traveler at stops or when checking status. Both workflows are supported; the Android split-screen layout is the design target for mounted-phone use.

2.11 Progressive enrichment — data enriches the engine, data does not gate it
The consequence engine requires only one hard deadline, the current clock, and a rough ETA signal to deliver operational value. Additional setup data — travel times, stop durations, buffer preferences — progressively sharpens that value but does not unlock it.

Setup UX must present travel times and stop durations as enrichment, not requirements. A first-time user who enters only a ferry time and their next stop's name should see a working app — not an error state, not a blank timeline, not a warning about missing data. The inline leg editor during an active trip is the primary ETA capture path for users who start with incomplete setup data.

2.12 Degraded operational mode and uncertainty-aware UX
When ETA is unknown (etaUncertain = true, estimatedArrival = null), the app is in degraded operational mode. In this state the app must still communicate:

The deadline that exists (name, time, how far away in clock time)
That ETA is unknown and why (travel time not set for this leg)
How much time has elapsed since the last known departure point (clock progress)
A direct path to capture a travel time estimate and exit degraded mode

The app must not go silent or appear broken when travel times are missing. Uncertainty is a legitimate operational state; the app acknowledges it and gives the user a way forward.

Minimum operationally useful state: The app is operationally useful during a leg if the user can answer all three of these questions from the mounted-phone view:
1. Do I have a connection to catch? (deadline name and time)
2. Am I on track? (OK / TIGHT / AT_RISK status, or explicit "ETA unknown")
3. What should I do right now? (directive or action button)

A missing travel time may prevent answering question 2 precisely. It must not prevent answering questions 1 or 3.

Degraded mode UX rules:
Render the deadline entry with status PENDING and label "ETA unknown" / "—?"
In Glance Mode traveling state: show a "How long from Maps?" prompt with a grid of preset minute buttons (15 / 25 / 30 / 45 / 60 / ···). One tap on any preset immediately calls updateLeg, exits degraded mode, and triggers a full timeline recalculation. Tapping ··· reveals an inline number input — no modal, no new screen.
In NowScreen traveling state: the inline leg editor in LegContextCard serves as the entry path.
Do not hide or collapse the consequence block — show the deadline, acknowledge the uncertainty
Do not fabricate an ETA or silently default to zero travel time
The entered travel time is persisted to session legData and survives browser refresh

3. User Flows
3.1 Planning a trip
User opens Trips tab → taps New trip
Creates trip: name, date, start time, trip style (roadtrip / city day trip / custom), connection buffer preference
Trip is saved with empty checkpoint list
App navigates to Plan screen for the new trip
User adds stops in order
3.2 Adding and editing stops
From Plan screen → tap Add stop
Select stop type: Normal stop, Departure deadline (ferry/train/flight/bus), Opening hours, Fixed appointment, Fuel stop
Fill kind-specific fields:
Normal stop: name, address, notes, planned duration, optional planned arrival
Departure deadline: name, departure time, departure mode, preferred/minimum buffers, travel time + mode to next stop
Opening hours: name, open time, close time, desired/minimum visit duration
Fixed appointment: name, appointment time, arrival buffer, duration
Set travel time to next stop (and travel mode) for every stop except the last
Timeline updates in real time as fields are filled
Stops can be reordered (up/down), edited, or deleted
3.3 Starting a trip
User opens Now tab while no trip is active
Sees list of saved trips → taps Start trip on the desired trip
Session begins: isRunning = true, activeTripId set, all session data reset
App enters active mode: timeline engine switches from planning clock (trip start time) to live clock (real time, 30s updates)
Dashboard view shows current leg + next stop
3.4 Traveling between stops
Dashboard shows LegContextCard (from → to, departure time, travel time, travel mode)
If travel time is unknown: card shows "Travel time not set" with an inline editor
If downstream fixed deadline exists: consequence shown in LegContextCard ("X minutes of buffer at the 14:30 ferry")
Glance Mode HUD (if active): shows ETA, deadline buffer, directive, mini timeline strip
3.5 Arriving at a stop
User taps Mark arrived in Dashboard → sessionStatus = 'arrived'
Dashboard switches to StopTimer: shows time here, planned duration, leave-within countdown, leave-by time
If downstream fixed deadline exists: consequence block shows ("About 18 more minutes here / without affecting the ferry")
Glance Mode stop panel: leave-within, here-for, consequence (if not very-safe-buffer), next destination
Action buttons: Depart now, +5m, +15m (extend stay), Skip (if skippable)
3.6 Departing from a stop
User taps Depart now → a brief inline confirmation appears ("Confirm depart?" + two buttons: Depart / Wait). Confirmation auto-dismisses after ~4 seconds if not acted on (returning to the Depart Now button, taking no action). On confirm: sessionStatus = 'completed', actualDepartureTime recorded.
Dashboard returns to leg view for the next stop.
Timeline recalculates from actual departure time forward.
Consequence updates to reflect new position in journey.
Undo available (last action only per action history).

Depart Now tap model rationale: Single-tap confirm-inline is preferred over press-and-hold (requires timing calibration, unpredictable with gloves), swipe (requires horizontal precision, unreliable on a vibrating mount), or a full modal (cognitive load mid-ride). The 4-second auto-dismiss means a misfire has no effect; a deliberate depart requires one additional tap. Both touches are large-target friendly. This is a medium-risk action (reversible via undo); accidental departure is recoverable within seconds. The inline confirmation avoids the navigation interruption a modal causes.
3.7 Finishing a trip
All stops reach completed or skipped status → dashboard shows "All stops complete!"
User taps End trip (with confirmation) from the trip header
Session data is cleared; trip plan is preserved
App returns to no-active-trip state on Now screen
3.8 Using Glance Mode
User taps Glance button in Now screen header
Full-screen dark HUD overlay appears
Traveling state: ETA + delay drift indicator, deadline buffer, latest safe arrival, directive (profile-aware), mini timeline strip
Arrived state: stop panel showing leave-within countdown, leave-by time, here-for timer, consequence, next destination
Action buttons: Mark arrived / Depart now (context-sensitive), Exit Glance
Haptic feedback on status escalation
Dismiss: tap X or use hardware back
3.9 Opening navigation
Any stop with a valid address shows a Navigate button
Tapping it opens the device's default navigation app (or Google Maps) with the address
App does not handle deep linking to Maps routing — simple address handoff only
3.10 What-if simulation
From Dashboard, on the Next Stop card (upcoming state), user taps What if +5m? or What if +15m?
What-If panel opens, showing a parallel timeline with the simulated delay applied
Delay is applied as extra duration at the selected stop
Panel shows impact on all downstream deadlines
Close panel → return to normal timeline view
Simulation uses the same planning/active clock as the main timeline

4. Feature Checklist
4.1 Trips
 Create trip (name, date, start time, trip style, buffer preference, origin)
 Edit trip fields
 Delete trip (with confirmation; ends session if active)
 Trip list view (trips screen)
 Start trip (session initiation)
 End trip (with confirmation; session teardown)
 Active trip indicator on trips list ("Trip in progress" banner)
 Trip profile: Roadtrip, City day trip, Custom
4.2 Stop types
 Normal stop (name, duration, optional planned arrival)
 Departure deadline (ferry/train/flight/bus/other with mode-specific default buffers)
 Opening hours (open/close times, desired/minimum duration)
 Fixed appointment (appointment time, arrival buffer, duration)
 Fuel stop (short duration default)
 Start (trip origin — departure point)
 End (trip destination — optional target arrival)
4.3 Stop management
 Add stop
 Edit stop (kind-specific fields)
 Delete stop
 Reorder stops (up/down)
 Address field (for navigation handoff)
 Notes field
 isSkippable flag per stop
4.4 Travel legs
 Travel time per leg (manual entry, persisted to trip and session)
 Travel mode per leg (walking/driving/cycling/transit/unknown)
 Origin travel time and mode (first leg from trip origin to first stop)
 Inline leg editor in NowScreen (LegContextCard)
 Travel time fallback chain: session legData → checkpoint.travelTimeToNext → origin.travelTimeToFirst
 Mode-aware label in leg display ("Walk time", "Drive time", etc.)
 Mode-aware chip text in Glance Mode ("~12 min walk", "~25 min drive")
4.5 Timeline engine
 Four-pass calculation: build entries → calculate buffers → assign statuses → generate warnings
 Planning clock: uses trip start time as now (not wall clock)
 Active clock: real wall clock updated every 30s via shared hook timer
 ETA uncertainty propagation (etaUncertain flag) when travel times are missing
 Backward buffer walk from fixed deadlines
 nextStop resolution (ARRIVED → first pending)
 currentLeg computation (from last completed stop / origin → next pending stop)
 nextCritical (next unresolved fixed deadline)
 totalBufferMins (minimum buffer across all pending fixed deadlines)
 Session-aware next stop / current leg (bypass time filter when session is active)
 Consequence computation (getConsequence)
4.6 Status system
 OK (buffer > 20 min)
 TIGHT (buffer between minBuffer and 20 min)
 AT_RISK (buffer below minBuffer or negative)
 MISSED (deadline time has passed)
 COMPLETED (user has departed)
 ARRIVED (user is at stop, not yet departed)
 SKIPPED (user skipped this stop)
 PENDING (not yet reached)
 Trip-level status: fixed deadlines drive MISSED/AT_RISK; soft stops cap at TIGHT
 Completed stops excluded from trip-level status and buffer calculations
4.7 Warning system
 Structured warning objects (not strings) from engine
 Warning types: WILL_MISS_DEPARTURE, TIGHT_ON_DEPARTURE, ARRIVES_BEFORE_OPEN, TOO_LATE_FOR_VISIT, LATE_FOR_APPOINTMENT
 renderWarning(warning, profile) in copy layer → profile-appropriate string
 Warnings displayed in NextCheckpointCard (per-stop) and AlertBanner (most urgent)
 Warnings cleared for completed/arrived/skipped/missed stops
4.8 Consequence system
 getConsequence(entries, trip, sessionIsActive) in engine
 Consequence computed only during active session
 Facts emitted: affected deadline name/kind/time, buffer minutes, severity, context (arrived/traveling)
 renderConsequence(consequence, profile) → { headlineLine, contextLine }
 Consequence in Glance Mode arrived stop panel (suppressed when ok + buffer > 30m)
 Consequence in NowScreen StopTimer (all severities including ok for positive reassurance)
 Consequence in NowScreen LegContextCard (all severities, traveling context only)
4.9 What-if simulation
 simulateDelay(trip, checkpointId, extraMinutes, sessionData, legData, now, sessionIsActive)
 Uses same now and sessionIsActive as main timeline (no clock divergence)
 "What if +5m?" and "What if +15m?" buttons on upcoming stops
 WhatIfPanel showing parallel timeline with simulated delay
 Close returns to normal timeline
4.10 Session / active state
 markArrived(cpId) — records actualArrivalTime, sets status = 'arrived'
 markDeparted(cpId) — records actualDepartureTime, computes actualDurationMinutes
 markCompleted(cpId) — combined arrive+depart shortcut
 markSkipped(cpId) — sets status = 'skipped', preserves schedule for downstream
 addDelay(cpId, minutes) — extends stay duration (used while arrived)
 undoLastAction() — restores previous checkpoint state from action history
 updateLeg(legId, data) — updates per-leg travel data (manual entry)
 Wake Lock API — keeps screen on during active trip
4.11 Glance Mode
 Full-screen overlay HUD
 Profile-aware directive (all-caps for roadtrip, calmer for city)
 Traveling state: destination name + ETA, delay drift indicator, buffer display, latest safe arrival
 Arrived state: stop panel with leave-within countdown, here-for timer, consequence, next destination
 Past-plan indicator when departure window has passed
 Haptic feedback on status escalation
 Mini timeline strip (all upcoming stops with status dots)
 Mark arrived / Depart now action buttons
 Single shared now clock (no local timer divergence)
4.12 Now / Dashboard
 Active trip dashboard (status bar, alert banner, tab switcher)
 LegContextCard (traveling state)
 NextCheckpointCard (kind-aware timing blocks)
 StopTimer (arrived state with leave-within, planned stop, here-for, stale prompt)
 Upcoming stops list (below next stop)
 NextCriticalCard (when next deadline is ahead of next stop)
 Timeline view tab (scrollable full timeline)
 Safety net: handles deleted trip during active session
4.13 Navigation handoff
 "Navigate" button on stops with an address field
 Opens device navigation via openNavigation(cp) utility
 Deep link to specific Maps provider (deferred)
 In-app map preview (deferred)

5. Engine Rules
5.1 Clock sources
Planning view (tripIsActive = false):

now = parseTime(trip.startTime, trip.date) — the trip's scheduled start time
All ETAs, statuses, and buffers evaluate relative to when the trip is planned to start
No stop can appear MISSED or AT_RISK solely because the user is viewing the plan at 11 PM for a tomorrow 9 AM trip
Active session (tripIsActive = true):

now = real wall clock, updated every 30 seconds via useTimeline hook
The same now reference is passed to calculateTimeline, simulateDelay, and all GlanceMode metrics
No secondary local timers; StopTimer maintains its own display timer for elapsed time display only
5.2 Session detection
sessionIsActive is passed explicitly from useTimeline into calculateTimeline. It equals isRunning && activeTripId === tripId. The engine does not infer session state from entry statuses — it receives it as an explicit parameter.

When sessionIsActive = true:

getNextStop and getCurrentLeg bypass the estimatedArrival >= now time filter
getConsequence runs; otherwise returns null
5.3 Buffer calculation rules
Walk entries in reverse order
Skip entries where sessionStatus === 'completed' or sessionStatus === 'arrived' — they are resolved and must not set or receive nextDeadlineEntry
Skip entries where status === STATUS.SKIPPED
For entries with a deadlineTime and estimatedArrival: bufferMinutes = diffMinutes(estimatedArrival, latestSafeArrival ?? deadlineTime); this entry becomes nextDeadlineEntry
For non-deadline entries with a nextDeadlineEntry: bufferMinutes = diffMinutes(estimatedArrival, nextDeadlineEntry.latestSafeArrival ?? nextDeadlineEntry.deadlineTime)
Otherwise: bufferMinutes = null
5.4 Status assignment rules (per entry)
Applied in this priority order:

sessionStatus === 'skipped' → STATUS.SKIPPED (set in buildEntry, not assignStatuses)
sessionStatus === 'completed' → STATUS.COMPLETED
sessionStatus === 'arrived' → STATUS.ARRIVED
entry.deadlineTime && deadlineTime < now → STATUS.MISSED
bufferMinutes !== null → bufferToStatus(bufferMinutes, trip.minBuffer ?? 5)
Otherwise → STATUS.PENDING
bufferToStatus thresholds:

bufferMinutes < 0 or < minBuffer → AT_RISK
< 20 → TIGHT
≥ 20 → OK
5.5 Trip-level status aggregation
Only non-completed, non-skipped entries contribute:

If none remain → COMPLETED
If any isFixed entry is MISSED → MISSED
If any isFixed entry is AT_RISK → AT_RISK
If any entry (fixed or soft) is MISSED or AT_RISK → TIGHT (soft issues cap here)
If any entry is TIGHT → TIGHT
Otherwise → OK
Rationale: A missed opening hours or a soft stop at risk should not read the same as a missed ferry. Only isFixed entries (DEPARTURE_DEADLINE, FIXED_APPOINTMENT) can drive the trip to MISSED or AT_RISK.

5.6 Fixed vs. soft stop classification
Kind	isFixed	Trip escalation cap
DEPARTURE_DEADLINE	true	MISSED / AT_RISK
FIXED_APPOINTMENT	true	MISSED / AT_RISK
OPENING_HOURS	false	TIGHT
NORMAL_STOP	false	TIGHT
FUEL_STOP	false	TIGHT
START	false	—
END	false	—
5.7 Consequence rules
getConsequence returns non-null only when:

sessionIsActive = true
At least one pending fixed deadline exists with a computable bufferMinutes
The user is not currently ARRIVED at that very deadline
The severity field on the consequence object mirrors the affected deadline's engine STATUS directly. No separate threshold calibration.

The context field:

'arrived' — an ARRIVED entry exists; bufferMins = how much extra time can be spent here
'traveling' — no arrived entry, session active; bufferMins = remaining buffer at the deadline
5.8 ETA uncertainty
When any leg has travelTimeToNext = null and no session legData exists, runningTime propagates as null. All downstream entries have etaUncertain = true and estimatedArrival = null. Their statuses become PENDING (no buffer to compute). The UI renders "travel time not set" rather than fabricating an ETA.

5.9 Skipped stop behavior
Skipped entries have estimatedDeparture = runningTime (zero-duration passthrough). Their runningTime advances to the next stop as if the stop was never visited. The stop does not become nextDeadlineEntry during buffer calculation and does not contribute to totalBufferMins.

5.10 Completed stop behavior
Completed stops are excluded from:

Buffer propagation (do not become nextDeadlineEntry)
Trip-level status aggregation
totalBufferMins calculation
getNextStop and getCurrentLeg result sets
The actual departure time, if recorded, is used as the base for downstream ETA calculation.

5.11 MVP ETA strategy — manual capture, not Maps API
The current MVP does not integrate with Google Maps or any routing API. ETAs are computed from manually-entered travel times only. This is a deliberate scope decision, not an oversight.

Manual ETA capture flow:
Before a trip: user enters estimated travel time per leg in the checkpoint editor
During a trip: user updates a leg's travel time via the inline editor in LegContextCard; this immediately recalculates all downstream ETAs and consequences
The engine uses the most recently entered value; session legData overrides the checkpoint's stored travelTimeToNext (see fallback chain in §4.4)

What the app does when no travel time is set:
The engine propagates etaUncertain = true; all downstream entries have estimatedArrival = null and status PENDING
The UI renders "travel time not set" in LegContextCard with the inline editor immediately accessible
The deadline entry shows its name and time with "ETA unknown" rather than a fabricated ETA
The consequence block acknowledges the deadline without fabricating a buffer figure
This behavior must be preserved exactly — it is the degraded operational mode defined in §2.12

Future ETA bootstrap (post-field-test evaluation):
After field testing establishes whether manual ETA capture friction is acceptable, evaluate Google Maps Directions API integration to prefill travel times at trip start. The intended model: when a trip is started, populate empty leg travel times from the Maps API for the complete route; user retains the ability to override any prefilled value; manually-set values always take precedence over API values. This is a likely next-step feature, not a permanently deferred experiment. The field test exists partly to measure whether manual entry is sufficient or whether Maps bootstrap is required for practical use.

6. Language and Tone Rules
6.1 Engine vocabulary (never appears in UI strings)
The following terms must not appear in user-facing text:

Engine term	UI substitute
buffer	(contextual: "time to spare", "X minutes", omit)
ETA	arrival time, your ETA (acceptable in dashboard only)
session	(invisible to user)
checkpoint	stop
deadline	connection, departure, reservation, appointment (contextual)
entry	(invisible)
status	(invisible)
boolean flags	(invisible)
6.2 Profile-specific tone
Roadtrip / Motorcyclist profile:

Operational, direct, low-fuss
Uppercase for Glance Mode directives: "LEAVE NOW", "DEPART WITHIN 12m", "TIME CRITICAL"
Warning language is factual: "ETA is 7m past the safe arrival cutoff — ferry at risk"
Consequence language is plain: "Leave within 8 minutes / to keep the 14:30 ferry safe"
City tourism profile:

Warmer, lower urgency, experience-forward
Sentence case for directives: "Time to leave", "Running behind"
Warning language softened: "You may miss this ferry — arriving 7m past the safe window"
Consequence language personal: "Start wrapping up / your 19:30 reservation has 8 minutes of buffer"
Custom profile:

Defaults to roadtrip tone unless specified otherwise in profileCopy
6.3 Safety wording constraints (all profiles)
The following phrases or implications are never permitted:

Any suggestion to drive faster, accelerate, or rush
"Push the pace" or equivalent
"Speed up" or implied urgency that implies a road risk
Countdown language that implies dangerous attention demands while driving
Permitted urgency expressions:

"Leave soon"
"Leave within X minutes"
"Consider adjusting the plan"
"Deadline buffer is exhausted"
"Ferry is at risk"
"Start heading out"
"Time to head out"
6.4 Positive reassurance (NowScreen)
When consequences are safe, the app actively reassures the user rather than going silent:

"About 38 more minutes here / without affecting the ferry"
"You have time here without affecting the [deadline]"
Silence is not neutral — it breeds anxiety in time-sensitive contexts
6.5 Glance Mode suppression threshold
Positive consequences with bufferMins > 30 are not displayed in Glance Mode (noise reduction for riding context). The same consequence IS displayed in NowScreen regardless of buffer size.

7. Known Gaps / Deferred Features
These are explicitly out of scope for MVP and should not be implemented without a deliberate product decision:

Feature	Reason deferred
Live GPS position tracking	Requires device permissions, background location, significant battery impact
Automatic arrival detection (geofencing)	Depends on GPS; significant UX complexity around false positives
Google Maps ETA bootstrap	Evaluate post-field-test: field test measures whether manual ETA entry friction is acceptable; this is the likely next-step feature if it isn't (see §5.11)
Real-time traffic data	Requires Maps API subscription and ongoing cost model; separate from ETA bootstrap
Route calculation (turn-by-turn)	Scope beyond travel planning; address handoff to Maps is sufficient
Cloud sync / account system	Infrastructure and privacy complexity; localStorage is sufficient for v1
Multi-device / shared trip	Requires accounts
Push notifications	Requires service worker + notification permissions; Glance Mode covers use case
Offline map tiles	Significant storage; PWA cache covers app shell
Recurrence (repeating trips)	Future feature
Social sharing	Future feature
Trip history / analytics	Future feature
Apple Maps / Waze navigation	Currently defaults to system navigation; acceptable for v1
Trip export (PDF, calendar)	Future feature
Weather integration	Future feature
8. Regression Checklist
Run before any major change to the engine, stores, or primary screens.

Planning view
 Opening a trip for a future date: no stops show as MISSED or AT_RISK before the trip starts
 Opening a trip for a past date: no false alarm states from wall clock vs. plan clock mismatch
 What-if simulation in planning view: times match the plan's clock, not tonight's wall clock
 Trip with unknown travel times: all downstream stops show as PENDING (not false statuses)
 Adding a stop mid-trip recalculates all downstream ETAs correctly
Active session — traveling
 Starting a trip 20 minutes late with no completed stops: first leg and next stop appear immediately (no blank dashboard)
 Traveling with all travel times set: current leg, ETA, and deadline buffer all display correctly
 Traveling with unknown travel time: LegContextCard shows "Travel time not set" inline editor; ETA shown as uncertain
 TIGHT trip status: status bar shows amber; alert banner shows most urgent warning; no MISSED escalation
 AT_RISK trip status (fixed deadline): status bar shows red; consequence shows in LegContextCard
Active session — arrived
 Marking arrived at a normal stop: StopTimer shows elapsed time and planned duration countdown
 Marking arrived at a normal stop with a downstream ferry: consequence shows correct buffer, correct ferry name
 Arrived at stop with buffer > 30m: Glance Mode suppresses consequence; NowScreen shows positive reassurance
 Arrived at stop with buffer 8m (tight): Glance Mode AND NowScreen show consequence in amber
 Arrived at departure_deadline stop: no consequence shown (user IS the deadline)
 Tapping +5m extends leave-within countdown correctly; downstream ETAs recalculate
Active session — transitions
 Marking departed: actual departure time used for downstream ETA; consequence updates; LegContextCard reappears
 Skipping a stop: downstream stops recalculate correctly; skipped stop appears in timeline with skipped style; trip status unaffected by skipped entry
 Undo: last action correctly reverted; timeline recalculates from restored state
 All stops completed or skipped: "All stops complete!" shown; no blank/error state
 Ending trip mid-journey: session cleared; trip plan preserved; Now screen returns to no-active-trip state
Glance Mode
 Status directive matches trip profile (uppercase for roadtrip, sentence case for city)
 Single clock: "Leave within" countdown and "Leave by" time are mathematically consistent (derived from same now)
 Haptic feedback fires on status escalation (OK → TIGHT, TIGHT → AT_RISK)
 Stop panel: arrived state shows correct stop name, elapsed time, consequence
 Traveling state: destination, ETA, buffer display all non-contradictory
Profile-aware copy
 Roadtrip profile: no city-tourism copy appears; no "push the pace" language
 City tourism profile: no all-caps directives; no speed-implying urgency
 Consequence in StopTimer: roadtrip → "Leave within X / to keep the ferry safe"; city → "Start wrapping up / your reservation has X minutes"
Data integrity
 Deleting a trip while session is active: session cleared; no orphaned activeTripId
 Deleted trip during active session: safety net message shown; "Clear session" available

9. Architecture Boundaries
9.1 Engine (src/engine/timeline.js)
Responsible for:

Deriving all time-based facts from trip plan + session actuals + now
Four-pass calculation (build → buffers → statuses → warnings)
Producing structured warning objects (not strings)
Consequence facts (bufferMins, severity, context — not copy)
What-if simulation via plan mutation
Not responsible for:

Any user-facing string
Any React state
Any store reads or writes
Any knowledge of which profile is active
Any knowledge of what the UI looks like
9.2 Copy layer (src/utils/warningCopy.js, src/utils/tripProfile.js)
Responsible for:

Converting engine warning objects to profile-appropriate strings (renderWarning)
Converting consequence facts to profile-appropriate display lines (renderConsequence)
All profile-specific copy variants (profileCopy)
Not responsible for:

Time arithmetic
Status logic
Any JSX
Store reads
9.3 UI components (src/screens/, src/components/)
Responsible for:

Rendering timeline results as JSX
Calling copy layer functions with the correct profile
Dispatching user actions to the session store
Filtering nulls from copy layer output before rendering
Not responsible for:

Any time arithmetic beyond formatting (formatTime)
Any status logic
Any string generation (beyond labels that are purely structural, e.g., "Next stop")
Any direct string comparisons against engine status strings (use constants from models.js)
9.4 Session store (src/stores/index.js — useSessionStore)
Responsible for:

Holding ephemeral active trip state: isRunning, activeTripId, checkpointActuals, legData
Recording actual arrival/departure times
Action history (undo stack)
What-if simulation state
Not responsible for:

Trip plan data (that is tripStore)
Derived state (that is the engine)
UI state (that is uiStore)
Current limitation: Not persisted. Page refresh during active trip clears all session state. (See Known Technical Debt §10.1 — promoted to MUST before field use.)

Session expiration policy (target behavior once TD-1 is implemented):
Session persists indefinitely during active riding; no background expiration while the app is open or the screen is locked.
On next app open: if a session is found and the trip date matches today, resume silently.
If the session was saved 24–48 hours ago: show a non-blocking banner "Trip in progress from yesterday — continue?" with Continue and End Trip options.
If the session is older than 72 hours: auto-expire (treat as ended), preserve the trip plan, show a brief notice.
Rationale: A motorcycle trip starting early morning may span 10–16 hours including ferry waits. A strict 24h expiration would be too aggressive. 72h covers overnight stops and multi-day scenarios while preventing zombie sessions from forgotten active states.

9.5 Trip store (src/stores/index.js — useTripStore)
Responsible for:

Persisting trip plan data to localStorage
CRUD for trips and checkpoints
Storing manually-entered travel times and modes
Not responsible for:

Session state
Timeline calculation
Active trip identity (session store owns activeTripId)
9.6 Hook layer (src/hooks/useTimeline.js)
Responsible for:

Bridging stores and engine for React consumers
Computing now (planning clock vs. active clock)
Computing tripIsActive
Starting the 30-second live clock when the trip is active
Passing now and sessionIsActive to both calculateTimeline and simulateDelay

10. Known Technical Debt
Identified, understood, and deliberately postponed:

ID	Issue	Impact	Priority
TD-1	Session store not persisted	Page refresh during trip wipes all progress (actuals, legData, isRunning)	MUST — blocks field use
TD-2	Phantom activeTripId in tripStore	Unused field causes confusion about which store owns session identity	Low — no behavioral impact
TD-3	isRunningLate duplicated in GlanceMode and NowScreen	Both compute identical logic from entry.delay > 0; neither fires for stops without plannedArrival	Medium — inconsistency risk
TD-4	delay measured against recommendedArrival for DEPARTURE_DEADLINE	Shows "+2m late" with 28m of buffer still remaining; semantically misleading	Medium — affects trust
TD-5	modeValue local state in LegContextCard goes stale	Re-opening edit panel after save shows previous mode, not saved mode	Low — minor UX glitch
TD-6	StopTimer stale threshold too long for short stops	A 5-minute fuel stop shows the stale prompt after 20 minutes, not 15	Low — minor UX annoyance
TD-7	Individual non-fixed entry shows red dot while trip shows amber	Entry AT_RISK from opening hours; trip TIGHT due to Bug D fix; appears contradictory	Medium — visual hierarchy confusion
TD-8	Three nominally independent timers (hook 30s, StopTimer 5–30s)	StopTimer runs its own clock for elapsed-time display; minor risk of drift from now	Low — display-only difference
