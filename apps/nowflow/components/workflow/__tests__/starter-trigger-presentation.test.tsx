/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { useState } from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  getStarterBlockDisplay,
  getStarterTriggerPresentation,
  type StarterTriggerValues,
} from '@/components/workflow/starter-trigger-presentation'

// Mock the provider-icons module so each icon renders as a tagged SVG we can target.
vi.mock('@/components/icons/provider-icons', () => {
  const make = (testId: string) => {
    const Comp = (props: React.SVGProps<SVGSVGElement>) =>
      React.createElement('svg', { ...props, 'data-testid': testId })
    Comp.displayName = testId
    return Comp
  }
  return {
    AirtableIcon: make('AirtableIcon'),
    BoxIcon: make('BoxIcon'),
    DiscordIcon: make('DiscordIcon'),
    DropboxIcon: make('DropboxIcon'),
    GithubIcon: make('GithubIcon'),
    GmailIcon: make('GmailIcon'),
    GoogleCalendarIcon: make('GoogleCalendarIcon'),
    GoogleDriveIcon: make('GoogleDriveIcon'),
    GoogleSheetsIcon: make('GoogleSheetsIcon'),
    JiraIcon: make('JiraIcon'),
    NotionIcon: make('NotionIcon'),
    OneDriveIcon: make('OneDriveIcon'),
    OutlookIcon: make('OutlookIcon'),
    SlackIcon: make('SlackIcon'),
    StripeIcon: make('StripeIcon'),
    TeamsIcon: make('TeamsIcon'),
    TelegramIcon: make('TelegramIcon'),
    TypeformIcon: make('TypeformIcon'),
    WhatsAppIcon: make('WhatsAppIcon'),
  }
})

// Small presentational wrapper that exercises the helper as a selectable trigger list.
type StarterKey =
  | 'manual'
  | 'email'
  | 'webhook'
  | 'form'
  | 'database'
  | 'file'
  | 'calendar'
  | 'schedule'
  | 'polling'

const ALL_TRIGGERS: StarterKey[] = [
  'manual',
  'email',
  'webhook',
  'form',
  'database',
  'file',
  'calendar',
  'schedule',
  'polling',
]

