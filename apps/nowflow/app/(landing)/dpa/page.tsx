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
  title: 'Data Processing Agreement | NowFlow Community',
  description:
    'Data Processing Agreement (DPA) for hosted NowFlow services - Learn how personal data is processed on your behalf.',
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export default function DataProcessingAgreement() {
  return (
    <PublicInfoPageShell
      eyebrow="Legal"
      title="Data Processing"
      accent="Agreement"
      description="The agreement that defines how NowFlow processes personal data on behalf of customers and aligns with regulatory obligations."
      updatedLabel="Jan 1, 2025"
      metrics={[
        { label: 'Role', value: 'Controller / Processor' },
        { label: 'Transfers', value: 'Safeguarded' },
      ]}
      quickLinks={[
        { label: 'Legal hub', href: '/legal' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Security', href: '/security' },
      ]}
    >
      <div className="odyssey-legal-richtext">
        <LegalParagraph className="mb-0">
          This Data Processing Agreement (&quot;DPA&quot;) forms part of the Terms of Service
          between NowFlow (&quot;Processor&quot;) and you (&quot;Controller&quot;) regarding the
          processing of personal data in connection with the NowFlow platform.
        </LegalParagraph>
        <LegalParagraph className="mb-0">
          This DPA applies where and only to the extent that NowFlow processes personal data on
          behalf of the Controller in the course of providing the Service, and such personal data is
          subject to data protection laws.
        </LegalParagraph>

        <LegalDivider />

        {/* 1. Definitions */}
        <section>
          <LegalSectionHeading>1. Definitions</LegalSectionHeading>
          <LegalParagraph>
            In this DPA, the following terms have the meanings set out below:
          </LegalParagraph>
          <LegalBulletList className="space-y-2.5 pl-0">
            <LegalBulletItem>
              <LegalStrong>&quot;Controller&quot;:</LegalStrong> The entity that determines the
              purposes and means of processing personal data
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>&quot;Processor&quot;:</LegalStrong> NowFlow, which processes personal
              data on behalf of the Controller
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>&quot;Personal Data&quot;:</LegalStrong> Any information relating to an
              identified or identifiable natural person
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>&quot;Processing&quot;:</LegalStrong> Any operation performed on personal
              data
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>&quot;Data Subject&quot;:</LegalStrong> An identified or identifiable
              natural person
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>&quot;GDPR&quot;:</LegalStrong> General Data Protection Regulation (EU)
              2016/679
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        {/* 2. Scope and Nature of Processing */}
        <section>
          <LegalSectionHeading>2. Scope and Nature of Processing</LegalSectionHeading>

          <LegalSubheading>Subject Matter</LegalSubheading>
          <LegalParagraph className="mb-6">
            The subject matter of processing is the provision of the NowFlow AI workflow automation
            platform and related services as described in the Terms of Service.
          </LegalParagraph>

          <LegalSubheading>Duration</LegalSubheading>
          <LegalParagraph className="mb-6">
            Processing will continue for the duration of the Service agreement and as necessary to
            fulfill legal obligations thereafter.
          </LegalParagraph>

          <LegalSubheading>Purpose of Processing</LegalSubheading>
          <LegalBulletList className="space-y-2.5 pl-0">
            <LegalBulletItem>Provision of the NowFlow platform services</LegalBulletItem>
            <LegalBulletItem>Customer support and technical assistance</LegalBulletItem>
            <LegalBulletItem>Service improvement and optimization</LegalBulletItem>
            <LegalBulletItem>Compliance with legal obligations</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Categories of Data Subjects</LegalSubheading>
          <LegalBulletList className="space-y-2.5 pl-0">
            <LegalBulletItem>Controller&apos;s employees and authorized users</LegalBulletItem>
            <LegalBulletItem>Controller&apos;s customers and end users</LegalBulletItem>
            <LegalBulletItem>
              Other individuals whose data is processed through workflows
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Types of Personal Data</LegalSubheading>
          <LegalBulletList className="space-y-2.5 mb-0 pl-0">
            <LegalBulletItem>
              Contact information (names, email addresses, phone numbers)
            </LegalBulletItem>
            <LegalBulletItem>Account and authentication data</LegalBulletItem>
            <LegalBulletItem>Workflow and automation data</LegalBulletItem>
            <LegalBulletItem>Usage and analytics data</LegalBulletItem>
            <LegalBulletItem>
              Any other personal data uploaded or processed through the Service
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        {/* 3. Processor Obligations */}
        <section>
          <LegalSectionHeading>3. Processor Obligations</LegalSectionHeading>

          <LegalSubheading>Processing Instructions</LegalSubheading>
          <LegalParagraph className="mb-6">
            NowFlow will process personal data only on documented instructions from the Controller,
            including with regard to transfers of personal data to third countries or international
            organizations.
          </LegalParagraph>

          <LegalSubheading>Confidentiality</LegalSubheading>
          <LegalParagraph className="mb-6">
            NowFlow ensures that persons authorized to process personal data have committed
            themselves to confidentiality or are under an appropriate statutory obligation of
            confidentiality.
          </LegalParagraph>

          <LegalSubheading>Security Measures</LegalSubheading>
          <LegalParagraph>
            NowFlow implements appropriate technical and organizational measures to ensure a level
            of security appropriate to the risk, including:
          </LegalParagraph>
          <LegalBulletList className="space-y-2.5 pl-0">
            <LegalBulletItem>Encryption of personal data in transit and at rest</LegalBulletItem>
            <LegalBulletItem>
              Ability to ensure ongoing confidentiality, integrity, and availability
            </LegalBulletItem>
            <LegalBulletItem>
              Ability to restore availability and access to data in a timely manner
            </LegalBulletItem>
            <LegalBulletItem>Regular testing and evaluation of security measures</LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Sub-processors</LegalSubheading>
          <LegalParagraph className="mb-0">
            NowFlow may engage sub-processors with the Controller&apos;s general written
            authorization. Current sub-processors are listed in our{' '}
            <LegalLink href="/privacy">Privacy Policy</LegalLink>. We will notify Controllers of any
            changes to sub-processors.
          </LegalParagraph>
        </section>

        <LegalDivider />

        {/* 4. Data Subject Rights */}
        <section>
          <LegalSectionHeading>4. Data Subject Rights</LegalSectionHeading>
          <LegalParagraph>
            NowFlow will assist the Controller in fulfilling data subject rights requests,
            including:
          </LegalParagraph>
          <LegalBulletList className="space-y-2.5 mb-0 pl-0">
            <LegalBulletItem>
              <LegalStrong>Access:</LegalStrong> Providing access to personal data
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Rectification:</LegalStrong> Correcting inaccurate personal data
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Erasure:</LegalStrong> Deleting personal data when required
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Restriction:</LegalStrong> Limiting processing when requested
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Portability:</LegalStrong> Providing data in a structured format
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Objection:</LegalStrong> Stopping processing when objected to
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        {/* 5. Data Breach Notification */}
        <section>
          <LegalSectionHeading>5. Data Breach Notification</LegalSectionHeading>
          <LegalParagraph>In case of a personal data breach, NowFlow will:</LegalParagraph>
          <LegalBulletList className="space-y-2.5 mb-0 pl-0">
            <LegalBulletItem>
              Notify the Controller without undue delay and within 72 hours of becoming aware
            </LegalBulletItem>
            <LegalBulletItem>Provide all relevant information about the breach</LegalBulletItem>
            <LegalBulletItem>
              Assist the Controller in notifying supervisory authorities and data subjects
            </LegalBulletItem>
            <LegalBulletItem>
              Implement measures to address the breach and prevent future occurrences
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        {/* 6. International Transfers */}
        <section>
          <LegalSectionHeading>6. International Transfers</LegalSectionHeading>
          <LegalParagraph>
            Personal data may be transferred to and processed in countries outside the EEA. Such
            transfers are protected by:
          </LegalParagraph>
          <LegalBulletList className="space-y-2.5 mb-0 pl-0">
            <LegalBulletItem>
              Standard Contractual Clauses approved by the European Commission
            </LegalBulletItem>
            <LegalBulletItem>
              Adequacy decisions for countries with equivalent protection
            </LegalBulletItem>
            <LegalBulletItem>
              Other appropriate safeguards as required by applicable law
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        {/* 7. Data Retention and Deletion */}
        <section>
          <LegalSectionHeading>7. Data Retention and Deletion</LegalSectionHeading>
          <LegalParagraph>Upon termination of the Service agreement, NowFlow will:</LegalParagraph>
          <LegalBulletList className="space-y-2.5 mb-0 pl-0">
            <LegalBulletItem>
              Return or delete all personal data as instructed by the Controller
            </LegalBulletItem>
            <LegalBulletItem>
              Delete existing copies unless retention is required by law
            </LegalBulletItem>
            <LegalBulletItem>Provide certification of deletion upon request</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        {/* 8. Audits and Compliance */}
        <section>
          <LegalSectionHeading>8. Audits and Compliance</LegalSectionHeading>
          <LegalParagraph>NowFlow will:</LegalParagraph>
          <LegalBulletList className="space-y-2.5 mb-0 pl-0">
            <LegalBulletItem>
              Make available information necessary to demonstrate compliance
            </LegalBulletItem>
            <LegalBulletItem>
              Allow for and contribute to audits conducted by the Controller
            </LegalBulletItem>
            <LegalBulletItem>Provide regular compliance reports and certifications</LegalBulletItem>
            <LegalBulletItem>Maintain records of processing activities</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        {/* 9. Liability and Indemnification */}
        <section>
          <LegalSectionHeading>9. Liability and Indemnification</LegalSectionHeading>
          <LegalParagraph className="mb-0">
            Each party&apos;s liability under this DPA is subject to the limitation of liability
            provisions in the <LegalLink href="/terms">Terms of Service</LegalLink>. Each party will
            indemnify the other for claims arising from its breach of this DPA.
          </LegalParagraph>
        </section>

        <LegalDivider />

        {/* 10. Contact Information */}
        <section>
          <LegalSectionHeading>10. Contact Information</LegalSectionHeading>
          <LegalParagraph className="mb-6">
            For questions about this DPA or to exercise data subject rights, please contact:
          </LegalParagraph>
          <LegalInfoBox>
            <p className="text-[14px] font-semibold text-zinc-800 dark:text-white font-sans mb-3">
              NowFlow Data Protection Officer
            </p>
            <div className="space-y-1.5 text-[14px] text-zinc-400 dark:text-white/40 font-sans">
              <p>
                Email: <LegalLink href="mailto:dpo@nowflow.io">dpo@nowflow.io</LegalLink>
              </p>
              <p>
                Privacy: <LegalLink href="mailto:privacy@nowflow.io">privacy@nowflow.io</LegalLink>
              </p>
              <p>
                Website: <LegalLink href={APP_URL}>{APP_URL}</LegalLink>
              </p>
            </div>
          </LegalInfoBox>
        </section>
      </div>
    </PublicInfoPageShell>
  )
}
