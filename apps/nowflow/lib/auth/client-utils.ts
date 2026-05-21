const LOGGED_IN_KEY = 'has_logged_in_before'
const ONE_YEAR_SECONDS = 31536000

export const markUserLoggedIn = (): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOGGED_IN_KEY, 'true')
  document.cookie = `${LOGGED_IN_KEY}=true; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`
}

export const hasUserLoggedInBefore = (): boolean => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(LOGGED_IN_KEY) === 'true'
}
