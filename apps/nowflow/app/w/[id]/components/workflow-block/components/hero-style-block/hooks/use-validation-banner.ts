import { useEffect, useState } from 'react'
import { useValidationStore } from '@/stores/validation/store'

export const useValidationBanner = (id: string) => {
  // Pre-run validation error state
  const validationResult = useValidationStore((s) => s.blockValidations[id])
  const hasValidationError = validationResult && !validationResult.valid
  const hasValidationWarning =
    validationResult?.valid === true && (validationResult?.warnings?.length ?? 0) > 0
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [warningBannerDismissed, setWarningBannerDismissed] = useState(false)

  // Reset dismissed states when respective issues appear
  useEffect(() => {
    if (hasValidationError) {
      setBannerDismissed(false)
    }
  }, [hasValidationError])

  useEffect(() => {
    if (hasValidationWarning) {
      setWarningBannerDismissed(false)
    }
  }, [hasValidationWarning])

  return {
    validationResult,
    hasValidationError,
    hasValidationWarning,
    bannerDismissed,
    setBannerDismissed,
    warningBannerDismissed,
    setWarningBannerDismissed,
  }
}
