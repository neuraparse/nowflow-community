/**
 * Schedule-options → cron-expression converter.
 *
 * Extracted from `lib/utils.ts`. Maps the high-level scheduling UI options
 * (minutes / hourly / daily / weekly / monthly / custom) to a 5-field cron
 * string consumed by the workflow scheduler. Callers should import from
 * `@/lib/utils` (the canonical entry — re-exports this helper).
 */

export function convertScheduleOptionsToCron(
  scheduleType: string,
  options: Record<string, string>
): string {
  switch (scheduleType) {
    case 'minutes': {
      const interval = options.minutesInterval || '15'
      return `*/${interval} * * * *`
    }
    case 'hourly': {
      return `${options.hourlyMinute || '00'} * * * *`
    }
    case 'daily': {
      const [minute, hour] = (options.dailyTime || '00:09').split(':')
      return `${minute || '00'} ${hour || '09'} * * *`
    }
    case 'weekly': {
      const dayMap: Record<string, number> = {
        MON: 1,
        TUE: 2,
        WED: 3,
        THU: 4,
        FRI: 5,
        SAT: 6,
        SUN: 0,
      }
      const day = dayMap[options.weeklyDay || 'MON']
      const [minute, hour] = (options.weeklyDayTime || '00:09').split(':')
      return `${minute || '00'} ${hour || '09'} * * ${day}`
    }
    case 'monthly': {
      const day = options.monthlyDay || '1'
      const [minute, hour] = (options.monthlyTime || '00:09').split(':')
      return `${minute || '00'} ${hour || '09'} ${day} * *`
    }
    case 'custom': {
      return options.cronExpression
    }
    default:
      throw new Error('Unsupported schedule type')
  }
}
