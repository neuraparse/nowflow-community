import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook that provides a local value that syncs to an external store with debouncing.
 * Local state updates instantly for responsive UI; store updates are debounced
 * so the store doesn't fire on every keystroke.
 *
 * External changes (undo, auto-fill, etc.) are picked up when not focused.
 */
export function useDebouncedValue(
  storeValue: any,
  setStoreValue: (val: string) => void,
  debounceMs = 300
) {
  const [localValue, setLocalValue] = useState(storeValue?.toString() ?? '')
  const storeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const localValueRef = useRef(localValue)
  localValueRef.current = localValue
  const [isFocused, setIsFocused] = useState(false)

  // Debounced store sync -- only writes to store after user pauses typing
  const syncToStore = useCallback(
    (val: string) => {
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current)
      storeTimerRef.current = setTimeout(() => {
        setStoreValue(val)
      }, debounceMs)
    },
    [setStoreValue, debounceMs]
  )

  // Flush pending store update immediately (used on blur, paste, drop, etc.)
  const flushToStore = useCallback(
    (val: string) => {
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current)
      storeTimerRef.current = null
      setStoreValue(val)
    },
    [setStoreValue]
  )

  // Sync external -> local when store changes externally (undo, auto-fill, etc.)
  useEffect(() => {
    const ext = storeValue?.toString() ?? ''
    if (!isFocused && ext !== localValueRef.current) {
      setLocalValue(ext)
    }
  }, [storeValue, isFocused])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (storeTimerRef.current) clearTimeout(storeTimerRef.current)
    }
  }, [])

  // Unified setter: updates local state immediately, flushes to store (for non-typing actions)
  const setValue = useCallback(
    (newVal: string) => {
      setLocalValue(newVal)
      flushToStore(newVal)
    },
    [flushToStore]
  )

  return {
    localValue,
    setLocalValue,
    localValueRef,
    isFocused,
    setIsFocused,
    syncToStore,
    flushToStore,
    setValue,
  }
}
