// ============================================================
// MAPS UTILITIES
// ============================================================
// Everything Google Maps-related lives here.
// The app does NOT build navigation — it links to Maps.
// ============================================================

/**
 * Build a Google Maps navigation deep link.
 * Opens Maps with a destination pre-filled.
 *
 * On mobile, this opens the Maps app.
 * On desktop, opens maps.google.com.
 *
 * @param {string} destination  - address or "lat,lng"
 * @returns {string} URL
 */
export function buildMapsNavigationUrl(destination) {
  if (!destination) return null
  const encoded = encodeURIComponent(destination)
  // google.navigation: is the native app deep link on Android
  // maps.apple.com for iOS
  // We use maps.google.com as the universal fallback
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
}

/**
 * Build a Google Maps URL to show a place (not navigate).
 */
export function buildMapsPlaceUrl(name, address) {
  const query = encodeURIComponent(address || name)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}

/**
 * Open Google Maps for navigation.
 * Call this when the user taps "Navigate" on a checkpoint.
 */
export function openNavigation(checkpoint) {
  const destination = checkpoint.address || checkpoint.name
  if (!destination) return

  // Try to use coordinates if available (more precise)
  const dest = checkpoint.lat && checkpoint.lng
    ? `${checkpoint.lat},${checkpoint.lng}`
    : destination

  const url = buildMapsNavigationUrl(dest)
  window.open(url, '_blank')
}

/**
 * Fetch ETA from Google Maps API.
 *
 * NOTE: For MVP, this requires a Google Maps API key with
 * the Distance Matrix API enabled.
 *
 * @param {string} originLat
 * @param {string} originLng
 * @param {string} destLat
 * @param {string} destLng
 * @param {string} apiKey
 * @returns {Promise<{ durationMinutes: number, durationInTrafficMinutes: number }>}
 */
export async function fetchETA(originLat, originLng, destLat, destLng, apiKey) {
  if (!apiKey) {
    console.warn('[Maps] No API key configured — ETA unavailable')
    return null
  }

  const now = Math.floor(Date.now() / 1000)
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
    `origins=${originLat},${originLng}` +
    `&destinations=${destLat},${destLng}` +
    `&departure_time=${now}` +
    `&traffic_model=best_guess` +
    `&key=${apiKey}`

  try {
    const response = await fetch(url)
    const data = await response.json()

    const element = data?.rows?.[0]?.elements?.[0]
    if (!element || element.status !== 'OK') return null

    return {
      durationMinutes:          Math.ceil(element.duration.value / 60),
      durationInTrafficMinutes: Math.ceil((element.duration_in_traffic?.value || element.duration.value) / 60),
    }
  } catch (err) {
    console.error('[Maps] ETA fetch failed:', err)
    return null
  }
}

/**
 * Get current position using the browser's Geolocation API.
 * @returns {Promise<{ lat, lng } | null>}
 */
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => resolve(null),
      { timeout: 10000, maximumAge: 60000 }
    )
  })
}
