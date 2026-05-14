// Vercel serverless function — travel time estimation via Google Routes API.
// Called only on explicit user action. API key is read from process.env at
// request time and is never bundled into the browser or logged.

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'

const MODE_MAP = {
  driving: 'DRIVE',
  walking: 'WALK',
  cycling: 'BICYCLE',
  transit: 'TRANSIT',
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'POST only' })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return res.status(503).json({
      error: 'CONFIG_ERROR',
      message: 'Maps not configured on server',
    })
  }

  const { originAddress, destAddress, travelMode } = req.body ?? {}

  if (!originAddress?.trim() || !destAddress?.trim()) {
    return res.status(400).json({
      error: 'MISSING_ADDRESS',
      message: 'Origin and destination addresses are required',
    })
  }

  const googleMode = MODE_MAP[travelMode] ?? 'DRIVE'

  const body = {
    origin:      { address: originAddress.trim() },
    destination: { address: destAddress.trim() },
    travelMode:  googleMode,
    computeAlternativeRoutes: false,
    languageCode: 'en-US',
    units: 'METRIC',
  }

  if (googleMode === 'DRIVE') {
    body.routingPreference = 'TRAFFIC_UNAWARE'
  }

  if (googleMode === 'TRANSIT') {
    body.departureTime = new Date().toISOString()
  }

  let googleRes
  try {
    googleRes = await fetch(ROUTES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify(body),
    })
  } catch {
    return res.status(502).json({
      error: 'NETWORK_ERROR',
      message: 'Could not reach Google Maps',
    })
  }

  if (!googleRes.ok) {
    // Log only the status code, never the key or request details
    console.error('Google Routes API error status:', googleRes.status)
    return res.status(502).json({
      error: 'API_ERROR',
      message: 'Google Maps returned an error',
    })
  }

  const data = await googleRes.json()

  if (!data.routes?.length) {
    return res.status(422).json({
      error: 'NO_ROUTE',
      message: 'No route found between these locations',
    })
  }

  const route = data.routes[0]

  // duration is returned as a string like "2823s" — parseInt stops at the 's'
  const durationSeconds = parseInt(route.duration, 10)
  if (!durationSeconds || durationSeconds < 0) {
    return res.status(422).json({
      error: 'INVALID_RESPONSE',
      message: 'Unexpected response from Google Maps',
    })
  }

  const travelTimeMinutes = Math.max(1, Math.round(durationSeconds / 60))
  const distanceKm = route.distanceMeters != null
    ? Math.round(route.distanceMeters / 100) / 10
    : null

  return res.json({ travelTimeMinutes, distanceKm, source: 'google' })
}
