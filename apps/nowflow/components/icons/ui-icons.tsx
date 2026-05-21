import { SVGProps } from 'react'

export function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function PenToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 19 7-7 3 3-7 7-3-3z" />
      <path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
      <path d="m2 2 7.586 7.586" />
      <circle cx="11" cy="11" r="2" />
    </svg>
  )
}

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  )
}

export function Spinner() {
  return (
    <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center">
      <svg
        className="animate-spin -ml-1 mr-3 h-5 w-5 text-zinc-800 dark:text-white"
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
    </div>
  )
}

export function WarnIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 9.3152V16.4654M15 20.6853V20.0353M2.91879 12.7837C2.62752 13.0747 2.39645 13.4202 2.2388 13.8005C2.08115 14.1809 2 14.5885 2 15.0002C2 15.412 2.08115 15.8196 2.2388 16.2C2.39645 16.5803 2.62752 16.9258 2.91879 17.2168L12.7834 27.0814C13.0744 27.3727 13.4199 27.6038 13.8003 27.7614C14.1806 27.9191 14.5883 28.0002 15 28.0002C15.4117 28.0002 15.8194 27.9191 16.1997 27.7614C16.58 27.6038 16.9256 27.3727 17.2166 27.0814L27.0812 17.2168C27.3725 16.9258 27.6035 16.5803 27.7612 16.2C27.9189 15.8196 28 15.412 28 15.0002C28 14.5885 27.9189 14.1809 27.7612 13.8005C27.6035 13.4202 27.3725 13.0747 27.0812 12.7837L17.2166 2.91904C16.9256 2.62776 16.58 2.3967 16.1997 2.23904C15.8194 2.08139 15.4117 2.00024 15 2.00024C14.5883 2.00024 14.1806 2.08139 13.8003 2.23904C13.4199 2.3967 13.0744 2.62776 12.7834 2.91904L2.91879 12.7837Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="30"
      height="25"
      viewBox="0 0 30 25"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.1605 23.1773L15.1552 12.5569M25.5937 19.1946C31.5611 14.9996 26.2243 8.93265 20.6738 8.93265C16.9262 -5.67304 -5.05936 6.40766 4.68352 17.4183"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.3792 15.6341L15.1549 11.4098L10.9307 15.6341"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="29"
      height="35"
      viewBox="0 0 29 35"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M24.9 12.4L23.444 26.9565C23.2239 29.1631 23.1147 30.2655 22.612 31.0992C22.1711 31.8331 21.5227 32.42 20.7487 32.7857C19.8699 33.2 18.764 33.2 16.5453 33.2H12.4547C10.2377 33.2 9.13013 33.2 8.25133 32.784C7.47662 32.4185 6.8276 31.8316 6.38627 31.0975C5.88707 30.2655 5.77613 29.1631 5.55427 26.9565L4.1 12.4M17.1 23.6667V15M11.9 23.6667V15M1.5 8.06667H9.49933M9.49933 8.06667L10.1684 3.4352C10.3625 2.5928 11.0628 2 11.8671 2H17.1329C17.9372 2 18.6357 2.5928 18.8316 3.4352L19.5007 8.06667M9.49933 8.06667H19.5007M19.5007 8.06667H27.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ErrorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 8.68344V16.6279M15 21.3166V20.5943M28 15C28 16.7072 27.6637 18.3977 27.0104 19.9749C26.3571 21.5521 25.3995 22.9852 24.1924 24.1924C22.9852 25.3995 21.5521 26.3571 19.9749 27.0104C18.3977 27.6637 16.7072 28 15 28C13.2928 28 11.6023 27.6637 10.0251 27.0104C8.44788 26.3571 7.01477 25.3995 5.80761 24.1924C4.60045 22.9852 3.64288 21.5521 2.98957 19.9749C2.33625 18.3977 2 16.7072 2 15C2 11.5522 3.36964 8.24558 5.80761 5.80761C8.24558 3.36964 11.5522 2 15 2C18.4478 2 21.7544 3.36964 24.1924 5.80761C26.6304 8.24558 28 11.5522 28 15Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Google Chrome - Official Simple Icons Logo

