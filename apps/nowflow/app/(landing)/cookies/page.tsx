import type { Metadata } from 'next'
import {
  LegalBulletItem,
  LegalBulletList,
  LegalDivider,
  LegalInfoBox,
  LegalLink,
  LegalParagraph,
  LegalSectionHeading,
  LegalStrong,
  LegalSubheading,
} from '../components/legal-primitives'
import { PublicInfoPageShell } from '../components/public-info-page-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Cookie Policy | NowFlow Community',
  description:
    'Cookie Policy for NowFlow Community - Learn how we use cookies and tracking technologies.',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default function CookiePolicy() {
  return (
    <PublicInfoPageShell
      eyebrow="Legal"
      title="Cookie"
      accent="Policy"
      description="A clear view of how cookies, analytics, preferences, and consent settings are used across the NowFlow experience."
      updatedLabel="Jan 1, 2025"
      metrics={[
        { label: 'Preferences', value: 'Configurable' },
        { label: 'Tracking', value: 'Consent based' },
      ]}
      quickLinks={[
        { label: 'Legal hub', href: '/legal' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'DPA', href: '/dpa' },
      ]}
    >
      <div className="odyssey-legal-richtext">
        <LegalParagraph>
          This Cookie Policy explains how NowFlow ("we", "us", or "our") uses cookies and similar
          tracking technologies when you visit our NowFlow platform and related services
          (collectively, the "Service").
        </LegalParagraph>
        <LegalParagraph>
          By using our Service, you consent to the use of cookies as described in this policy. You
          can control and manage cookies through your browser settings.
        </LegalParagraph>

        <LegalDivider />

        <section>
          <LegalSectionHeading>What Are Cookies?</LegalSectionHeading>
          <LegalParagraph>
            Cookies are small text files that are stored on your device when you visit a website.
            They help websites remember information about your visit, such as your preferences and
            login status, which can make your next visit easier and the site more useful to you.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Types of Cookies We Use</LegalSectionHeading>

          <LegalSubheading>Essential Cookies</LegalSubheading>
          <LegalParagraph>
            These cookies are necessary for the Service to function properly. They enable core
            functionality such as security, network management, and accessibility.
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Authentication and session management</LegalBulletItem>
            <LegalBulletItem>Security and fraud prevention</LegalBulletItem>
            <LegalBulletItem>Load balancing and performance optimization</LegalBulletItem>
            <LegalBulletItem>User interface preferences</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Analytics Cookies</LegalSubheading>
          <LegalParagraph>
            These cookies help us understand how visitors interact with our Service by collecting
            and reporting information anonymously.
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Page views and user behavior analysis</LegalBulletItem>
            <LegalBulletItem>Performance monitoring and optimization</LegalBulletItem>
            <LegalBulletItem>Feature usage statistics</LegalBulletItem>
            <LegalBulletItem>Error tracking and debugging</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Functional Cookies</LegalSubheading>
          <LegalParagraph>
            These cookies enable enhanced functionality and personalization, such as remembering
            your preferences and settings.
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Language and region preferences</LegalBulletItem>
            <LegalBulletItem>Theme and display settings</LegalBulletItem>
            <LegalBulletItem>Workflow and dashboard customizations</LegalBulletItem>
            <LegalBulletItem>Recently accessed items</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Marketing Cookies</LegalSubheading>
          <LegalParagraph>
            These cookies are used to track visitors across websites to display relevant
            advertisements and measure campaign effectiveness.
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Targeted advertising and retargeting</LegalBulletItem>
            <LegalBulletItem>Social media integration</LegalBulletItem>
            <LegalBulletItem>Campaign performance measurement</LegalBulletItem>
            <LegalBulletItem>Cross-platform user identification</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Third-Party Cookies</LegalSectionHeading>
          <LegalParagraph>
            We may use third-party services that set their own cookies. These include:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Google Analytics:</LegalStrong> For website analytics and performance
              monitoring
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Stripe:</LegalStrong> For payment processing and fraud prevention
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Intercom:</LegalStrong> For customer support and communication
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Social Media Platforms:</LegalStrong> For social sharing and
              authentication
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Managing Your Cookie Preferences</LegalSectionHeading>

          <LegalSubheading>Browser Settings</LegalSubheading>
          <LegalParagraph>
            You can control cookies through your browser settings. Most browsers allow you to:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>View and delete existing cookies</LegalBulletItem>
            <LegalBulletItem>Block cookies from specific websites</LegalBulletItem>
            <LegalBulletItem>Block third-party cookies</LegalBulletItem>
            <LegalBulletItem>Clear all cookies when you close your browser</LegalBulletItem>
            <LegalBulletItem>Receive notifications when cookies are set</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Cookie Consent</LegalSubheading>
          <LegalParagraph>
            When you first visit our Service, you'll see a cookie consent banner that allows you to
            accept or customize your cookie preferences. You can change these preferences at any
            time through our cookie settings panel.
          </LegalParagraph>

          <LegalSubheading>Opt-Out Options</LegalSubheading>
          <LegalParagraph>
            For specific third-party services, you can opt out directly:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Google Analytics:</LegalStrong>{' '}
              <LegalLink
                href="https://tools.google.com/dlpage/gaoptout"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics Opt-out Browser Add-on
              </LegalLink>
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Advertising:</LegalStrong>{' '}
              <LegalLink
                href="http://www.aboutads.info/choices/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Digital Advertising Alliance Opt-out
              </LegalLink>
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Impact of Disabling Cookies</LegalSectionHeading>
          <LegalParagraph>
            While you can disable cookies, please note that doing so may affect your experience with
            our Service:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>You may need to log in repeatedly</LegalBulletItem>
            <LegalBulletItem>Your preferences and settings may not be saved</LegalBulletItem>
            <LegalBulletItem>Some features may not work properly</LegalBulletItem>
            <LegalBulletItem>The Service may load more slowly</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Updates to This Policy</LegalSectionHeading>
          <LegalParagraph>
            We may update this Cookie Policy from time to time to reflect changes in our practices
            or applicable laws. We will notify you of any material changes by posting the updated
            policy on our website.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Contact Us</LegalSectionHeading>
          <LegalParagraph>
            If you have any questions about this Cookie Policy, please contact us:
          </LegalParagraph>
          <LegalInfoBox>
            <LegalParagraph className="mb-2">
              <LegalStrong>NowFlow</LegalStrong>
            </LegalParagraph>
            <LegalParagraph className="mb-2">
              Email: <LegalLink href="mailto:privacy@nowflow.io">privacy@nowflow.io</LegalLink>
            </LegalParagraph>
            <LegalParagraph className="mb-0">
              Website: <LegalLink href={APP_URL}>{APP_URL}</LegalLink>
            </LegalParagraph>
          </LegalInfoBox>
        </section>
      </div>
    </PublicInfoPageShell>
  )
}
