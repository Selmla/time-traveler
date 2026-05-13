import { useState, useRef, useEffect } from 'react'

const CONFIRM_TIMEOUT_MS = 4000

/**
 * Manages the two-tap "Depart now" confirmation flow.
 *
 * Usage:
 *   const { pending, requestDepart, confirm, cancel } = useDepartConfirm(() => markDeparted(cpId))
 *
 * - Call requestDepart() on first tap → pending becomes true, 4s timer starts
 * - Timer expiry → pending resets to false (no departure recorded)
 * - Call confirm() → timer cleared, onConfirm() called, pending resets
 * - Call cancel()  → timer cleared, pending resets (no departure)
 *
 * Timer is stored in a ref so it does not cause re-renders and is not
 * restarted by unrelated re-renders during the confirmation window.
 * The cleanup effect prevents stale callbacks after unmount.
 */
export function useDepartConfirm(onConfirm) {
  const [pending, setPending] = useState(false)
  const timerRef = useRef(null)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => clearTimer, [])

  const requestDepart = () => {
    clearTimer()
    setPending(true)
    timerRef.current = setTimeout(() => {
      setPending(false)
      timerRef.current = null
    }, CONFIRM_TIMEOUT_MS)
  }

  const confirm = () => {
    clearTimer()
    setPending(false)
    onConfirm()
  }

  const cancel = () => {
    clearTimer()
    setPending(false)
  }

  return { pending, requestDepart, confirm, cancel }
}
