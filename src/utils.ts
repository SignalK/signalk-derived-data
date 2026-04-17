/**
 * Small angle and position helpers shared by the calcs/ modules.
 * Kept intentionally dependency-free so every calculator can import
 * them without pulling in lodash or geolib.
 */

/**
 * @description Tests that supplied value is a number
 * @param value Value to test
 * @returns true if value is a number
 */
function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && value !== Infinity
}

/**
 * @description Tests that supplied value is between 0 & 2*Pi
 * @param value Value in radians
 * @returns true if value is between 0 & 2*Pi
 */
export const isCompassAngle = (value: unknown): boolean => {
  if (isNumeric(value)) {
    const twoPi = Math.PI * 2
    return value >= 0 && value < twoPi
  } else {
    return false
  }
}

/**
 * @description Ensures supplied value is between 0 & 2*Pi
 * @param value Value in radians
 * @returns Value between 0 & 2*Pi
 */
export const formatCompassAngle = (value: unknown): number | null => {
  if (isNumeric(value)) {
    const twoPi = Math.PI * 2
    if (value >= twoPi) return value - twoPi
    if (value < 0) return twoPi + value
    return value
  } else {
    return null
  }
}

export interface Position {
  latitude: number
  longitude: number
}

/**
 * @description Tests that supplied value is a valid Signal K position
 * @param value Value to test
 * @returns true if value is a valid Signal K position
 */
export const isPosition = (value: unknown): value is Position => {
  if (
    value &&
    typeof value === 'object' &&
    isNumeric((value as Position).latitude) &&
    isNumeric((value as Position).longitude)
  ) {
    const p = value as Position
    return (
      p.latitude >= -90 &&
      p.latitude <= 90 &&
      p.longitude >= -180 &&
      p.longitude <= 180
    )
  } else {
    return false
  }
}

export const degreesToRadians = (value: number): number =>
  (Math.PI / 180) * value
export const radiansToDegrees = (value: number): number =>
  (180 / Math.PI) * value
