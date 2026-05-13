Time Traveler — Field-Test Readiness Implementation Plan
Status: Pre-field-test stabilization pass
Last updated: 2026-05-13

This document defines what must be true before the first real-world motorcycle trip with the app running mounted. It is not a feature roadmap. It is a trust baseline.

---

## 1. Systems Already Stable — DO NOT CHANGE

These are working correctly, tested, and regression-checked. Any change here before field testing introduces unnecessary risk.

| System | Status | Notes |
|--------|--------|-------|
| Four-pass timeline engine | Stable | Bugs A–E fixed; all passes verified |
| Planning clock vs. active clock | Stable | parseTime / wall clock split correct in useTimeline |
| sessionIsActive explicit parameter | Stable | Engine does not infer from entry states |
| simulateDelay clock consistency | Stable | Uses same now/sessionIsActive as main timeline |
| GlanceMode single clock | Stable | Local liveNow timer removed; uses now prop |
| Structured warning objects | Stable | Engine emits types; copy layer renders strings |
| renderWarning / renderConsequence | Stable | Profile-aware; no speed-implying language |
| getConsequence (engine) | Stable | Correct context/severity/null guards |
| Consequence in GlanceMode arrived panel | Stable | Suppression at 30m ok threshold |
| Consequence in NowScreen StopTimer | Stable | All severities including ok reassurance |
| Consequence in LegContextCard | Stable | Traveling context only |
| What-if simulation | Stable | Uses same clock; panel opens/closes cleanly |
| Trip-level status aggregation | Stable | Fixed vs. soft distinction preserved |
| completedstops excluded from buffers | Stable | Buffer walk skips arrived/completed |
| Skip behavior | Stable | Zero-duration passthrough; downstream recalculates |
| Undo (last action) | Stable | Restores prior checkpoint state |
| Wake Lock API | Stable | Keeps screen on during active trip |
| PWA shell caching | Stable | App loads offline after first visit |

**Freeze rule**: Do not refactor, rename, or touch these systems before the first field trip. The cost of a regression during a live ferry run is high.

---

## 2. Must Stabilize Before Field Use

These are the blockers. The app is not field-ready until all of these are done.

### 2.1 Session Store Persistence (TD-1) — CRITICAL

**Why it blocks**: A phone screen lock, browser refresh, or OS tab kill during an active trip wipes all progress — actuals, legData, elapsed time. On a motorcycle, this happens constantly.

**What to implement**:
- Zustand `persist` middleware on `useSessionStore`
- `partialize` to include: `isRunning`, `activeTripId`, `checkpointActuals`, `legData`, `actionHistory`
- Do NOT persist: `whatIf*` state (ephemeral by nature), `wakelock` handle
- Storage key: `time-traveler-session`
- On hydration: rehydrate silently if `tripDate` matches today; banner if 24–48h old; auto-expire and notify if 72h+

**Regression risk**: HIGH. The session store is read by `useTimeline`, `useSessionStore` consumers in GlanceMode and NowScreen, and the session store's action functions mutate state in place. After adding persistence, verify that:
- Rehydrated actuals correctly feed into `calculateTimeline`
- Starting a new trip on a different `tripId` clears the persisted session (do not resume a stale session for the wrong trip)
- The expiration banner does not appear when the user just locked their phone and returned

---

### 2.2 Glance Mode Auto-Activation on Trip Start (TD-10)

**Why it blocks**: A mounted rider who taps "Start trip" should not have to then navigate to Glance Mode manually. If Glance Mode is the riding HUD, it should be the default state after starting a trip.

**What to implement**:
- When `startTrip()` is dispatched: set `glanceModeActive = true` in `useUIStore`
- User can exit Glance Mode manually; it does not re-open automatically during the session
- Glance Mode deactivates when session ends

**Regression risk**: LOW. Only affects initial state transition. Verify that starting a trip from the Plan screen (not the Now tab) still works correctly.

---

### 2.3 Touch Target Audit — Glance Mode (TD-11)

**Why it blocks**: With gloves and a vibrating handlebar mount, undersized touch targets cause mis-taps. A mis-tap on "Depart now" mid-ride with a modal confirmation is recoverable; a mis-tap on "End trip" is not.

**What to audit**:
- All interactive elements in GlanceMode must be ≥56×56pt (not just 44×44)
- "Mark arrived" and "Depart now" buttons: minimum 64×64pt, full-width preferred
- "Exit Glance" (X): minimum 56×56pt, positioned top-right with generous tap zone
- Action buttons (+5m, +15m): at least 56×56pt; these are tapped with a gloved hand mid-stop

**What NOT to change**: NowScreen touch targets are used at rest (phone in hand). 44×44pt is acceptable there. Only Glance Mode requires the elevated standard.

**Regression risk**: LOW. Purely layout/sizing changes. Verify nothing overlaps or clips on small screens (375pt wide).