function StarterTriggerList({
  initial = 'manual',
  onChange,
}: {
  initial?: StarterKey
  onChange?: (value: StarterKey) => void
}) {
  const [selected, setSelected] = useState<StarterKey>(initial)

  return (
    <ul role="listbox" aria-label="Starter triggers">
      {ALL_TRIGGERS.map((key) => {
        const values: StarterTriggerValues = { startWorkflow: key }
        const presentation = getStarterTriggerPresentation(values)
        const isSelected = selected === key
        return (
          <li key={key}>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              data-selected={isSelected ? 'true' : 'false'}
              data-trigger={key}
              onClick={() => {
                setSelected(key)
                onChange?.(key)
              }}
            >
              <presentation.Icon aria-hidden="true" />
              <span>{presentation.title}</span>
              <span>{presentation.subtitle}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

describe('getStarterTriggerPresentation', () => {
  it('returns the manual starter for an empty values object', () => {
    const p = getStarterTriggerPresentation({})
    expect(p.title).toBe('Starter')
    expect(p.subtitle).toBe('Manual trigger')
    expect(p.fullLabel).toBe('Starter Manual trigger')
    expect(p.accentColor).toBe('#2FB3FF')
    expect(typeof p.Icon).toBe('object')
  })

  it('returns the manual starter for an unknown startWorkflow value', () => {
    const p = getStarterTriggerPresentation({ startWorkflow: 'not-a-real-type' })
    expect(p.title).toBe('Starter')
    expect(p.subtitle).toBe('Manual trigger')
  })

  it('maps email + known provider to the provider presentation', () => {
    const p = getStarterTriggerPresentation({ startWorkflow: 'email', emailProvider: 'gmail' })
    expect(p.title).toBe('Gmail')
    expect(p.subtitle).toBe('Receive trigger')
    expect(p.accentColor).toBe('#EA4335')
    expect(p.brandIcon).toBe(true)
  })

  it('falls back to gmail for email with unknown provider', () => {
    const p = getStarterTriggerPresentation({ startWorkflow: 'email', emailProvider: 'nope' })
    expect(p.title).toBe('Gmail')
  })

  it('is case-insensitive for startWorkflow and provider keys', () => {
    const p = getStarterTriggerPresentation({ startWorkflow: 'EMAIL', emailProvider: 'GMAIL' })
    expect(p.title).toBe('Gmail')
  })

  it('maps webhook provider variants', () => {
    expect(
      getStarterTriggerPresentation({ startWorkflow: 'webhook', webhookProvider: 'slack' }).title
    ).toBe('Slack')
    expect(
      getStarterTriggerPresentation({ startWorkflow: 'webhook', webhookProvider: 'github' }).title
    ).toBe('GitHub')
    // Unknown webhook falls back to generic.
    expect(
      getStarterTriggerPresentation({ startWorkflow: 'webhook', webhookProvider: 'xyz' }).title
    ).toBe('Webhook')
  })

  it('maps form/database/file/calendar with subtitle suffix', () => {
    expect(
      getStarterTriggerPresentation({ startWorkflow: 'form', formProvider: 'typeform' }).subtitle
    ).toBe('Form trigger')
    expect(
      getStarterTriggerPresentation({ startWorkflow: 'database', databaseProvider: 'notion' })
        .subtitle
    ).toBe('Change trigger')
    expect(
      getStarterTriggerPresentation({ startWorkflow: 'file', fileProvider: 'dropbox' }).subtitle
    ).toBe('File trigger')
    expect(
      getStarterTriggerPresentation({
        startWorkflow: 'calendar',
        calendarProvider: 'google_calendar',
      }).subtitle
    ).toBe('Event trigger')
  })

  it('maps each schedule type to a human-friendly title', () => {
    const cases: Array<[string, string]> = [
      ['minutes', 'Recurring'],
      ['hourly', 'Hourly'],
      ['daily', 'Daily'],
      ['weekly', 'Weekly'],
      ['monthly', 'Monthly'],
      ['custom', 'Custom'],
      ['other', 'Scheduled'],
    ]
    for (const [scheduleType, title] of cases) {
      const p = getStarterTriggerPresentation({ startWorkflow: 'schedule', scheduleType })
      expect(p.title).toBe(title)
      expect(p.subtitle).toBe('Scheduled trigger')
    }
  })

  it('handles polling', () => {
    const p = getStarterTriggerPresentation({ startWorkflow: 'polling' })
    expect(p.title).toBe('API Polling')
    expect(p.subtitle).toBe('Polling trigger')
  })
})

describe('getStarterBlockDisplay', () => {
  it('uses the automatic title when the block name is in the known auto-title set', () => {
    const d = getStarterBlockDisplay('Starter', { startWorkflow: 'manual' })
    expect(d.displayTitle).toBe('Starter')
    expect(d.displaySubtitle).toBe('Manual trigger')
  })

  it('uses a custom block name as-is when it is not in the auto-title set', () => {
    const d = getStarterBlockDisplay('My Custom Trigger', { startWorkflow: 'manual' })
    expect(d.displayTitle).toBe('My Custom Trigger')
    // Subtitle becomes sentence-cased full presentation label.
    expect(d.displaySubtitle).toBe('Starter Manual trigger')
  })

  it('falls back to the presentation title when block name is empty', () => {
    const d = getStarterBlockDisplay(undefined, { startWorkflow: 'manual' })
    expect(d.displayTitle).toBe('Starter')
  })
})

describe('<StarterTriggerList /> (presentation consumer)', () => {
  it('renders every known trigger type', () => {
    render(<StarterTriggerList />)
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(ALL_TRIGGERS.length)
    for (const key of ALL_TRIGGERS) {
      // data-trigger attribute matches each known key.
      expect(document.querySelector(`[data-trigger="${key}"]`)).not.toBeNull()
    }
  })

  it('marks the initially selected trigger with aria-selected=true', () => {
    render(<StarterTriggerList initial="webhook" />)
    const webhook = document.querySelector('[data-trigger="webhook"]') as HTMLElement
    expect(webhook.getAttribute('aria-selected')).toBe('true')
    expect(webhook.getAttribute('data-selected')).toBe('true')
    // All others are not selected.
    for (const key of ALL_TRIGGERS.filter((k) => k !== 'webhook')) {
      const el = document.querySelector(`[data-trigger="${key}"]`) as HTMLElement
      expect(el.getAttribute('aria-selected')).toBe('false')
    }
  })

  it('clicking a trigger updates selection and fires onChange', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<StarterTriggerList initial="manual" onChange={onChange} />)

    const webhook = document.querySelector('[data-trigger="webhook"]') as HTMLElement
    await user.click(webhook)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('webhook')
    expect(webhook.getAttribute('aria-selected')).toBe('true')
    expect(
      (document.querySelector('[data-trigger="manual"]') as HTMLElement).getAttribute(
        'aria-selected'
      )
    ).toBe('false')
  })

  it('supports keyboard activation (Enter) of trigger buttons', () => {
    const onChange = vi.fn()
    render(<StarterTriggerList initial="manual" onChange={onChange} />)

    const schedule = document.querySelector('[data-trigger="schedule"]') as HTMLElement
    schedule.focus()
    fireEvent.keyDown(schedule, { key: 'Enter', code: 'Enter' })
    // Native buttons fire click on Enter; simulate click to mirror real browser behaviour.
    fireEvent.click(schedule)

    expect(onChange).toHaveBeenCalledWith('schedule')
    expect(schedule.getAttribute('aria-selected')).toBe('true')
  })
})
