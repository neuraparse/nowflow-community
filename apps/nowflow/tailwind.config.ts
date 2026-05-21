import type { Config } from 'tailwindcss'

const config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '!./app/node_modules/**',
    '!**/node_modules/**',
  ],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: [
          'var(--font-geist-sans)',
          'var(--font-inter)',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        display: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
        ibm: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        logo: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
        // 2026 landing shortlist — Inter-led heading/body stack
        heading: [
          'var(--font-inter)',
          'var(--font-geist-sans)',
          'var(--font-geist-sans)',
          'system-ui',
          'sans-serif',
        ],
        body: ['var(--font-inter)', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        tech: ['var(--font-geist-sans)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        structure: [
          'var(--font-geist-sans)',
          'var(--font-geist-sans)',
          'var(--font-inter)',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        'display-2xl': [
          '6rem',
          { lineHeight: '1.02', letterSpacing: '-0.04em', fontWeight: '800' },
        ],
        'display-xl': [
          '4.5rem',
          { lineHeight: '1.05', letterSpacing: '-0.04em', fontWeight: '800' },
        ],
        'display-lg': [
          '3.25rem',
          { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '700' },
        ],
        'display-md': [
          '2.5rem',
          { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '700' },
        ],
        'body-lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '-0.01em', fontWeight: '400' }],
        body: ['1rem', { lineHeight: '1.65', letterSpacing: '-0.01em', fontWeight: '400' }],
        eyebrow: ['0.6875rem', { lineHeight: '1.25', letterSpacing: '0.1em', fontWeight: '700' }],
      },
      colors: {
        // Override Tailwind's slate with pure neutral gray (NO blue tint!)
        slate: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        odyssey: {
          bg: '#07090B',
          'bg-alt': '#0A0D10',
          elevated: '#0E1318',
          surface: '#10151B',
          'surface-2': '#131A21',
          text: '#F3F5F7',
          'text-muted': '#A7B0BA',
          'text-soft': '#7B8591',
          accent: '#D9E2FF',
          'accent-soft': '#90A8FF',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      transitionProperty: {
        width: 'width',
        left: 'left',
        padding: 'padding',
      },
      keyframes: {
        'slide-down': {
          '0%': {
            transform: 'translate(-50%, -100%)',
            opacity: '0',
          },
          '100%': {
            transform: 'translate(-50%, 0)',
            opacity: '1',
          },
        },
        'notification-slide': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-100%)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'notification-fade-out': {
          '0%': {
            opacity: '1',
          },
          '100%': {
            opacity: '0',
          },
        },
        'fade-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'rocket-pulse': {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '0.7',
          },
        },
        'run-glow': {
          '0%, 100%': {
            filter: 'opacity(1)',
          },
          '50%': {
            filter: 'opacity(0.7)',
          },
        },
        'caret-blink': {
          '0%,70%,100%': {
            opacity: '1',
          },
          '20%,50%': {
            opacity: '0',
          },
        },
        'pulse-slow': {
          '0%, 100%': {
            opacity: '1',
          },
          '50%': {
            opacity: '0.7',
          },
        },
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'slide-down': 'slide-down 0.3s ease-out',
        'notification-slide': 'notification-slide 0.3s ease-out forwards',
        'notification-fade-out': 'notification-fade-out 0.2s ease-out forwards',
        'fade-up': 'fade-up 0.5s ease-out forwards',
        'rocket-pulse': 'rocket-pulse 1.5s ease-in-out infinite',
        'run-glow': 'run-glow 2s ease-in-out infinite',
        'caret-blink': 'caret-blink 1.25s ease-out infinite',
        'pulse-slow': 'pulse-slow 3s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
  // Safari compatibility
  future: {
    hoverOnlyWhenSupported: true, // Prevent hover issues on touch devices
  },
} satisfies Config

export default config
