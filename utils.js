/**
 * @description Tests that supplied value is a number
 * @param value Value to test
 * @returns true if value is a number
 */
function isNumeric(value) {
  return typeof value === 'number' && !isNaN(value) && value !== Infinity
}

/**
 * @description Tests that supplied value is between 0 & 2*Pi
 * @param value Value in radians
 * @returns true if value is between 0 & 2*Pi
 */
exports.isCompassAngle = (value) => {
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
exports.formatCompassAngle = (value) => {
  if (isNumeric(value)) {
    const twoPi = Math.PI * 2
    // Fast path keeps already-normalised values bit-identical; the
    // modulo handles any multiple of 2*Pi, including large negatives.
    if (value >= 0 && value < twoPi) return value
    return ((value % twoPi) + twoPi) % twoPi
  } else {
    return null
  }
}

/**
 * @description Tests that supplied value is a valid Signal K position
 * @param value Value to test
 * @returns true if value is a valid Signal K position
 */
exports.isPosition = (value) => {
  if (value && isNumeric(value.latitude) && isNumeric(value.longitude)) {
    return (
      value.latitude >= -90 &&
      value.latitude <= 90 &&
      value.longitude >= -180 &&
      value.longitude <= 180
    )
  } else {
    return false
  }
}

exports.degreesToRadians = (value) => (Math.PI / 180) * value
exports.radiansToDegrees = (value) => (180 / Math.PI) * value