---

### 2.4 Depart Now Confirmation Model

**Why it blocks**: Without confirmation, a vibration-triggered mis-tap completes a stop prematurely. The session store records actualDepartureTime and timeline recalculates; the user is now in leg view when they're still at the stop.

**What to implement**:
- Single tap on "Depart now" → inline confirmation replaces the button ("Confirm depart?" + Depart + Wait)
- Confirmation auto-dismisses after 4 seconds (returns to Depart Now button, no state change)
- Confirm tap → sessionStatus = 'completed', actualDepartureTime recorded
- Wait tap → dismisses immediately, returns to Depart Now
- Apply this model in BOTH NowScreen and GlanceMode
- Undo remains available after confirmation as a safety net

**Regression risk**: MEDIUM. StopTimer and GlanceMode both render the Depart Now action path. Verify both paths reach the same store action. Verify undo correctly reverts a confirmed departure.

---

## 3. Should Do Before Field Test (SHOULD — not blocking)

These won't make the trip fail, but their absence will create friction or confusion during the test.

### 3.1 TD-4: delay Measured Against Correct Baseline

The `delay` field currently measures against `recommendedArrival` for departure deadlines. This shows "+2m late" even when 28 minutes of buffer remain — semantically misleading and trust-eroding.

**Fix**: For DEPARTURE_DEADLINE entries, measure delay against `latestSafeArrival`, not `recommendedArrival`. Or suppress the delay indicator for entries where `bufferMinutes > trip.defaultBuffer`.

**Priority**: SHOULD before field test. A rider seeing "+2m late" with a 28-minute buffer will distrust the app.

---

### 3.2 TD-7: Visual Hierarchy Clarification (Entry vs. Trip Status)

An OPENING_HOURS entry can show a red dot while the trip header shows amber. This is correct per engine rules (soft stops cap at TIGHT) but looks contradictory.

**Fix**: Add a subtle legend or tooltip ("Opening hours issues don't affect your main timeline"). Or: change the entry red dot to amber for non-fixed entries regardless of their entry-level status, reserving red for isFixed entries only.

**Priority**: SHOULD. Will generate confusion during a test debrief.

---

### 3.3 Navigate Button in Glance Mode (A3)

Users navigating to an unfamiliar stop from Glance Mode currently need to exit Glance, find the stop, tap Navigate. This defeats the purpose of a riding HUD.

**Fix**: Add a Navigate button to the Glance Mode arrived panel (next to or below "Depart now"). Opens the stop's address in the system navigation app. Only visible when `cp.address` is set.

**Priority**: SHOULD. Without it, the riding workflow requires exiting Glance Mode to get navigation, which is exactly the scenario the HUD is meant to avoid.

---

### 3.4 Remove TRIP_MODE / TRANSPORT_MODE from Creation Form (TD-9)

These fields are in the data model but the engine doesn't use them yet. They add form complexity without benefit and make the trip creation flow feel heavier than it needs to be.

**Fix**: Hide these fields from the creation UI. Keep them in the model for future use.

**Priority**: SHOULD (UX clarity during setup).

---

## 4. Intentionally Deferred Until After Field Test

Do not implement these before the first real trip. The field test will surface which of these actually matters.

| Feature | Why wait |
|---------|----------|
| Live GPS / geofencing | Battery impact unknown in real conditions; auto-arrival UX needs field validation |
| Google Maps ETA bootstrap | **Primary post-field-test decision point.** Field test measures whether manual ETA entry friction is acceptable. If it isn't, this is the next implementation priority — not a permanently deferred feature. |
| Google Maps deep link routing | Simple address handoff works; routing integration adds complexity before validating need |
| In-app map preview | Not needed alongside split-screen |
| Push notifications | Glance Mode covers the use case; notification permission UX adds friction to onboarding |
| Cloud sync / accounts | localStorage is sufficient for solo use; validate multi-device need after field use |
| TD-3: isRunningLate deduplication | Display-only inconsistency; no behavioral impact during riding |
| TD-5: modeValue stale state | Minor UX glitch at rest; not a riding-context issue |
| TD-6: StopTimer stale threshold | Edge case for very short stops; not critical for typical ferry-run scenarios |
| TD-8: Timer drift (hook 30s vs StopTimer) | Display-only, subsecond-level; no consequence for planning decisions |
| Recurrence / repeating trips | Future feature |
| Trip export | Future feature |

---

## 5. Implementation Order

Each block is a safe commit boundary. Blocks 1–5B are complete.

