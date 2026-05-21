export const modalOverlayClassName =
  'workflow-editor-overlay fixed inset-0 z-50 bg-black/35 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:bg-black/55'

export const modalFocusRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/[0.08] dark:focus-visible:ring-white/[0.08]'

export const modalCloseButtonClassName =
  'workflow-editor-icon-button workflow-editor-dialog-close absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none'

export const modalContentBaseClassName =
  'workflow-editor-dialog-content workflow-editor-portal-surface z-50 gap-4 border bg-background p-6 text-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
