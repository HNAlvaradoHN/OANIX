import { useEffect, useRef, useState } from 'react'

export const OANIX_OPERATION_FEEDBACK_DELAY_MS = 800
export const OANIX_OPERATION_STILL_RUNNING_MS = 5_000

export function useDelayedOperationFeedback(
  delayMs = OANIX_OPERATION_FEEDBACK_DELAY_MS,
  stillRunningMs = OANIX_OPERATION_STILL_RUNNING_MS,
) {
  const delayTimerRef = useRef<number | null>(null)
  const slowTimerRef = useRef<number | null>(null)
  const [visible, setVisible] = useState(false)
  const [stillRunning, setStillRunning] = useState(false)

  function clearTimers() {
    if (delayTimerRef.current !== null) window.clearTimeout(delayTimerRef.current)
    if (slowTimerRef.current !== null) window.clearTimeout(slowTimerRef.current)
    delayTimerRef.current = null
    slowTimerRef.current = null
  }

  function start() {
    clearTimers()
    setVisible(false)
    setStillRunning(false)
    delayTimerRef.current = window.setTimeout(() => {
      delayTimerRef.current = null
      setVisible(true)
    }, delayMs)
    slowTimerRef.current = window.setTimeout(() => {
      slowTimerRef.current = null
      setVisible(true)
      setStillRunning(true)
    }, stillRunningMs)
  }

  function finish() {
    clearTimers()
    setVisible(false)
    setStillRunning(false)
  }

  useEffect(() => () => clearTimers(), [])

  return { visible, stillRunning, start, finish }
}
