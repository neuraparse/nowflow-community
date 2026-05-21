import React from 'react'
import { XIcon } from 'lucide-react'

type ValidationResult = {
  valid: boolean
  errors: unknown[]
  warnings: unknown[]
}

type BlockStateBannersProps = {
  hasValidationError: boolean | undefined | null | false | 0
  hasValidationWarning: boolean | undefined | null | false | 0
  bannerDismissed: boolean
  warningBannerDismissed: boolean
  validationResult: ValidationResult | undefined
  setBannerDismissed: (v: boolean) => void
  setWarningBannerDismissed: (v: boolean) => void
}

export const BlockStateBanners = React.memo(function BlockStateBanners({
  hasValidationError,
  hasValidationWarning,
  bannerDismissed,
  warningBannerDismissed,
  validationResult,
  setBannerDismissed,
  setWarningBannerDismissed,
}: BlockStateBannersProps) {
  return (
    <>
      {/* Validation Error — minimal inline strip */}
      {hasValidationError && !bannerDismissed && validationResult && (
        <div
          className="workflow-editor-block-state-banner workflow-editor-block-state-banner-error mt-1.5 pt-1.5 border-t border-amber-200/70 dark:border-amber-500/24 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="workflow-editor-block-state-dot w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500 dark:bg-amber-300" />
          <span className="workflow-editor-block-state-text text-[8px] font-logo font-medium text-amber-700 dark:text-amber-300 truncate flex-1">
            {validationResult.errors.length} field
            {validationResult.errors.length > 1 ? 's' : ''} need configuration
          </span>
          <button
            className="workflow-editor-block-state-dismiss text-amber-500/80 hover:text-amber-700 dark:text-amber-300/80 dark:hover:text-amber-200 transition-colors flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              setBannerDismissed(true)
            }}
          >
            <XIcon className="w-2.5 h-2.5" strokeWidth={1.7} />
          </button>
        </div>
      )}

      {/* Validation Warning — minimal inline strip */}
      {!hasValidationError &&
        hasValidationWarning &&
        !warningBannerDismissed &&
        validationResult && (
          <div
            className="workflow-editor-block-state-banner workflow-editor-block-state-banner-warning mt-1.5 pt-1.5 border-t border-amber-200/60 dark:border-amber-500/20 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="workflow-editor-block-state-dot w-1.5 h-1.5 rounded-full flex-shrink-0 bg-amber-500 dark:bg-amber-300" />
            <span className="workflow-editor-block-state-text text-[8px] font-logo font-medium text-amber-700 dark:text-amber-300 truncate flex-1">
              {validationResult.warnings.length} warning
              {validationResult.warnings.length > 1 ? 's' : ''}
            </span>
            <button
              className="workflow-editor-block-state-dismiss text-amber-500/80 hover:text-amber-700 dark:text-amber-300/80 dark:hover:text-amber-200 transition-colors flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                setWarningBannerDismissed(true)
              }}
            >
              <XIcon className="w-2.5 h-2.5" strokeWidth={1.7} />
            </button>
          </div>
        )}
    </>
  )
})
