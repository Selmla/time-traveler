# Time Traveler — MVP

Smart trip timeline assistant. Handles timelines, buffers, and "what if?" simulations so Google Maps doesn't have to.

---

## Quick Start

### Prerequisites
- Node.js 18+ ([download](https://nodejs.org))
- VS Code (recommended)

### Install and run

```bash
# 1. Go to the project folder
cd time-traveler

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Test on your phone (same WiFi network)

```bash
# Start dev server with network access
npm run dev -- --host
```

Your terminal will show something like:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.42:5173/
```

Open the **Network URL** on your phone.

---

## Install as PWA on your phone

### Android (Chrome)
1. Open the network URL in Chrome
2. Tap the three-dot menu (⋮)
3. Tap "Add to Home screen"
4. Confirm

### iPhone (Safari)
1. Open the network URL in Safari (must be Safari, not Chrome)
2. Tap the Share button (📤)
3. Scroll down and tap "Add to Home Screen"
4. Confirm

Once installed, it runs like a native app — no browser UI.

---

## Build for production

```bash
npm run build
npm run preview -- --host   # test production build on phone
```

---

## Project Structure

```
src/
├── engine/
│   ├── models.js      ← Data models and factories (start here)
│   └── timeline.js    ← Pure timeline calculation engine
│
├── stores/
│   └── index.js       ← Zustand stores (trip data, session, UI)
│
├── hooks/
│   └── useTimeline.js ← React hook connecting engine to components
│
├── utils/
│   ├── time.js        ← All time manipulation utilities
│   └── maps.js        ← Google Maps deep links and ETA
│
├── components/
│   ├── ui/            ← Shared primitives (Button, Card, etc.)
│   ├── timeline/      ← Timeline display components
│   └── whatif/        ← What-If simulation panel
│
└── screens/
    ├── NowScreen.jsx   ← Active trip dashboard
    ├── TripsScreen.jsx ← Trip list and creation
    └── PlanScreen.jsx  ← Trip planning and checkpoint editing
```

---

## Architecture Principles

**The engine is pure.** `calculateTimeline()` in `engine/timeline.js` is a plain JavaScript function. No React. No side effects. You can call it from a test file or a Node script.

**Stores hold data, not logic.** The Zustand stores are responsible for state management and persistence. Business logic lives in `engine/`.

**Local-first.** All data is in localStorage. No backend, no auth, no network required (except for Google Maps ETA, which is optional).

**The UI renders the engine's output.** The `useTimeline` hook calls `calculateTimeline()` and passes the result to components. Components never do timeline math themselves.

---

## Google Maps ETA (Optional)

By default, ETA integration is disabled. The app works fully without it.

To enable:
1. Get a Google Maps API key with Distance Matrix API enabled
2. Create `.env.local`:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_key_here
   ```
3. The ETA hook will automatically use it

Without an API key, travel times must be entered manually per checkpoint (the `travelTimeToNext` field).

---

## How the Timeline Engine Works

1. `calculateTimeline(trip, sessionData, etaData)` walks through each checkpoint
2. Starting from `trip.startTime`, it propagates time forward
3. Each checkpoint's `estimatedArrival` is based on: actual time (if confirmed) → ETA from Maps → calculated from previous checkpoint + travel time
4. If a checkpoint has `isFixed: true`, its time cannot shift — delay converts into reduced buffer
5. Buffer is calculated as: `deadlineTime - estimatedArrival - requiredBuffer`
6. Status is assigned based on buffer thresholds: ok/tight/at_risk/missed
7. Warnings are generated for opening hours conflicts, low buffer, etc.

The What-If simulation runs the same function with a modified trip (extra duration added to one checkpoint) and returns a parallel result for comparison.

---

## Ferry/Train Logic

For checkpoints of type `fixed`:
1. Add departure times manually (e.g. 08:45, 10:15, 12:30)
2. The engine picks the first departure where `departure_time - eta >= required_buffer`
3. The selected departure becomes the "deadline" for buffer calculation
4. If no departure works, the status goes `at_risk` immediately

---

## Next Steps After This MVP

- [ ] Add Google Maps ETA integration (connect the `updateETA` store action)
- [ ] Add push notifications (Web Push API or local notifications)
- [ ] Add PWA icons (replace placeholder icons in public/)
- [ ] Add ferry departure suggestion UI in the What-If panel
- [ ] Add vibration alerts (`navigator.vibrate([200, 100, 200])`)
- [ ] Add trip templates for common trip types