```
Block 1 (COMPLETE)
  ✓ Session store persistence (TD-1)
  ✓ Session expiration policy (fresh / stale / expired banner logic)

Block 2 (COMPLETE)
  ✓ Depart Now inline confirmation model (NowScreen + GlanceMode)

Block 3 (COMPLETE)
  ✓ Glance Mode auto-activation on trip start

Block 4 (COMPLETE)
  ✓ Touch target audit — GlanceMode (all primary ≥64pt, all interactive ≥56pt)

Block 5A (COMPLETE)
  ✓ TD-4: delay baseline fix — DEPARTURE_DEADLINE measures against latestSafeArrival

Block 5B (COMPLETE)
  ✓ Navigate button in Glance Mode arrived state (paired with Exit row, zero height impact)

Block 7 (COMPLETE)
  ✓ Degraded-mode ETA capture in Glance Mode
  ✓ "How long from Maps?" preset grid (15/25/30/45/60/···) in traveling metrics card
  ✓ Custom minute input with Enter-key confirm and cancel
  ✓ One tap on preset calls updateLeg and exits degraded mode immediately
  ✓ Directive updated: "Check Maps — tap a time below"
  ✓ ETA entry resets when etaUncertain resolves; persists via legData through refresh

Block 8 (SHOULD)
  → TD-7: visual hierarchy clarification (entry red dot vs. trip amber)
  → Fix or label: non-fixed entries should not show red when trip shows amber
  → Verify: regression checklist §8 passes; planning and active views both correct

Block 9 (SHOULD + CLEANUP)
  → Remove TRIP_MODE / TRANSPORT_MODE from creation form (TD-9)
  → Fix TimelineView "Departed" button — add confirmation model matching Blocks 2 + GlanceMode
  → Verify: trip creation flow is shorter; timeline view departure is safe against mis-tap
```

---

## 6. Regression-Sensitive Areas

Changes in Blocks 1–4 have the highest regression risk. Run these checks after each block:

**After Block 1 (session persistence)**:
- Planning view: past-date trip shows no false MISSED states
- Active session: timeline recalculates correctly from rehydrated actuals
- New trip: starting a new trip clears any persisted session for a different tripId
- What-if: simulation still uses correct clock (not rehydrated stale now)
- End trip: clears persisted session; Now screen returns to no-active state

**After Block 2 (Depart Now confirmation)**:
- NowScreen path: confirmation appears, auto-dismisses at 4s, confirm records departure
- GlanceMode path: same as NowScreen; both reach same store action
- Undo: departure reverted correctly; consequence and LegContextCard update
- Mark arrived path: unchanged (no confirmation needed — not a hard transition)

**After Block 3 (Glance auto-activation)**:
- Starting trip from Trips screen: Glance opens, not blank
- Starting trip from Plan screen: same
- Manual exit from Glance: stays off for remainder of session unless user re-opens
- Ending trip: Glance deactivates; Now screen no-active state is clean

**After Block 4 (touch targets)**:
- 375pt wide (SE-sized) screen: no element clipping or overlapping
- 390pt wide (standard): layout correct
- GlanceMode text is still readable at all target sizes

**After Block 7 (degraded-mode ETA capture)**:
- ETA entry UI appears in traveling state when no travel time is set for the current leg
- ETA entry UI does NOT appear when travel time is already set (normal ETA row shows instead)
- ETA entry UI does NOT appear in arrived state
- Preset tap (e.g. 25m): engine recalculates; ETA row replaces entry UI on next render; consequence wakes up
- Custom entry (···): number input appears; Enter key submits; × cancels and returns to preset grid
- Custom entry with invalid value (0, empty, letters): Set button is disabled; no updateLeg call
- Entering ETA mid-leg: downstream ETAs for all subsequent stops update; consequence recalculates
- Updating ETA after it was already set: entering a new value via preset replaces the previous legData entry
- Consequence escalation after ETA entry: if entering a travel time produces AT_RISK, status updates and haptic fires
- Split-screen (top half, ~390×400): preset grid is fully visible without scrolling
- Preset button touch targets: all ≥56pt tall, ≥80pt wide on a 375pt screen
- ETA persists after browser refresh: legData is in session store partialize; entry UI does not reappear after refresh
- Stale entry state does not persist across stops: entering a new stop clears etaCustomOpen and etaCustomMins
- LegContextCard (NowScreen) inline editor: still works for ETA entry in the dashboard view (unchanged; regression guard)

---

## 7. Device Testing Priorities

