import type { ComponentType, SVGProps } from 'react'
import {
  Calendar,
  Clock,
  Database,
  FileText,
  FolderOpen,
  Mail,
  MousePointer2,
  RefreshCw,
  Webhook,
} from 'lucide-react'
import {
  AirtableIcon,
  BoxIcon,
  DiscordIcon,
  DropboxIcon,
  GithubIcon,
  GmailIcon,
  GoogleCalendarIcon,
  GoogleDriveIcon,
  GoogleSheetsIcon,
  JiraIcon,
  NotionIcon,
  OneDriveIcon,
  OutlookIcon,
  SlackIcon,
  StripeIcon,
  TeamsIcon,
  TelegramIcon,
  TypeformIcon,
  WhatsAppIcon,
} from '@/components/icons/provider-icons'

type StarterIcon = ComponentType<SVGProps<SVGSVGElement>>

export interface StarterTriggerValues {
  startWorkflow?: string | null
  scheduleType?: string | null
  emailProvider?: string | null
  webhookProvider?: string | null
  formProvider?: string | null
  databaseProvider?: string | null
  fileProvider?: string | null
  calendarProvider?: string | null
}

export interface StarterTriggerPresentation {
  title: string
  subtitle: string
  fullLabel: string
  Icon: StarterIcon
  accentColor: string
  brandIcon?: boolean
}

export interface StarterBlockDisplay extends StarterTriggerPresentation {
  displayTitle: string
  displaySubtitle: string
}

interface ProviderPresentation {
  label: string
  Icon: StarterIcon
  accentColor: string
  brandIcon?: boolean
}

const BASE_STARTER_COLOR = '#2FB3FF'

const EMAIL_PRESENTATIONS: Record<string, ProviderPresentation> = {
  gmail: { label: 'Gmail', Icon: GmailIcon, accentColor: '#EA4335', brandIcon: true },
  outlook: { label: 'Outlook', Icon: OutlookIcon, accentColor: '#0A66C2', brandIcon: true },
  imap: { label: 'Mail', Icon: Mail, accentColor: '#2563EB' },
}

const WEBHOOK_PRESENTATIONS: Record<string, ProviderPresentation> = {
  slack: { label: 'Slack', Icon: SlackIcon, accentColor: '#4A154B', brandIcon: true },
  teams: { label: 'Microsoft Teams', Icon: TeamsIcon, accentColor: '#6264A7', brandIcon: true },
  jira: { label: 'Jira', Icon: JiraIcon, accentColor: '#0052CC', brandIcon: true },
  whatsapp: { label: 'WhatsApp', Icon: WhatsAppIcon, accentColor: '#25D366', brandIcon: true },
  github: { label: 'GitHub', Icon: GithubIcon, accentColor: '#181717', brandIcon: true },
  discord: { label: 'Discord', Icon: DiscordIcon, accentColor: '#5865F2', brandIcon: true },
  telegram: { label: 'Telegram', Icon: TelegramIcon, accentColor: '#229ED9', brandIcon: true },
  airtable: { label: 'Airtable', Icon: AirtableIcon, accentColor: '#18BFFF', brandIcon: true },
  stripe: { label: 'Stripe', Icon: StripeIcon, accentColor: '#635BFF', brandIcon: true },
  generic: { label: 'Webhook', Icon: Webhook, accentColor: '#7C3AED' },
}

const FORM_PRESENTATIONS: Record<string, ProviderPresentation> = {
  google_forms: { label: 'Forms', Icon: FileText, accentColor: '#8B5CF6' },
  typeform: { label: 'Typeform', Icon: TypeformIcon, accentColor: '#262627', brandIcon: true },
  jotform: { label: 'Jotform', Icon: FileText, accentColor: '#FF6100' },
  ms_forms: { label: 'Microsoft Forms', Icon: FileText, accentColor: '#107C10' },
  custom: { label: 'Custom Form', Icon: FileText, accentColor: '#8B5CF6' },
}

