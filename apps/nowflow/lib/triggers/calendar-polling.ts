import { eq } from 'drizzle-orm'
import { createLogger } from '@/lib/logs/console-logger'
import { refreshAccessTokenIfNeeded } from '@/app/api/auth/oauth/utils'
import { db } from '@/db'
import { workflowTrigger } from '@/db/schema'

const logger = createLogger('CalendarPolling')

export interface CalendarTriggerConfig {
  provider: 'google_calendar' | 'outlook_calendar' | 'icloud_calendar'
  credentialId: string
  calendarId: string
  triggerOn: 'created' | 'updated' | 'starts' | 'ends'
  minutesBefore?: number
}

export interface CalendarEvent {
  eventId: string
  title: string
  start: string
  end: string
  location: string
  organizer: string
  attendees: string[]
  changeType: 'created' | 'updated' | 'starting' | 'ended'
  provider: string
}

/**
 * Execute calendar polling - check for new/changed/upcoming events
 */
export async function executeCalendarPolling(
  trigger: typeof workflowTrigger.$inferSelect,
  userId: string
): Promise<{ hasNewData: boolean; newData?: CalendarEvent[] }> {
  const config = trigger.config as CalendarTriggerConfig

  if (!config.credentialId) {
    logger.warn(`Calendar trigger ${trigger.id} missing credential`)
    return { hasNewData: false }
  }

  switch (config.provider) {
    case 'google_calendar':
      return pollGoogleCalendar(trigger, config, userId)
    case 'outlook_calendar':
      return pollOutlookCalendar(trigger, config, userId)
    default:
      logger.warn(`Calendar provider ${config.provider} not yet supported for polling`)
      return { hasNewData: false }
  }
}

/**
 * Poll Google Calendar for new/updated events or upcoming events
 */
async function pollGoogleCalendar(
  trigger: typeof workflowTrigger.$inferSelect,
  config: CalendarTriggerConfig,
  userId: string
): Promise<{ hasNewData: boolean; newData?: CalendarEvent[] }> {
  const requestId = `cal-gcal-${trigger.id.slice(0, 8)}`

  try {
    const accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
    if (!accessToken) {
      throw new Error('Failed to get access token for Google Calendar')
    }

    const calendarId = config.calendarId || 'primary'

    if (config.triggerOn === 'starts') {
      return pollGoogleCalendarUpcoming(trigger, config, accessToken, calendarId, requestId)
    }

    // For created/updated events, use updatedMin
    const params = new URLSearchParams()
    if (trigger.lastPolledAt) {
      params.set('updatedMin', trigger.lastPolledAt.toISOString())
    }
    params.set('orderBy', 'updated')
    params.set('singleEvents', 'true')
    params.set('maxResults', '20')

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Google Calendar API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const events: any[] = data.items || []

    if (events.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // Dedup by event ID
    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
    const newEvents = events.filter((e) => !lastSeenIdentifiers.includes(e.id))

    if (newEvents.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    const newIds = newEvents.map((e) => e.id)
    const updatedIdentifiers = [...newIds, ...lastSeenIdentifiers].slice(0, 100)

    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: updatedIdentifiers,
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))

    const calendarEvents: CalendarEvent[] = newEvents.map((e) => ({
      eventId: e.id,
      title: e.summary || '',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      location: e.location || '',
      organizer: e.organizer?.email || '',
      attendees: (e.attendees || []).map((a: any) => a.email),
      changeType: (config.triggerOn === 'updated'
        ? 'updated'
        : 'created') as CalendarEvent['changeType'],
      provider: 'google_calendar',
    }))

    logger.info(`[${requestId}] Found ${calendarEvents.length} new/updated Google Calendar events`)
    return { hasNewData: true, newData: calendarEvents }
  } catch (error: any) {
    logger.error(`[${requestId}] Google Calendar polling error`, error)

    await db
      .update(workflowTrigger)
      .set({
        lastError: error.message,
        failedTriggers: (trigger.failedTriggers || 0) + 1,
        healthStatus: trigger.failedTriggers && trigger.failedTriggers > 3 ? 'error' : 'warning',
      })
      .where(eq(workflowTrigger.id, trigger.id))

    throw error
  }
}

