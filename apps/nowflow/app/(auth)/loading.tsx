export default function AuthLoading() {
  return (
    <div className="community-ui-landing community-ui-auth flex min-h-screen items-center justify-center bg-[#04070a] text-white">
      <div className="silver-glass-pane flex flex-col items-center gap-3 rounded-[18px] px-6 py-5">
        <svg
          className="h-6 w-6 animate-spin text-[#dcfd38]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-sm text-white/62">Loading...</p>
      </div>
    </div>
  )
}
