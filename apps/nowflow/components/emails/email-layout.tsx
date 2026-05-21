import type { ReactNode } from 'react'
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Row,
  Section,
} from '@react-email/components'
import { baseStyles } from './base-styles'
import EmailFooter from './footer'

export const EMAIL_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export const EMAIL_FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');"

type EmailLayoutProps = {
  preview: string
  children: ReactNode
  showFooter?: boolean
  showLogo?: boolean
  showAccentBar?: boolean
  showTopDivider?: boolean
}

export const EmailLayout = ({
  preview,
  children,
  showFooter = true,
  showLogo = true,
  showAccentBar = true,
  showTopDivider = false,
}: EmailLayoutProps) => (
  <Html>
    <Head>
      <style>{EMAIL_FONT_IMPORT}</style>
    </Head>
    <Body style={baseStyles.main}>
      <Preview>{preview}</Preview>
      <Container style={baseStyles.container}>
        {showAccentBar ? <div style={baseStyles.accentBar} /> : null}
        {showLogo ? (
          <Section style={baseStyles.header}>
            <div style={baseStyles.logoCard}>
              <Img
                src={`${EMAIL_BASE_URL}/static/nowflow-logo-email.png`}
                width="48"
                alt="NowFlow"
                style={baseStyles.logo}
              />
            </div>
          </Section>
        ) : null}
        {showTopDivider ? (
          <Section style={baseStyles.sectionsBorders}>
            <Row>
              <Column style={baseStyles.sectionBorder} />
              <Column style={baseStyles.sectionCenter} />
              <Column style={baseStyles.sectionBorder} />
            </Row>
          </Section>
        ) : null}
        {children}
      </Container>
      {showFooter ? <EmailFooter /> : null}
    </Body>
  </Html>
)