/**
 * Poll for upcoming Google Calendar events (starting within the next polling interval)
 */
async function pollGoogleCalendarUpcoming(
  trigger: typeof workflowTrigger.$inferSelect,
  config: CalendarTriggerConfig,
  accessToken: string,
  calendarId: string,
  requestId: string
): Promise<{ hasNewData: boolean; newData?: CalendarEvent[] }> {
  const now = new Date()
  const minutesBefore = config.minutesBefore || 15
  const pollingInterval = trigger.pollingInterval || 5
  const lookAheadMs = Math.max(minutesBefore, pollingInterval) * 60 * 1000
  const timeMax = new Date(now.getTime() + lookAheadMs)

  const params = new URLSearchParams()
  params.set('timeMin', now.toISOString())
  params.set('timeMax', timeMax.toISOString())
  params.set('singleEvents', 'true')
  params.set('orderBy', 'startTime')
  params.set('maxResults', '20')

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Calendar API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const events: any[] = data.items || []

  if (events.length === 0) {
    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  // Dedup - use event ID + start time composite to avoid re-triggering
  const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
  const newEvents = events.filter((e) => {
    const compositeId = `${e.id}_starts_${e.start?.dateTime || e.start?.date}`
    return !lastSeenIdentifiers.includes(compositeId)
  })

  if (newEvents.length === 0) {
    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  const newIds = newEvents.map((e) => `${e.id}_starts_${e.start?.dateTime || e.start?.date}`)
  const updatedIdentifiers = [...newIds, ...lastSeenIdentifiers].slice(0, 100)

  await db
    .update(workflowTrigger)
    .set({
      lastSeenIdentifiers: updatedIdentifiers,
      lastPolledAt: new Date(),
    })
    .where(eq(workflowTrigger.id, trigger.id))

  const calendarEvents: CalendarEvent[] = newEvents.map((e) => ({
    eventId: e.id,
    title: e.summary || '',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    location: e.location || '',
    organizer: e.organizer?.email || '',
    attendees: (e.attendees || []).map((a: any) => a.email),
    changeType: 'starting' as const,
    provider: 'google_calendar',
  }))

  logger.info(`[${requestId}] Found ${calendarEvents.length} upcoming Google Calendar events`)
  return { hasNewData: true, newData: calendarEvents }
}

/**
 * Poll Outlook Calendar for new/updated events
 */
async function pollOutlookCalendar(
  trigger: typeof workflowTrigger.$inferSelect,
  config: CalendarTriggerConfig,
  userId: string
): Promise<{ hasNewData: boolean; newData?: CalendarEvent[] }> {
  const requestId = `cal-outlook-${trigger.id.slice(0, 8)}`

  try {
    const accessToken = await refreshAccessTokenIfNeeded(config.credentialId, userId, requestId)
    if (!accessToken) {
      throw new Error('Failed to get access token for Outlook Calendar')
    }

    if (config.triggerOn === 'starts') {
      return pollOutlookCalendarUpcoming(trigger, config, accessToken, requestId)
    }

    // For created/updated events
    const params = new URLSearchParams()
    if (trigger.lastPolledAt) {
      params.set('$filter', `createdDateTime ge ${trigger.lastPolledAt.toISOString()}`)
    }
    params.set('$orderby', 'createdDateTime desc')
    params.set('$top', '20')
    params.set('$select', 'id,subject,start,end,location,organizer,attendees,createdDateTime')

    const url = `https://graph.microsoft.com/v1.0/me/calendar/events?${params.toString()}`

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Outlook Calendar API error ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const events: any[] = data.value || []

    if (events.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    // Dedup by event ID
    const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
    const newEvents = events.filter((e) => !lastSeenIdentifiers.includes(e.id))

    if (newEvents.length === 0) {
      await db
        .update(workflowTrigger)
        .set({ lastPolledAt: new Date() })
        .where(eq(workflowTrigger.id, trigger.id))
      return { hasNewData: false }
    }

    const newIds = newEvents.map((e) => e.id)
    const updatedIdentifiers = [...newIds, ...lastSeenIdentifiers].slice(0, 100)

    await db
      .update(workflowTrigger)
      .set({
        lastSeenIdentifiers: updatedIdentifiers,
        lastPolledAt: new Date(),
      })
      .where(eq(workflowTrigger.id, trigger.id))

    const calendarEvents: CalendarEvent[] = newEvents.map((e) => ({
      eventId: e.id,
      title: e.subject || '',
      start: e.start?.dateTime || '',
      end: e.end?.dateTime || '',
      location: e.location?.displayName || '',
      organizer: e.organizer?.emailAddress?.address || '',
      attendees: (e.attendees || []).map((a: any) => a.emailAddress?.address).filter(Boolean),
      changeType: (config.triggerOn === 'updated'
        ? 'updated'
        : 'created') as CalendarEvent['changeType'],
      provider: 'outlook_calendar',
    }))

    logger.info(`[${requestId}] Found ${calendarEvents.length} new/updated Outlook Calendar events`)
    return { hasNewData: true, newData: calendarEvents }
  } catch (error: any) {
    logger.error(`[${requestId}] Outlook Calendar polling error`, error)

    await db
      .update(workflowTrigger)
      .set({
        lastError: error.message,
        failedTriggers: (trigger.failedTriggers || 0) + 1,
        healthStatus: trigger.failedTriggers && trigger.failedTriggers > 3 ? 'error' : 'warning',
      })
      .where(eq(workflowTrigger.id, trigger.id))

    throw error
  }
}

/**
 * Poll for upcoming Outlook Calendar events
 */
async function pollOutlookCalendarUpcoming(
  trigger: typeof workflowTrigger.$inferSelect,
  config: CalendarTriggerConfig,
  accessToken: string,
  requestId: string
): Promise<{ hasNewData: boolean; newData?: CalendarEvent[] }> {
  const now = new Date()
  const minutesBefore = config.minutesBefore || 15
  const pollingInterval = trigger.pollingInterval || 5
  const lookAheadMs = Math.max(minutesBefore, pollingInterval) * 60 * 1000
  const timeMax = new Date(now.getTime() + lookAheadMs)

  const params = new URLSearchParams()
  params.set('startDateTime', now.toISOString())
  params.set('endDateTime', timeMax.toISOString())
  params.set('$orderby', 'start/dateTime')
  params.set('$top', '20')
  params.set('$select', 'id,subject,start,end,location,organizer,attendees')

  const url = `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Outlook Calendar API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const events: any[] = data.value || []

  if (events.length === 0) {
    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  // Dedup
  const lastSeenIdentifiers = (trigger.lastSeenIdentifiers as string[]) || []
  const newEvents = events.filter((e) => {
    const compositeId = `${e.id}_starts_${e.start?.dateTime}`
    return !lastSeenIdentifiers.includes(compositeId)
  })

  if (newEvents.length === 0) {
    await db
      .update(workflowTrigger)
      .set({ lastPolledAt: new Date() })
      .where(eq(workflowTrigger.id, trigger.id))
    return { hasNewData: false }
  }

  const newIds = newEvents.map((e) => `${e.id}_starts_${e.start?.dateTime}`)
  const updatedIdentifiers = [...newIds, ...lastSeenIdentifiers].slice(0, 100)

  await db
    .update(workflowTrigger)
    .set({
      lastSeenIdentifiers: updatedIdentifiers,
      lastPolledAt: new Date(),
    })
    .where(eq(workflowTrigger.id, trigger.id))

  const calendarEvents: CalendarEvent[] = newEvents.map((e) => ({
    eventId: e.id,
    title: e.subject || '',
    start: e.start?.dateTime || '',
    end: e.end?.dateTime || '',
    location: e.location?.displayName || '',
    organizer: e.organizer?.emailAddress?.address || '',
    attendees: (e.attendees || []).map((a: any) => a.emailAddress?.address).filter(Boolean),
    changeType: 'starting' as const,
    provider: 'outlook_calendar',
  }))

  logger.info(`[${requestId}] Found ${calendarEvents.length} upcoming Outlook Calendar events`)
  return { hasNewData: true, newData: calendarEvents }
}