export function CancelIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M28 15C28 16.7072 27.6637 18.3977 27.0104 19.9749C26.3571 21.5521 25.3995 22.9852 24.1924 24.1924C22.9852 25.3995 21.5521 26.3571 19.9749 27.0104C18.3977 27.6637 16.7072 28 15 28C13.2928 28 11.6023 27.6637 10.0251 27.0104C8.44788 26.3571 7.01477 25.3995 5.80761 24.1924C4.60045 22.9852 3.64288 21.5521 2.98957 19.9749C2.33625 18.3977 2 16.7072 2 15C2 11.5522 3.36964 8.24558 5.80761 5.80761C8.24558 3.36964 11.5522 2 15 2C18.4478 2 21.7544 3.36964 24.1924 5.80761C26.6304 8.24558 28 11.5522 28 15Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M23.6667 6.33333L6.33333 23.6667"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2 15H6.33333M4.88889 4.88889L7.95256 7.95256M25.1111 4.88889L22.0474 7.95256M4.88889 25.1111L7.95256 22.0474M25.1111 25.1111L22.0474 22.0474M15 2V6.33333M15 28V23.6667M23.6667 15H28M19.3333 15C19.3333 16.1493 18.8768 17.2515 18.0641 18.0641C17.2515 18.8768 16.1493 19.3333 15 19.3333C13.8507 19.3333 12.7485 18.8768 11.9359 18.0641C11.1232 17.2515 10.6667 16.1493 10.6667 15C10.6667 13.8507 11.1232 12.7485 11.9359 11.9359C12.7485 11.1232 13.8507 10.6667 15 10.6667C16.1493 10.6667 17.2515 11.1232 18.0641 11.9359C18.8768 12.7485 19.3333 13.8507 19.3333 15Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="currentColor"
      width="24"
      height="24"
      viewBox="0 0 28 23"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.9999 6.51172C12.7047 6.51172 11.4625 7.02625 10.5466 7.94213C9.63074 8.858 9.11621 10.1002 9.11621 11.3954C9.11621 12.6907 9.63074 13.9329 10.5466 14.8488C11.4625 15.7646 12.7047 16.2792 13.9999 16.2792C15.2952 16.2792 16.5374 15.7646 17.4532 14.8488C18.3691 13.9329 18.8837 12.6907 18.8837 11.3954C18.8837 10.1002 18.3691 8.858 17.4532 7.94213C16.5374 7.02625 15.2952 6.51172 13.9999 6.51172ZM11.0697 11.3954C11.0697 10.6183 11.3784 9.87298 11.9279 9.32345C12.4775 8.77393 13.2228 8.46521 13.9999 8.46521C14.7771 8.46521 15.5224 8.77393 16.0719 9.32345C16.6214 9.87298 16.9302 10.6183 16.9302 11.3954C16.9302 12.1726 16.6214 12.9179 16.0719 13.4674C15.5224 14.017 14.7771 14.3257 13.9999 14.3257C13.2228 14.3257 12.4775 14.017 11.9279 13.4674C11.3784 12.9179 11.0697 12.1726 11.0697 11.3954Z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14 0C8.1213 0 4.16093 3.52149 1.86233 6.50772L1.82195 6.56112C1.30102 7.23702 0.82307 7.85823 0.498791 8.59274C0.15107 9.38065 0 10.2389 0 11.3953C0 12.5518 0.15107 13.41 0.498791 14.198C0.824372 14.9325 1.30233 15.555 1.82195 16.2296L1.86363 16.283C4.16093 19.2692 8.1213 22.7907 14 22.7907C19.8787 22.7907 23.8391 19.2692 26.1377 16.283L26.178 16.2296C26.699 15.555 27.1769 14.9325 27.5012 14.198C27.8489 13.41 28 12.5518 28 11.3953C28 10.2389 27.8489 9.38065 27.5012 8.59274C27.1756 7.85823 26.6977 7.23702 26.178 6.56112L26.1364 6.50772C23.8391 3.52149 19.8787 0 14 0ZM3.41209 7.69935C5.53228 4.94233 8.98605 1.95349 14 1.95349C19.014 1.95349 22.4664 4.94233 24.5879 7.69935C25.1609 8.44167 25.4943 8.88447 25.7144 9.38195C25.9202 9.84819 26.0465 10.4173 26.0465 11.3953C26.0465 12.3734 25.9202 12.9425 25.7144 13.4087C25.4943 13.9062 25.1596 14.349 24.5892 15.0913C22.4651 17.8484 19.014 20.8372 14 20.8372C8.98605 20.8372 5.53358 17.8484 3.41209 15.0913C2.83907 14.349 2.50567 13.9062 2.28558 13.4087C2.07981 12.9425 1.95349 12.3734 1.95349 11.3953C1.95349 10.4173 2.07981 9.84819 2.28558 9.38195C2.50567 8.88447 2.84167 8.44167 3.41209 7.69935Z"
      />
    </svg>
  )
}

// Confluence - Official Blue Gradient Logo (worldvectorlogo)

export function DocumentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="23"
      height="28"
      viewBox="0 0 23 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 15.2H15.2M8 20H11.6M2 4.4V23.6C2 24.2365 2.25286 24.847 2.70294 25.2971C3.15303 25.7471 3.76348 26 4.4 26H18.8C19.4365 26 20.047 25.7471 20.4971 25.2971C20.9471 24.847 21.2 24.2365 21.2 23.6V9.6104C21.2 9.29067 21.136 8.97417 21.012 8.67949C20.8879 8.38481 20.7062 8.11789 20.4776 7.8944L15.1496 2.684C14.7012 2.24559 14.0991 2.00008 13.472 2H4.4C3.76348 2 3.15303 2.25286 2.70294 2.70294C2.25286 3.15303 2 3.76348 2 4.4Z"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2V6.8C14 7.43652 14.2529 8.04697 14.7029 8.49706C15.153 8.94714 15.7635 9.2 16.4 9.2H21.2"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function FileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

export function FileTextIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  )
}

export function CodeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      width="30"
      height="27"
      viewBox="0 0 30 27"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M23.2639 6.83064L23.6375 7.20422C26.5433 10.1117 27.9971 11.5638 27.9971 13.37C27.9971 15.1762 26.5433 16.63 23.6375 19.5358L23.2639 19.9094M18.0434 2L11.9507 24.7401M6.72863 6.83064L6.35504 7.20422C3.45081 10.1117 1.99707 11.5638 1.99707 13.37C1.99707 15.1762 3.45081 16.63 6.35829 19.5358L6.73187 19.9094"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TranslateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  )
}

// Slack - Official Simple Icons Logo

export function CheckCircleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function UserCheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </svg>
  )
}
