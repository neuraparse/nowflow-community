// Base styles for all email templates - NowFlow Landing Page Design System
// Font: Plus Jakarta Sans | Colors: Zinc scale | Accent: #4A7A68 NowFlow green

export const baseStyles = {
  fontFamily:
    '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  main: {
    backgroundColor: '#fafafa',
    fontFamily:
      '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 8px 32px rgba(0,0,0,0.05)',
    overflow: 'hidden' as const,
  },
  header: {
    padding: '44px 0 28px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  logoCard: {
    display: 'inline-block',
    padding: '10px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.6)',
    border: '1px solid rgba(0,0,0,0.04)',
  },
  logo: {
    display: 'block',
    margin: '0 auto',
  },
  accentBar: {
    height: '3px',
    background: 'linear-gradient(90deg, #5B7B6F, #4A7A68, #6B8F80)',
    borderRadius: '20px 20px 0 0',
  },
  content: {
    padding: '0 32px 48px 32px',
  },
  paragraph: {
    fontSize: '15px',
    lineHeight: '1.65',
    color: '#71717a',
    margin: '0 0 16px 0',
    fontWeight: '400',
  },
  heading: {
    fontSize: '24px',
    fontWeight: '300',
    color: '#27272a',
    margin: '0 0 24px 0',
    lineHeight: '1.2',
    letterSpacing: '-0.03em',
  },
  subheading: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#3f3f46',
    margin: '0 0 12px 0',
    letterSpacing: '-0.01em',
  },
  button: {
    display: 'inline-block',
    backgroundColor: '#27272a',
    color: '#ffffff',
    fontWeight: '600',
    fontSize: '13px',
    padding: '13px 28px',
    borderRadius: '12px',
    textDecoration: 'none',
    textAlign: 'center' as const,
    margin: '0',
    letterSpacing: '0.02em',
  },
  link: {
    color: '#4A7A68',
    textDecoration: 'underline',
    fontWeight: '500',
  },
  footer: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '28px 32px',
    textAlign: 'center' as const,
    borderTop: '1px solid rgba(0,0,0,0.05)',
  },
  footerText: {
    fontSize: '12px',
    color: '#a1a1aa',
    margin: '0',
    lineHeight: '1.5',
    letterSpacing: '0.02em',
  },
  footerBadge: {
    display: 'inline-block',
    padding: '4px 14px',
    borderRadius: '100px',
    backgroundColor: '#f0faf6',
    color: '#4A7A68',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
  },
  footerLink: {
    color: '#4A7A68',
    textDecoration: 'none',
    fontWeight: '500',
    letterSpacing: '-0.03em',
  },
  codeContainer: {
    margin: '28px 0',
    padding: '28px 24px',
    backgroundColor: '#fafafa',
    border: '1px solid rgba(0,0,0,0.05)',
    borderRadius: '12px',
    textAlign: 'center' as const,
  },
  code: {
    fontSize: '36px',
    fontWeight: '600',
    letterSpacing: '12px',
    color: '#27272a',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
  },
  divider: {
    borderTop: '1px solid rgba(0,0,0,0.05)',
    margin: '28px 0',
  },
  // Info box for credentials, details, etc.
  infoBox: {
    background: '#fafafa',
    borderRadius: '12px',
    border: '1px solid rgba(0,0,0,0.05)',
    padding: '20px',
    marginBottom: '20px',
  },
  // Warning box
  warningBox: {
    background: '#fffbeb',
    borderRadius: '12px',
    border: '1px solid #fde68a',
    padding: '14px 16px',
    marginBottom: '20px',
  },
  // Error/danger box
  dangerBox: {
    background: '#fef2f2',
    borderRadius: '12px',
    border: '1px solid #fecaca',
    padding: '14px 16px',
    marginBottom: '20px',
  },
  // Success box
  successBox: {
    background: '#f0faf6',
    borderRadius: '12px',
    border: '1px solid #d1ebe0',
    padding: '14px 16px',
    marginBottom: '20px',
  },
  // Meta label (small uppercase labels)
  metaLabel: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#a1a1aa',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.12em',
    margin: '0 0 4px 0',
  },
  metaValue: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#3f3f46',
    margin: '0',
  },
  // Used by multiple templates for a simple 3-column divider row
  sectionsBorders: {
    padding: '0 32px',
    margin: '0 0 32px 0',
  },
  sectionBorder: {
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    width: '100%',
  },
  sectionCenter: {
    width: '24px',
  },
}