const DATABASE_PRESENTATIONS: Record<string, ProviderPresentation> = {
  google_sheets: {
    label: 'Google Sheets',
    Icon: GoogleSheetsIcon,
    accentColor: '#0F9D58',
    brandIcon: true,
  },
  airtable: { label: 'Airtable', Icon: AirtableIcon, accentColor: '#18BFFF', brandIcon: true },
  notion: { label: 'Notion', Icon: NotionIcon, accentColor: '#111111', brandIcon: true },
  postgresql: { label: 'PostgreSQL', Icon: Database, accentColor: '#336791' },
  mysql: { label: 'MySQL', Icon: Database, accentColor: '#00758F' },
  mongodb: { label: 'MongoDB', Icon: Database, accentColor: '#47A248' },
}

const FILE_PRESENTATIONS: Record<string, ProviderPresentation> = {
  google_drive: {
    label: 'Google Drive',
    Icon: GoogleDriveIcon,
    accentColor: '#0F9D58',
    brandIcon: true,
  },
  dropbox: { label: 'Dropbox', Icon: DropboxIcon, accentColor: '#0061FF', brandIcon: true },
  onedrive: { label: 'OneDrive', Icon: OneDriveIcon, accentColor: '#0078D4', brandIcon: true },
  s3: { label: 'AWS S3', Icon: FolderOpen, accentColor: '#FF9900' },
  box: { label: 'Box', Icon: BoxIcon, accentColor: '#0061D5', brandIcon: true },
}

const CALENDAR_PRESENTATIONS: Record<string, ProviderPresentation> = {
  google_calendar: {
    label: 'Google Calendar',
    Icon: GoogleCalendarIcon,
    accentColor: '#4285F4',
    brandIcon: true,
  },
  outlook_calendar: {
    label: 'Outlook Calendar',
    Icon: OutlookIcon,
    accentColor: '#0A66C2',
    brandIcon: true,
  },
  icloud_calendar: { label: 'iCloud Calendar', Icon: Calendar, accentColor: '#0EA5E9' },
}

