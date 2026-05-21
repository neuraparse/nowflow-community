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

export default function SecurityPolicy() {
  return (
    <PublicInfoPageShell
      eyebrow="Security"
      title="Security"
      accent="Policy"
      description="A detailed view of the controls, operational practices, and response procedures used to protect data and workflows in NowFlow."
      updatedLabel="Jan 1, 2025"
      metrics={[
        { label: 'Encryption', value: 'TLS 1.3 / AES-256' },
        { label: 'Response', value: '24/7 monitoring' },
      ]}
      quickLinks={[
        { label: 'Security contact', href: '/contact' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'DPA', href: '/dpa' },
        { label: 'Legal hub', href: '/legal' },
      ]}
    >
      <div className="odyssey-legal-richtext">
        <LegalParagraph>
          At NowFlow, we take the security of our NowFlow platform and your data seriously. This
          Security Policy outlines the measures we implement to protect your information and
          maintain the integrity of our Service.
        </LegalParagraph>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Our Security Commitment</LegalSectionHeading>
          <LegalParagraph>
            We are committed to maintaining the highest standards of security to protect your data
            and ensure the reliable operation of our AI workflow automation platform. Our security
            program is built on industry best practices and continuously evolves to address emerging
            threats.
          </LegalParagraph>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Data Protection Measures</LegalSectionHeading>

          <LegalSubheading>Encryption</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Data in Transit:</LegalStrong> All data transmitted between your device
              and our servers is encrypted using TLS 1.3
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Data at Rest:</LegalStrong> All stored data is encrypted using AES-256
              encryption
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Database Encryption:</LegalStrong> Database files and backups are
              encrypted with industry-standard algorithms
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Key Management:</LegalStrong> Encryption keys are managed using secure
              key management systems
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Access Controls</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Multi-Factor Authentication:</LegalStrong> Required for all
              administrative access
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Role-Based Access:</LegalStrong> Principle of least privilege for all
              system access
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Regular Access Reviews:</LegalStrong> Periodic audits of user permissions
              and access rights
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Secure Authentication:</LegalStrong> Strong password policies and secure
              session management
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Network Security</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Firewalls:</LegalStrong> Advanced firewall protection and intrusion
              detection systems
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>DDoS Protection:</LegalStrong> Distributed denial-of-service attack
              mitigation
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Network Monitoring:</LegalStrong> 24/7 monitoring of network traffic and
              anomalies
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Secure Infrastructure:</LegalStrong> Hosted on secure, compliant cloud
              infrastructure
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Application Security</LegalSectionHeading>

          <LegalSubheading>Secure Development</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Security by Design:</LegalStrong> Security considerations integrated into
              development lifecycle
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Code Reviews:</LegalStrong> Mandatory security-focused code reviews for
              all changes
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Static Analysis:</LegalStrong> Automated security scanning of source code
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Dependency Management:</LegalStrong> Regular updates and security patches
              for all dependencies
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Vulnerability Management</LegalSubheading>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Regular Scanning:</LegalStrong> Automated vulnerability assessments and
              penetration testing
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Bug Bounty Program:</LegalStrong> Responsible disclosure program for
              security researchers
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Patch Management:</LegalStrong> Rapid deployment of security updates and
              patches
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Third-Party Audits:</LegalStrong> Regular security audits by independent
              security firms
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Compliance and Enterprise Review</LegalSectionHeading>
          <LegalParagraph>
            Community users control their own deployment and compliance posture. Managed compliance
            programs are available for Enterprise requests:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Security Review:</LegalStrong> Enterprise customers can request security
              documentation and questionnaire support
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Privacy Support:</LegalStrong> Enterprise requests can include DPA and
              privacy review workflows
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Deployment Control:</LegalStrong> Community deployments keep
              infrastructure, storage, and provider keys under your control
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>ISO 27001:</LegalStrong> Information security management system
              certification (in progress)
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Incident Response</LegalSectionHeading>

          <LegalSubheading>Security Incident Management</LegalSubheading>
          <LegalParagraph>
            We have established procedures for detecting, responding to, and recovering from
            security incidents:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>24/7 Monitoring:</LegalStrong> Continuous monitoring for security threats
              and anomalies
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Incident Response Team:</LegalStrong> Dedicated team for rapid incident
              response
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Communication Plan:</LegalStrong> Clear procedures for notifying affected
              users
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Recovery Procedures:</LegalStrong> Tested backup and recovery processes
            </LegalBulletItem>
          </LegalBulletList>

          <LegalSubheading>Breach Notification</LegalSubheading>
          <LegalParagraph>In the unlikely event of a data breach, we will:</LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>Notify affected users within 72 hours of discovery</LegalBulletItem>
            <LegalBulletItem>
              Provide clear information about the nature and scope of the breach
            </LegalBulletItem>
            <LegalBulletItem>Outline steps taken to address the incident</LegalBulletItem>
            <LegalBulletItem>Offer guidance on protective measures users can take</LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Employee Security</LegalSectionHeading>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Background Checks:</LegalStrong> Comprehensive screening for all
              employees with data access
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Security Training:</LegalStrong> Regular security awareness training and
              updates
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Confidentiality Agreements:</LegalStrong> Strict confidentiality and data
              protection agreements
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Access Termination:</LegalStrong> Immediate revocation of access upon
              employment termination
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Physical Security</LegalSectionHeading>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Secure Data Centers:</LegalStrong> Tier III+ data centers with 24/7
              physical security
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Access Controls:</LegalStrong> Biometric and multi-factor authentication
              for facility access
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Environmental Controls:</LegalStrong> Climate control and fire
              suppression systems
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Surveillance:</LegalStrong> Continuous video monitoring and security
              personnel
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Your Security Responsibilities</LegalSectionHeading>
          <LegalParagraph>
            While we implement comprehensive security measures, you also play a crucial role in
            maintaining security:
          </LegalParagraph>
          <LegalBulletList>
            <LegalBulletItem>
              <LegalStrong>Strong Passwords:</LegalStrong> Use unique, complex passwords for your
              account
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Two-Factor Authentication:</LegalStrong> Enable 2FA for additional
              account protection
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Regular Updates:</LegalStrong> Keep your devices and browsers updated
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Secure Networks:</LegalStrong> Avoid using public Wi-Fi for sensitive
              operations
            </LegalBulletItem>
            <LegalBulletItem>
              <LegalStrong>Report Suspicious Activity:</LegalStrong> Immediately report any
              suspicious account activity
            </LegalBulletItem>
          </LegalBulletList>
        </section>

        <LegalDivider />

        <section>
          <LegalSectionHeading>Security Contact</LegalSectionHeading>
          <LegalParagraph>
            If you have security concerns or wish to report a vulnerability, please contact us:
          </LegalParagraph>
          <LegalInfoBox>
            <LegalParagraph className="mb-2">
              <LegalStrong>NowFlow Security Team</LegalStrong>
            </LegalParagraph>
            <LegalParagraph className="mb-2">
              Security Email:{' '}
              <LegalLink href="mailto:security@nowflow.io">security@nowflow.io</LegalLink>
            </LegalParagraph>
            <LegalParagraph className="mb-2">
              General Contact:{' '}
              <LegalLink href="mailto:support@nowflow.io">support@nowflow.io</LegalLink>
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
