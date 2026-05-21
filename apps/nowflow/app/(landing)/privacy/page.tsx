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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  title: 'Privacy Policy | NowFlow Community',
  description:
    'Privacy Policy for NowFlow Community - Learn how we collect, use, and protect your personal information. Compliant with GDPR, CCPA, and Google API Services User Data Policy.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Privacy Policy | NowFlow Community',
    description: 'Privacy Policy for NowFlow - Data protection and privacy practices',
    url: `${APP_URL}/privacy`,
    siteName: 'NowFlow Community',
    type: 'website',
  },
}

export default function PrivacyPolicy() {
  return (
    <PublicInfoPageShell
      eyebrow="Legal"
      title="Privacy"
      accent="Policy"
      description="How we collect, use, protect, and govern personal data across the NowFlow platform and related services."
      updatedLabel="Nov 2, 2025"
      metrics={[
        { label: 'Coverage', value: 'GDPR / CCPA' },
        { label: 'Google APIs', value: 'Restricted use' },
      ]}
      quickLinks={[
        { label: 'Legal hub', href: '/legal' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Cookie Policy', href: '/cookies' },
        { label: 'DPA', href: '/dpa' },
      ]}
    >
      <div className="odyssey-legal-richtext">
        <LegalParagraph>
          This Privacy Policy describes how NowFlow Community, the company behind NowFlow ("we",
          "us", or "our"), collects, uses, and protects your personal information when you use our
          NowFlow platform and related services (collectively, the "Service"). We are committed to
          protecting your privacy and ensuring transparency about our data practices.
        </LegalParagraph>
        <LegalParagraph>
          By using our Service, you agree to the collection and use of information in accordance
          with this Privacy Policy. If you do not agree with our policies and practices, please do
          not use our Service.
        </LegalParagraph>
        <LegalParagraph>
          This Privacy Policy complies with the General Data Protection Regulation (GDPR),
          California Consumer Privacy Act (CCPA), and other applicable privacy laws.
        </LegalParagraph>

        <LegalDivider />

        <section>
          <LegalSectionHeading>1. Information We Collect</LegalSectionHeading>

          <LegalSubheading>Personal Information You Provide</LegalSubheading>
          <LegalParagraph>
            We collect information you provide directly to us, including:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Account Information:</LegalStrong> Name, email address, username, and
              password
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Profile Information:</LegalStrong> Optional profile details, preferences,
              and settings
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Workflow Data:</LegalStrong> AI workflows, automation configurations, and
              related content you create
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Communication Data:</LegalStrong> Messages, support requests, and
              feedback you send to us
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Payment Information:</LegalStrong> Billing details processed by our
              payment processors (we do not store full payment card details)
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Automatically Collected Information</LegalSubheading>
          <LegalParagraph>When you use our Service, we automatically collect:</LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Usage Data:</LegalStrong> Features used, time spent, workflow executions,
              and performance metrics
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Device Information:</LegalStrong> IP address, browser type, operating
              system, and device identifiers
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Log Data:</LegalStrong> Server logs, error reports, and security events
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Cookies and Tracking:</LegalStrong> Session data, preferences, and
              analytics information
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Third-Party Integrations</LegalSubheading>
          <LegalParagraph>
            When you connect third-party services to NowFlow, we may collect data from those
            services as necessary to provide our automation features. This includes API credentials,
            workflow triggers, and data processed through your workflows.
          </LegalParagraph>

          <LegalSubheading>Google API Services User Data Policy</LegalSubheading>
          <LegalParagraph>
            Nowflow's use and transfer to any other app of information received from Google APIs
            will adhere to{' '}
            <LegalLink
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </LegalLink>
            , including the Limited Use requirements.
          </LegalParagraph>
          <LegalParagraph>
            When you connect your Google account to Nowflow, we only request the minimum necessary
            OAuth scopes required for user-authorized actions:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Gmail:</LegalStrong> Send emails on your behalf (gmail.send), manage
              labels (gmail.labels)
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Google Calendar:</LegalStrong> Create and manage calendar events
              (calendar.events)
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Google Drive:</LegalStrong> Access user-selected files only (drive.file)
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Google Sheets:</LegalStrong> Create or update spreadsheets (spreadsheets)
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Google Docs:</LegalStrong> Access user-selected documents (drive.file)
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Profile Information:</LegalStrong> Basic profile info (openid, email,
              profile)
            </LegalBulletItem>
          </LegalBulletList>
          <LegalParagraph>
            <LegalStrong>Important:</LegalStrong> We do not store, share, or use any Google user
            data beyond what is strictly required for executing your user-requested workflow
            automations. All data access is limited to the specific actions you configure and
            authorize.
          </LegalParagraph>
          <LegalParagraph>
            <LegalStrong>No Sale or Unauthorized Transfer:</LegalStrong> Nowflow does not sell,
            rent, or transfer Google user data to third parties. Google user data is only used to
            provide the functionality you have explicitly requested through our Service and is never
            used for advertising, marketing to third parties, or any purpose other than providing or
            improving user-facing features of our Service.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>2. How We Use Your Information</LegalSectionHeading>
          <LegalParagraph>
            We use the information we collect for the following purposes:
          </LegalParagraph>

          <LegalSubheading>Service Provision</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>
              Provide, maintain, and improve our AI workflow automation platform
            </LegalBulletItem>
            <LegalBulletItem>Process and execute your automated workflows</LegalBulletItem>
            <LegalBulletItem>Enable integrations with third-party services</LegalBulletItem>
            <LegalBulletItem>
              Provide customer support and respond to your inquiries
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Account Management</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>Create and manage your account</LegalBulletItem>
            <LegalBulletItem>
              Authenticate your identity and prevent unauthorized access
            </LegalBulletItem>
            <LegalBulletItem>Process payments and manage subscriptions</LegalBulletItem>
            <LegalBulletItem>Send important service notifications and updates</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Analytics and Improvement</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>Analyze usage patterns to improve our Service</LegalBulletItem>
            <LegalBulletItem>Monitor performance and troubleshoot issues</LegalBulletItem>
            <LegalBulletItem>Develop new features and functionality</LegalBulletItem>
            <LegalBulletItem>
              Conduct research and analytics (in aggregated, anonymized form)
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Legal and Security</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>
              Comply with legal obligations and regulatory requirements
            </LegalBulletItem>
            <LegalBulletItem>Protect against fraud, abuse, and security threats</LegalBulletItem>
            <LegalBulletItem>Enforce our Terms of Service and other policies</LegalBulletItem>
            <LegalBulletItem>Respond to legal requests and prevent harm</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>3. Information Sharing and Disclosure</LegalSectionHeading>
          <LegalParagraph>
            We do not sell your personal information. We may share your information in the following
            circumstances:
          </LegalParagraph>

          <LegalSubheading>Service Providers</LegalSubheading>
          <LegalParagraph>
            We work with trusted third-party service providers who help us operate our Service,
            including:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Cloud hosting and infrastructure providers</LegalBulletItem>
            <LegalBulletItem>Payment processing services</LegalBulletItem>
            <LegalBulletItem>Analytics and monitoring tools</LegalBulletItem>
            <LegalBulletItem>Customer support platforms</LegalBulletItem>
            <LegalBulletItem>Email and communication services</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Business Transfers</LegalSubheading>
          <LegalParagraph>
            In the event of a merger, acquisition, or sale of assets, your information may be
            transferred as part of that transaction. We will notify you of any such change.
          </LegalParagraph>

          <LegalSubheading>Legal Requirements</LegalSubheading>
          <LegalParagraph>
            We may disclose your information when required by law or to:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Comply with legal obligations or court orders</LegalBulletItem>
            <LegalBulletItem>Protect our rights, property, or safety</LegalBulletItem>
            <LegalBulletItem>
              Investigate potential violations of our Terms of Service
            </LegalBulletItem>
            <LegalBulletItem>Protect against fraud or security threats</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>With Your Consent</LegalSubheading>
          <LegalParagraph>
            We may share your information for other purposes with your explicit consent.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>4. Data Security</LegalSectionHeading>
          <LegalParagraph>
            We implement appropriate technical and organizational measures to protect your personal
            information against unauthorized access, alteration, disclosure, or destruction:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Encryption:</LegalStrong> Data in transit and at rest is encrypted using
              industry-standard protocols
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Access Controls:</LegalStrong> Strict access controls and authentication
              mechanisms
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Regular Audits:</LegalStrong> Security assessments and vulnerability
              testing
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Employee Training:</LegalStrong> Regular security training for all team
              members
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Incident Response:</LegalStrong> Procedures for detecting and responding
              to security incidents
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>5. Your Rights and Choices</LegalSectionHeading>

          <LegalSubheading>GDPR Rights (EU Users)</LegalSubheading>
          <LegalParagraph>
            If you are located in the European Union, you have the following rights:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Access:</LegalStrong> Request access to your personal data
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Rectification:</LegalStrong> Request correction of inaccurate data
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Erasure:</LegalStrong> Request deletion of your personal data
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Portability:</LegalStrong> Request transfer of your data to another
              service
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Restriction:</LegalStrong> Request limitation of processing
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Objection:</LegalStrong> Object to processing based on legitimate
              interests
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Withdraw Consent:</LegalStrong> Withdraw consent for data processing
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>CCPA Rights (California Users)</LegalSubheading>
          <LegalParagraph>
            If you are a California resident, you have the following rights:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Know:</LegalStrong> Request information about data collection and use
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Delete:</LegalStrong> Request deletion of personal information
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Opt-Out:</LegalStrong> Opt-out of the sale of personal information (we do
              not sell data)
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Non-Discrimination:</LegalStrong> Equal service regardless of privacy
              choices
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>How to Exercise Your Rights</LegalSubheading>
          <LegalParagraph>
            To exercise any of these rights, please contact us at{' '}
            <LegalLink href="mailto:privacy@nowflow.io">privacy@nowflow.io</LegalLink>. We will
            respond to your request within 30 days.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>6. Data Retention</LegalSectionHeading>
          <LegalParagraph>
            We retain your personal information only as long as necessary to provide our Service and
            fulfill the purposes outlined in this Privacy Policy:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Account Data:</LegalStrong> Retained while your account is active and for
              90 days after deletion
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Workflow Data:</LegalStrong> Retained according to your subscription plan
              and backup policies
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Usage Analytics:</LegalStrong> Aggregated data may be retained
              indefinitely for service improvement
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Legal Requirements:</LegalStrong> Some data may be retained longer to
              comply with legal obligations
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>7. International Data Transfers</LegalSectionHeading>
          <LegalParagraph>
            Your information may be transferred to and processed in countries other than your own.
            We ensure appropriate safeguards are in place for international transfers, including:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              Standard Contractual Clauses approved by the European Commission
            </LegalBulletItem>
            <LegalBulletItem>
              Adequacy decisions for countries with equivalent privacy protections
            </LegalBulletItem>
            <LegalBulletItem>Certification schemes and codes of conduct</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>8. Cookies and Tracking Technologies</LegalSectionHeading>
          <LegalParagraph>
            We use cookies and similar tracking technologies to enhance your experience:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Essential Cookies:</LegalStrong> Required for basic functionality and
              security
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Analytics Cookies:</LegalStrong> Help us understand how you use our
              Service
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Preference Cookies:</LegalStrong> Remember your settings and preferences
            </LegalBulletItem>
          </LegalBulletList>
          <LegalParagraph>
            You can control cookies through your browser settings. Note that disabling certain
            cookies may affect Service functionality.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>9. Third-Party Services</LegalSectionHeading>
          <LegalParagraph>
            Our Service may integrate with third-party services. This Privacy Policy does not cover
            the privacy practices of these third parties. We encourage you to review their privacy
            policies.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>10. Children's Privacy</LegalSectionHeading>
          <LegalParagraph>
            Our Service is not intended for children under 13 years of age. We do not knowingly
            collect personal information from children under 13. If you become aware that a child
            has provided us with personal information, please contact us immediately.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>11. Changes to This Privacy Policy</LegalSectionHeading>
          <LegalParagraph>
            We may update this Privacy Policy from time to time. We will notify you of any material
            changes by posting the new Privacy Policy on this page and updating the "Last Updated"
            date. For significant changes, we may also send you an email notification.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>12. Contact Information</LegalSectionHeading>
          <LegalParagraph>
            If you have any questions about this Privacy Policy or our privacy practices, please
            contact us:
          </LegalParagraph>
          <LegalInfoBox>
            <LegalParagraph className="mb-2">
              <LegalStrong>NowFlow</LegalStrong>
            </LegalParagraph>
            <LegalParagraph className="mb-2">
              Email: <LegalLink href="mailto:privacy@nowflow.io">privacy@nowflow.io</LegalLink>
            </LegalParagraph>
            <LegalParagraph className="mb-2">
              Legal: <LegalLink href="mailto:legal@nowflow.io">legal@nowflow.io</LegalLink>
            </LegalParagraph>
            <LegalParagraph className="mb-0">
              Website: <LegalLink href={APP_URL}>{APP_URL}</LegalLink>
            </LegalParagraph>
          </LegalInfoBox>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>13. Data Protection Officer</LegalSectionHeading>
          <LegalParagraph>
            For GDPR-related inquiries, you may contact our Data Protection Officer at{' '}
            <LegalLink href="mailto:dpo@nowflow.io">dpo@nowflow.io</LegalLink>
          </LegalParagraph>
        </section>
      </div>
    </PublicInfoPageShell>
  )
}
