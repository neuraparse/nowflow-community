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
  title: 'Terms of Service | NowFlow Community',
  description:
    'Terms of Service for hosted NowFlow services. The open-source repository is licensed separately under Apache-2.0.',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default function TermsOfService() {
  return (
    <PublicInfoPageShell
      eyebrow="Legal"
      title="Terms of"
      accent="Service"
      description="The hosted-service and acceptable-use terms that govern access to NowFlow services. Source code use is governed by the repository license."
      updatedLabel="Jan 1, 2025"
      metrics={[
        { label: 'Scope', value: 'Platform usage' },
        { label: 'Coverage', value: 'Billing / liability' },
      ]}
      quickLinks={[
        { label: 'Legal hub', href: '/legal' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Cookie Policy', href: '/cookies' },
        { label: 'DPA', href: '/dpa' },
      ]}
    >
      <div className="odyssey-legal-richtext">
        <LegalParagraph>
          These Terms of Service ("Terms") govern your use of the NowFlow platform and related
          services (collectively, the "Service") provided by NowFlow ("we", "us", or "our"). By
          accessing or using our Service, you agree to be bound by these Terms.
        </LegalParagraph>
        <LegalParagraph>
          The NowFlow Community Edition source code is licensed separately under the Apache License
          2.0 in the repository LICENSE file. These hosted-service Terms do not reduce the rights
          granted by that open-source license.
        </LegalParagraph>
        <LegalParagraph>
          If you do not agree to these Terms, please do not use our Service. We may update these
          Terms from time to time, and your continued use of the Service constitutes acceptance of
          any changes.
        </LegalParagraph>

        <LegalDivider />

        <section>
          <LegalSectionHeading>1. Acceptance of Terms</LegalSectionHeading>
          <LegalParagraph>
            By creating an account, accessing, or using NowFlow, you acknowledge that you have read,
            understood, and agree to be bound by these Terms and our Privacy Policy. If you are
            using the Service on behalf of an organization, you represent that you have the
            authority to bind that organization to these Terms.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>2. Description of Service</LegalSectionHeading>
          <LegalParagraph>
            NowFlow is an AI-powered workflow automation platform that enables users to:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Create and manage automated workflows using AI agents</LegalBulletItem>
            <LegalBulletItem>Integrate with third-party services and APIs</LegalBulletItem>
            <LegalBulletItem>Process and analyze data through automated pipelines</LegalBulletItem>
            <LegalBulletItem>Collaborate on workflow development and deployment</LegalBulletItem>
            <LegalBulletItem>Monitor and optimize workflow performance</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>3. User Accounts and Registration</LegalSectionHeading>

          <LegalSubheading>Account Creation</LegalSubheading>
          <LegalParagraph>
            To use certain features of our Service, you must create an account. You agree to:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Provide accurate, current, and complete information</LegalBulletItem>
            <LegalBulletItem>Maintain and update your account information</LegalBulletItem>
            <LegalBulletItem>Keep your login credentials secure and confidential</LegalBulletItem>
            <LegalBulletItem>Notify us immediately of any unauthorized access</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Account Responsibility</LegalSubheading>
          <LegalParagraph>
            You are responsible for all activities that occur under your account. We reserve the
            right to suspend or terminate accounts that violate these Terms or engage in prohibited
            activities.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>4. Acceptable Use Policy</LegalSectionHeading>

          <LegalSubheading>Permitted Uses</LegalSubheading>
          <LegalParagraph>
            You may use our Service for legitimate business and personal purposes, including:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Automating business processes and workflows</LegalBulletItem>
            <LegalBulletItem>Data processing and analysis</LegalBulletItem>
            <LegalBulletItem>Integration with approved third-party services</LegalBulletItem>
            <LegalBulletItem>Collaboration with team members</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Prohibited Uses</LegalSubheading>
          <LegalParagraph>You agree not to use our Service to:</LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              Violate any applicable laws, regulations, or third-party rights
            </LegalBulletItem>
            <LegalBulletItem>Transmit harmful, offensive, or illegal content</LegalBulletItem>
            <LegalBulletItem>Attempt to gain unauthorized access to our systems</LegalBulletItem>
            <LegalBulletItem>Interfere with or disrupt the Service or other users</LegalBulletItem>
            <LegalBulletItem>
              Use the Service for competitive intelligence or reverse engineering
            </LegalBulletItem>
            <LegalBulletItem>Create workflows that spam, harass, or harm others</LegalBulletItem>
            <LegalBulletItem>Process personal data without proper authorization</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>5. Intellectual Property Rights</LegalSectionHeading>

          <LegalSubheading>Our Rights</LegalSubheading>
          <LegalParagraph>
            Hosted service content, trademarks, and related intellectual property are owned by
            NowFlow and protected by copyright, trademark, and other laws. Open-source code in this
            repository remains available under the license terms published with that code.
          </LegalParagraph>

          <LegalSubheading>Your Content</LegalSubheading>
          <LegalParagraph>
            You retain ownership of any content, data, or workflows you create using our Service. By
            using the Service, you grant us a limited license to process, store, and transmit your
            content as necessary to provide the Service.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>6. Privacy and Data Protection</LegalSectionHeading>
          <LegalParagraph>
            Your privacy is important to us. Our collection, use, and protection of your personal
            information is governed by our Privacy Policy, which is incorporated into these Terms by
            reference. By using the Service, you consent to our privacy practices as described in
            the Privacy Policy.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>7. Payment Terms</LegalSectionHeading>

          <LegalSubheading>Subscription Plans</LegalSubheading>
          <LegalParagraph>
            We offer various subscription plans with different features and usage limits. Pricing
            and plan details are available on our website and may be updated from time to time.
          </LegalParagraph>

          <LegalSubheading>Billing and Payment</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>
              Subscription fees are billed in advance on a recurring basis
            </LegalBulletItem>
            <LegalBulletItem>All fees are non-refundable except as required by law</LegalBulletItem>
            <LegalBulletItem>
              You are responsible for all taxes associated with your use of the Service
            </LegalBulletItem>
            <LegalBulletItem>
              We may suspend or terminate your account for non-payment
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Free Trial and Cancellation</LegalSubheading>
          <LegalParagraph>
            We may offer free trials for new users. You may cancel your subscription at any time
            through your account settings. Cancellation will take effect at the end of your current
            billing period.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>8. Service Availability and Support</LegalSectionHeading>

          <LegalSubheading>Service Level</LegalSubheading>
          <LegalParagraph>
            We strive to maintain high availability of our Service, but we do not guarantee
            uninterrupted access. We may perform maintenance, updates, or experience outages that
            temporarily affect service availability.
          </LegalParagraph>

          <LegalSubheading>Support</LegalSubheading>
          <LegalParagraph>
            We provide support through various channels as outlined in your subscription plan.
            Support response times may vary based on your plan level and the nature of your inquiry.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>9. Limitation of Liability</LegalSectionHeading>
          <LegalParagraph>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, NOWFLOW SHALL NOT BE LIABLE FOR ANY INDIRECT,
            INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO
            LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE.
          </LegalParagraph>
          <LegalParagraph>
            OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE
            SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING
            THE CLAIM.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>10. Disclaimers</LegalSectionHeading>
          <LegalParagraph>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
            WHETHER EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO
            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </LegalParagraph>
          <LegalParagraph>
            We do not warrant that the Service will be error-free, secure, or available at all
            times. You use the Service at your own risk.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>11. Indemnification</LegalSectionHeading>
          <LegalParagraph>
            You agree to indemnify, defend, and hold harmless NowFlow and its officers, directors,
            employees, and agents from any claims, damages, losses, or expenses arising out of or
            relating to:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Your use of the Service</LegalBulletItem>
            <LegalBulletItem>Your violation of these Terms</LegalBulletItem>
            <LegalBulletItem>Your violation of any third-party rights</LegalBulletItem>
            <LegalBulletItem>Any content or data you submit through the Service</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>12. Termination</LegalSectionHeading>

          <LegalSubheading>Termination by You</LegalSubheading>
          <LegalParagraph>
            You may terminate your account at any time by following the cancellation process in your
            account settings or by contacting our support team.
          </LegalParagraph>

          <LegalSubheading>Termination by Us</LegalSubheading>
          <LegalParagraph>
            We may suspend or terminate your account immediately if you violate these Terms, engage
            in prohibited activities, or for any other reason at our sole discretion.
          </LegalParagraph>

          <LegalSubheading>Effect of Termination</LegalSubheading>
          <LegalParagraph>
            Upon termination, your right to use the Service will cease immediately. We may delete
            your account and data in accordance with our data retention policies.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>13. Governing Law and Disputes</LegalSectionHeading>
          <LegalParagraph>
            These Terms are governed by and construed in accordance with the laws of the
            jurisdiction where NowFlow is incorporated, without regard to conflict of law
            principles.
          </LegalParagraph>
          <LegalParagraph>
            Any disputes arising out of or relating to these Terms or the Service shall be resolved
            through binding arbitration in accordance with the rules of the American Arbitration
            Association.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>14. Changes to Terms</LegalSectionHeading>
          <LegalParagraph>
            We may update these Terms from time to time. We will notify you of material changes by
            posting the updated Terms on our website and updating the "Last Updated" date. Your
            continued use of the Service after such changes constitutes acceptance of the new Terms.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>15. Contact Information</LegalSectionHeading>
          <LegalParagraph>
            If you have any questions about these Terms, please contact us:
          </LegalParagraph>
          <LegalInfoBox>
            <LegalParagraph className="mb-2">
              <LegalStrong>NowFlow</LegalStrong>
            </LegalParagraph>
            <LegalParagraph className="mb-2">
              Email: <LegalLink href="mailto:legal@nowflow.io">legal@nowflow.io</LegalLink>
            </LegalParagraph>
            <LegalParagraph className="mb-2">
              Support: <LegalLink href="mailto:support@nowflow.io">support@nowflow.io</LegalLink>
            </LegalParagraph>
            <LegalParagraph className="mb-0">
              Website: <LegalLink href={APP_URL}>{APP_URL}</LegalLink>
            </LegalParagraph>
          </LegalInfoBox>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>16. Miscellaneous</LegalSectionHeading>
          <LegalParagraph>
            These Terms constitute the entire agreement between you and NowFlow regarding the
            Service. If any provision of these Terms is found to be unenforceable, the remaining
            provisions will remain in full force and effect.
          </LegalParagraph>
          <LegalParagraph>
            Our failure to enforce any provision of these Terms does not constitute a waiver of that
            provision. These Terms are binding upon your heirs, successors, and assigns.
          </LegalParagraph>
        </section>
      </div>
    </PublicInfoPageShell>
  )
}
