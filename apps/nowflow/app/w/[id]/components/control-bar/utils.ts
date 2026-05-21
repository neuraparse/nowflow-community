/**
 * Dispatch custom event to open settings modal with subscription tab.
 */
export function openSubscriptionSettings() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('open-settings', {
        detail: { tab: 'subscription' },
      })
    )
  }
}
