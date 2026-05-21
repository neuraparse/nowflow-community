/**
 * Utility functions for temperature-based styling
 */
import { getMaxTemperature as getMaxTemp } from '@/providers/model-capabilities'

/**
 * Get the maximum temperature value for a model
 * @param model Model name
 * @returns Maximum temperature value (1 or 2) or undefined if temperature not supported
 */
export function getMaxTemperature(model: string): number | undefined {
  return getMaxTemp(model) ?? 1 // Default 1 for unknown models
}

/**
 * Get a color based on temperature value
 * @param temperature Temperature value (0-2)
 * @returns CSS color string
 */
export function getTemperatureColor(temperature: number | null | undefined): string {
  if (temperature === null || temperature === undefined) {
    return 'rgba(148, 163, 184, 0.5)' // Default gray for no temperature
  }

  // Simplified color selection based on temperature range
  if (temperature <= 0.3) {
    return 'rgb(59, 130, 246)' // Blue (cold)
  } else if (temperature <= 0.7) {
    return 'rgb(16, 185, 129)' // Green (mild)
  } else if (temperature <= 1.2) {
    return 'rgb(245, 158, 11)' // Amber (warm)
  } else {
    return 'rgb(239, 68, 68)' // Red (hot)
  }
}

/**
 * Get a gradient string based on temperature value
 * @param temperature Temperature value (0-2)
 * @param baseColor Base color to blend with
 * @returns CSS gradient string
 */
export function getTemperatureGradient(
  temperature: number | null | undefined,
  baseColor: string
): string {
  const tempColor = getTemperatureColor(temperature)

  return `linear-gradient(135deg, ${baseColor} 0%, ${tempColor} 100%)`
}

/**
 * Get a descriptive label for a temperature value
 */
export function getTemperatureLabel(temperature: number | null | undefined): string {
  if (temperature === null || temperature === undefined) {
    return 'Default'
  }

  if (temperature <= 0.3) return 'Precise'
  if (temperature <= 0.7) return 'Balanced'
  if (temperature <= 1.2) return 'Creative'
  return 'Experimental'
}

/**
 * Get a CSS animation based on temperature value
 */
export function getTemperatureAnimation(temperature: number | null | undefined): string {
  if (temperature === null || temperature === undefined) {
    return 'none'
  }

  const normalizedTemp = Math.min(Math.max(temperature, 0), 2) / 2
  const animationDuration = 3 - normalizedTemp * 2 // Faster animation for higher temperatures

  return `pulse ${animationDuration}s ease-in-out infinite`
}