| Priority | Device | Why |
|----------|--------|-----|
| 1 | Android phone (primary field device) | Split-screen workflow target; confirms half-screen usability |
| 2 | Chrome on desktop (development) | Fast iteration; catches most logic bugs |
| 3 | iPhone (Safari) | iOS app-switching workflow; PWA install behavior differs |
| 4 | Small Android (≤5.5") | Checks minimum layout assumptions |

**Mounted-phone simulation**: Before the actual trip, test in the following conditions:
- Screen brightness at 50% outdoors (visibility)
- One-handed operation (other hand "on handlebar")
- Glance Mode usability at arm's length without reading text
- Split-screen with Google Maps occupying the bottom half: verify Time Traveler top half is not clipped

---

## 8. PWA / Session Lifecycle Validation

These scenarios specifically test the interaction between the browser's PWA lifecycle and session persistence after Block 1 is implemented:

| Scenario | Expected behavior |
|----------|-------------------|
| Tab refresh mid-trip | Session rehydrates; timeline continues from last actuals |
| Browser force-quit mid-trip | Session rehydrates on re-open |
| Phone screen lock during Glance Mode | Session preserved; Glance Mode state depends on UIStore persistence |
| OS kills tab (low memory) | Session rehydrates on next app open |
| Open app next day (< 72h) | Stale-session banner shown; user chooses continue or end |
| Open app (> 72h) | Session auto-expired; trip plan preserved; brief notice shown |
| Start new trip while stale session exists (different tripId) | Old session cleared; new session begins cleanly |
| Wake Lock: does it survive screen lock? | Wake Lock releases on lock; re-request on unlock if app is visible |
| Trip started with no travel times set | App shows deadline name/time, "ETA unknown" state with inline editor — not a blank or error state |
| Travel time entered mid-leg via LegContextCard | All downstream ETAs and consequences recalculate immediately; no stale display |
| One leg has travel time, next does not | Engine propagates uncertainty correctly from the missing leg forward; stops before the gap show correct ETAs |

---

## 9. Split-Screen Validation Priorities (Android)

Once the app is installed as a PWA on an Android device, validate split-screen in this order:

1. **App launches in split-screen**: PWA opens correctly when dragged to split-screen slot
2. **Top-half layout**: Status bar, alert banner, and LegContextCard or StopTimer all visible without scrolling
3. **Glance Mode in split-screen**: Full Glance Mode occupies the top half; layout is not clipped
4. **Touch targets in split-screen**: Depart Now and Mark Arrived are reachable with one thumb
5. **Maps interaction**: Switching focus to Maps bottom half and back does not trigger page reload or session loss
6. **Rotation**: If the device rotates (likely never on a mount, but test it), layout remains usable

---

## 10. What Constitutes "Field-Ready"

The app is ready for the first real-world motorcycle field test when:

- [ ] Session survives a browser refresh or OS kill mid-trip
- [ ] Glance Mode opens automatically when a trip is started
- [ ] Depart Now requires confirmation; mis-tap auto-dismisses
- [ ] All Glance Mode interactive elements meet 56×56pt minimum
- [ ] Delay indicator does not show "late" when meaningful buffer exists
- [ ] Navigate button is accessible from Glance Mode
- [ ] Split-screen layout shows all critical information without scrolling
- [ ] App shows deadline name/time clearly when travel time is unknown (not silent, not broken)
- [x] Inline leg editor is reachable from the traveling view without exiting Glance Mode
- [ ] All regression checklist items in §8 of the contract pass

When all items are checked, the app is ready to be mounted and tested on a real trip.

---

## 11. Field Test Philosophy — Companion-First Validation

Time Traveler is a deadline-aware travel companion, not a route planner. This distinction shapes what the field test is measuring.

**What the field test is NOT validating:**
Whether a fully-modeled route (all travel times set, buffer preferences configured) produces accurate timeline forecasts. That is the engine's job, and the engine is stable.

**What the field test IS validating:**
1. Does the consequence engine communicate the right thing at the right moment during a real ride?
2. Is the information hierarchy (deadline status → consequence → action) legible under real riding conditions?
3. Does the app remain useful when setup data is incomplete — specifically, when travel times are missing?
4. Is manual ETA capture during a leg fast enough to be practical, or does it break the rider's flow?
5. Is Glance Mode operable at arm's length, with gloves, on a vibrating mount?
6. Does the app communicate calmly when things are fine, and clearly when they aren't?

**The primary post-field-test decision:**
After the trip, evaluate question 4 honestly. If manual ETA entry is smooth enough to use at a fuel stop or junction, the current MVP ETA strategy is sufficient. If it creates enough friction that riders won't do it, Maps API ETA bootstrap becomes the next implementation priority (see contract §5.11).

**Minimum operationally useful state:**
The app is operationally useful during a leg if the rider can answer all three of the following without removing the phone from the mount:
1. Do I have a connection to catch? (deadline name and time)
2. Am I on track? (OK / TIGHT / AT_RISK, or explicit "ETA unknown — tap to set")
3. What do I need to do right now? (directive in Glance Mode, or action button)

A missing travel time may prevent answering question 2 precisely. It must not prevent answering questions 1 or 3. Test this scenario explicitly during the field run.

**Uncertainty tolerance test:**
At least once during the field test: start a leg without entering a travel time. Observe what the app shows. Then enter a rough estimate via LegContextCard and observe the consequence update. This directly validates the degraded operational mode defined in the product contract (§2.12).
