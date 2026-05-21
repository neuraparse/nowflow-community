import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768

function subscribeToResize(callback: () => void) {
  window.addEventListener('resize', callback)
  return () => window.removeEventListener('resize', callback)
}

const subscribeToClientMount = () => () => {}
const getClientMountedSnapshot = () => true
const getServerMountedSnapshot = () => false
const getMobileSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT
const getServerMobileSnapshot = () => false

export default function useIsMobile() {
  const isMobile = useSyncExternalStore(
    subscribeToResize,
    getMobileSnapshot,
    getServerMobileSnapshot
  )
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    getClientMountedSnapshot,
    getServerMountedSnapshot
  )

  return { isMobile, mounted }
}
