import { useEffect } from 'react'
import { completeOnlineAccountFromRedirect } from '../../features/account/accountService'
import {
  addAndroidAuthCallbackListener,
  consumePendingAndroidAuthCallback,
  isAndroidNativeAccountAuth,
} from './nativeAccountAuth'

export function AndroidAuthRuntime() {
  useEffect(() => {
    if (!isAndroidNativeAccountAuth()) return

    let active = true
    let processing = false
    let rerunRequested = false
    let listenerHandle: { remove(): Promise<void> } | null = null

    async function drainCallbacks() {
      if (!active) return
      if (processing) {
        rerunRequested = true
        return
      }

      processing = true
      try {
        do {
          rerunRequested = false
          const callbackUrl = await consumePendingAndroidAuthCallback()
          if (!active || !callbackUrl) return

          try {
            await completeOnlineAccountFromRedirect(callbackUrl)
          } catch (error) {
            console.error('OANIX Android OAuth callback failed', error)
          }

          rerunRequested = true
        } while (active && rerunRequested)
      } finally {
        processing = false
        if (active && rerunRequested) void drainCallbacks()
      }
    }

    void addAndroidAuthCallbackListener(() => {
      rerunRequested = true
      void drainCallbacks()
    })
      .then((handle) => {
        if (!active) {
          void handle.remove()
          return
        }
        listenerHandle = handle
        void drainCallbacks()
      })
      .catch(() => {
        if (active) void drainCallbacks()
      })

    return () => {
      active = false
      if (listenerHandle) void listenerHandle.remove()
    }
  }, [])

  return null
}
