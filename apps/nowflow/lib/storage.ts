'use client'

/**
 * Storage detection helper that determines if we should use local storage
 * This is used when running via the CLI with `npx nowflow`
 */

// Check if we should use local storage based on environment variable
export const getLocalStorageFlag = () => {
  // In client components, check for the environment variable in localStorage
  // This is set by the CLI when running with `npx nowflow`
  if (typeof window !== 'undefined') {
    return localStorage.getItem('USE_LOCAL_STORAGE') === 'true'
  }

  // In server components/API routes, check process.env
  return process.env.USE_LOCAL_STORAGE === 'true'
}

// Export helpers for components to use
export const storageMode = {
  get isLocal() {
    return getLocalStorageFlag()
  },
  get isDatabase() {
    return !getLocalStorageFlag()
  },
}
