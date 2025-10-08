/**
 * @description Tests that supplied value is a number
 * @param value Value to test
 * @returns true if value is a number
 */
function isNumeric (value) {
  return typeof value === 'number' && !isNaN(value) && value !== Infinity
}

/**
 * @description Tests that supplied value is between 0 & 2*Pi
 * @param value Value in radians
 * @returns true if value is between 0 & 2*Pi
 */
exports.isCompassAngle = value => {
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
exports.formatCompassAngle = value => {
  if (isNumeric(value)) {
    const twoPi = Math.PI * 2
    if (value >= twoPi) return value - twoPi
    if (value < 0) return twoPi + value
    return value
  } else {
    return null
  }
}

/**
 * @description Tests that supplied value is a valid Signal K position
 * @param value Value to test
 * @returns true if value is a valid Signal K position
 */
exports.isPosition = value => {
  if (value && isNumeric(value.latitude) && isNumeric(value.longitude)) {
    return (
      value.latitude >= -90 &&
      value.latitude <= 90 &&
      (value.longitude >= -180 && value.longitude <= 180)
    )
  } else {
    return false
  }
}

exports.degreesToRadians = value => Math.PI / 180 * value
exports.radiansToDegrees = value => 180 / Math.PI * value

/**
 * @description Tests new value against current path value to determine if the
 * path new value should be emitted
 * @param app Signal K server app
 * @param newValue New path value
 * @param path Path to test for the current value
 * @returns true if new path value should be emitted
 */
exports.okToSend = (app, newValue, path) => {
  const pv = app.getSelfPath(path)
  if (!pv && newValue === null) return false
  if (pv?.value === null && newValue === null) return false
  return true
}