function normalizeLabel(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

function toSentenceCase(value: string): string {
  if (!value) return value

  return value.charAt(0).toUpperCase() + value.slice(1)
}

function scheduleLabel(scheduleType?: string | null): string {
  switch (normalizeLabel(scheduleType)) {
    case 'minutes':
      return 'Recurring'
    case 'hourly':
      return 'Hourly'
    case 'daily':
      return 'Daily'
    case 'weekly':
      return 'Weekly'
    case 'monthly':
      return 'Monthly'
    case 'custom':
      return 'Custom'
    default:
      return 'Scheduled'
  }
}

function providerPresentation(
  map: Record<string, ProviderPresentation>,
  key: string | null | undefined,
  fallback: ProviderPresentation
): ProviderPresentation {
  return map[normalizeLabel(key)] || fallback
}

function buildPresentation(
  title: string,
  subtitle: string,
  Icon: StarterIcon,
  accentColor: string,
  brandIcon?: boolean
): StarterTriggerPresentation {
  return {
    title,
    subtitle,
    fullLabel: `${title} ${subtitle}`.trim(),
    Icon,
    accentColor,
    brandIcon,
  }
}

function getAllAutomaticStarterTitles(): Set<string> {
  const values = [
    'Start',
    'Starter',
    'Start Workflow',
    'Manual Start',
    'Schedule',
    'API Polling',
    ...Object.values(EMAIL_PRESENTATIONS).flatMap((item) => [
      item.label,
      `${item.label} Receive`,
      `${item.label} Receive Trigger`,
    ]),
    ...Object.values(WEBHOOK_PRESENTATIONS).flatMap((item) => [
      item.label,
      `${item.label} Webhook`,
      `${item.label} Webhook Trigger`,
    ]),
    ...Object.values(FORM_PRESENTATIONS).flatMap((item) => [
      item.label,
      `${item.label} Submission`,
      `${item.label} Form Trigger`,
    ]),
    ...Object.values(DATABASE_PRESENTATIONS).flatMap((item) => [
      item.label,
      `${item.label} Change`,
      `${item.label} Change Trigger`,
    ]),
    ...Object.values(FILE_PRESENTATIONS).flatMap((item) => [
      item.label,
      `${item.label} Files`,
      `${item.label} File Trigger`,
    ]),
    ...Object.values(CALENDAR_PRESENTATIONS).flatMap((item) => [
      item.label,
      `${item.label} Event`,
      `${item.label} Event Trigger`,
    ]),
    'Scheduled Trigger',
    'Manual Trigger',
    'Webhook Trigger',
    'Form Trigger',
    'Database Trigger',
    'File Trigger',
    'Calendar Trigger',
    'Polling Trigger',
  ]

  return new Set(values.map((value) => normalizeLabel(value)))
}

const AUTOMATIC_STARTER_TITLES = getAllAutomaticStarterTitles()

export function getStarterTriggerPresentation(
  values: StarterTriggerValues
): StarterTriggerPresentation {
  switch (normalizeLabel(values.startWorkflow) || 'manual') {
    case 'email': {
      const provider = providerPresentation(
        EMAIL_PRESENTATIONS,
        values.emailProvider,
        EMAIL_PRESENTATIONS.gmail
      )
      return buildPresentation(
        provider.label,
        'Receive trigger',
        provider.Icon,
        provider.accentColor,
        provider.brandIcon
      )
    }
    case 'webhook': {
      const provider = providerPresentation(
        WEBHOOK_PRESENTATIONS,
        values.webhookProvider,
        WEBHOOK_PRESENTATIONS.generic
      )
      return buildPresentation(
        provider.label,
        'Webhook trigger',
        provider.Icon,
        provider.accentColor,
        provider.brandIcon
      )
    }
    case 'form': {
      const provider = providerPresentation(
        FORM_PRESENTATIONS,
        values.formProvider,
        FORM_PRESENTATIONS.google_forms
      )
      return buildPresentation(
        provider.label,
        'Form trigger',
        provider.Icon,
        provider.accentColor,
        provider.brandIcon
      )
    }
    case 'database': {
      const provider = providerPresentation(
        DATABASE_PRESENTATIONS,
        values.databaseProvider,
        DATABASE_PRESENTATIONS.google_sheets
      )
      return buildPresentation(
        provider.label,
        'Change trigger',
        provider.Icon,
        provider.accentColor,
        provider.brandIcon
      )
    }
    case 'file': {
      const provider = providerPresentation(
        FILE_PRESENTATIONS,
        values.fileProvider,
        FILE_PRESENTATIONS.google_drive
      )
      return buildPresentation(
        provider.label,
        'File trigger',
        provider.Icon,
        provider.accentColor,
        provider.brandIcon
      )
    }
    case 'calendar': {
      const provider = providerPresentation(
        CALENDAR_PRESENTATIONS,
        values.calendarProvider,
        CALENDAR_PRESENTATIONS.google_calendar
      )
      return buildPresentation(
        provider.label,
        'Event trigger',
        provider.Icon,
        provider.accentColor,
        provider.brandIcon
      )
    }
    case 'schedule': {
      const title = scheduleLabel(values.scheduleType)
      return buildPresentation(title, 'Scheduled trigger', Clock, BASE_STARTER_COLOR)
    }
    case 'polling':
      return buildPresentation('API Polling', 'Polling trigger', RefreshCw, BASE_STARTER_COLOR)
    case 'manual':
    default:
      return buildPresentation('Starter', 'Manual trigger', MousePointer2, BASE_STARTER_COLOR)
  }
}

export function getStarterBlockDisplay(
  blockName: string | undefined,
  values: StarterTriggerValues
): StarterBlockDisplay {
  const presentation = getStarterTriggerPresentation(values)
  const normalizedName = normalizeLabel(blockName)
  const useAutomaticTitle = !normalizedName || AUTOMATIC_STARTER_TITLES.has(normalizedName)

  return {
    ...presentation,
    displayTitle: useAutomaticTitle ? presentation.title : blockName || presentation.title,
    displaySubtitle: useAutomaticTitle
      ? presentation.subtitle
      : toSentenceCase(presentation.fullLabel),
  }
}
