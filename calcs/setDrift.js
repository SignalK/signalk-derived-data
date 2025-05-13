const _ = require('lodash')

const DEFAULT_MAGNETIC_VARIATION = 9999
const PRECISION = 10

/**
 * Normalize an angle to the range [0, 2π)
 * @param {number|null|undefined} angle
 * @returns {number|null}
 */
function normalizeAngle (angle) {
  if (_.isUndefined(angle) || angle === null) return null
  angle = angle % (2 * Math.PI)
  return angle < 0 ? angle + 2 * Math.PI : angle
}

module.exports = function (app, plugin) {
  return {
    group: 'course data',
    optionKey: 'setDrift',
    title: 'Set and Drift',
    derivedFrom: [
      'navigation.headingMagnetic',
      'navigation.courseOverGroundTrue',
      'navigation.speedThroughWater',
      'navigation.speedOverGround',
      'navigation.magneticVariation'
    ],
    defaults: [
      undefined,
      undefined,
      undefined,
      undefined,
      DEFAULT_MAGNETIC_VARIATION
    ],

    /**
     * Calculates set and drift vector from motion data
     */
    calculator (
      headingMagnetic,
      courseOverGroundTrue,
      speedThroughWater,
      speedOverGround,
      magneticVariation
    ) {
      if (magneticVariation === DEFAULT_MAGNETIC_VARIATION) {
        magneticVariation = app.getSelfPath(
          'navigation.magneticVariation.value'
        )
      }

      // Case: no movement
      if (speedOverGround === 0 && speedThroughWater === 0) {
        return [
          { path: 'environment.current.drift', value: 0 },
          { path: 'environment.current.setTrue', value: null },
          { path: 'environment.current.setMagnetic', value: null },
          { path: 'environment.current.driftImpact', value: 0 }
        ]
      }

      const delta = courseOverGroundTrue - headingMagnetic
      const cosDelta = Math.cos(delta)
      const sinDelta = Math.sin(delta)

      // Drift magnitude
      const drift = Math.sqrt(
        Math.max(
          0,
          speedOverGround ** 2 +
            speedThroughWater ** 2 -
            2 * speedThroughWater * speedOverGround * cosDelta
        )
      )

      // Set (magnetic direction of current)
      let setMagnetic = Math.atan2(
        speedOverGround * sinDelta,
        speedThroughWater - speedOverGround * cosDelta
      )
      setMagnetic = normalizeAngle(setMagnetic + Math.PI)

      // Drift vector components
      const cogX = speedOverGround * Math.cos(courseOverGroundTrue)
      const cogY = speedOverGround * Math.sin(courseOverGroundTrue)
      const swX = speedThroughWater * Math.cos(headingMagnetic)
      const swY = speedThroughWater * Math.sin(headingMagnetic)

      const driftX = cogX - swX
      const driftY = cogY - swY

      // Drift impact (projection of drift onto motion vector)
      let driftImpact
      if (speedOverGround === 0) {
        driftImpact = -speedThroughWater
      } else {
        driftImpact = (cogX * driftX + cogY * driftY) / speedOverGround
      }

      // Convert to true direction
      let setTrue =
        _.isUndefined(magneticVariation) || magneticVariation === null
          ? null
          : normalizeAngle(setMagnetic + magneticVariation)

      return [
        { path: 'environment.current.drift', value: drift },
        { path: 'environment.current.setTrue', value: setTrue },
        { path: 'environment.current.setMagnetic', value: setMagnetic },
        { path: 'environment.current.driftImpact', value: driftImpact }
      ]
    },

    tests: [
      {
        input: [0.1, 0.2, 5, 4.5, null], // no magnetic variation
        expected: [
          { path: 'environment.current.drift', value: 0.6890664427243886 },
          { path: 'environment.current.setTrue', value: null },
          {
            path: 'environment.current.setMagnetic',
            value: 3.8517717793619464
          },
          {
            path: 'environment.current.driftImpact',
            value: -0.4750208263901283
          }
        ]
      },
      {
        input: [0.5, 0.7, 6, 5.5, 0.1],
        expected: [
          { path: 'environment.current.drift', value: 1.251241728235616 },
          { path: 'environment.current.setTrue', value: 4.303481965647525 },
          {
            path: 'environment.current.setMagnetic',
            value: 4.2034819656475255
          },
          { path: 'environment.current.driftImpact', value: -0.38039946704745 } // negative drift
        ]
      },
      {
        input: [0.2, 0.2, 4, 5, 0.05],
        expected: [
          { path: 'environment.current.drift', value: 1.0 },
          { path: 'environment.current.setTrue', value: 0.05 },
          { path: 'environment.current.setMagnetic', value: 0 },
          { path: 'environment.current.driftImpact', value: 0.9999999999999998 } // positive drift
        ]
      },
      {
        input: [0.1, 0.0, 0, 0, 0.05], // no movement
        expected: [
          { path: 'environment.current.drift', value: 0 },
          { path: 'environment.current.setTrue', value: null },
          { path: 'environment.current.setMagnetic', value: null },
          { path: 'environment.current.driftImpact', value: 0 }
        ]
      },
      {
        input: [0.0, 1.5708, 1.28611, 2.57222, 0.0], // 0 degrees, 90 degrees, 1.28611 m/s, 2.57222 m/s
        expected: [
          { path: 'environment.current.drift', value: 2.875833611943622 },
          { path: 'environment.current.setTrue', value: 4.24873843282142 },
          { path: 'environment.current.setMagnetic', value: 4.24873843282142 },
          { path: 'environment.current.driftImpact', value: 2.5722247241458156 }
        ]
      },
      {
        input: [0.0, 0.7854, 1.28611, 2.57222, 0.0], // headingMagnetic = 0°, COG = 45°
        expected: [
          { path: 'environment.current.drift', value: 1.8952470907306618 },
          { path: 'environment.current.setTrue', value: 4.9973109200855905 },
          {
            path: 'environment.current.setMagnetic',
            value: 4.9973109200855905
          },
          { path: 'environment.current.driftImpact', value: 1.6628045678874737 }
        ]
      },
      {
        input: [
          0, // headingMagnetic (0° in radians)
          0, // courseOverGroundTrue (COG remains 0° if current aids perfectly)
          1.28611, // speedThroughWater (2.5 knots)
          2.57222, // speedOverGround (5 knots)
          0 // magneticVariation
        ],
        expected: [
          { path: 'environment.current.drift', value: 1.28611 },
          { path: 'environment.current.setTrue', value: 0 }, // pushing current
          { path: 'environment.current.setMagnetic', value: 0 },
          { path: 'environment.current.driftImpact', value: 1.28611 }
        ]
      },
      {
        input: [
          0, // headingMagnetic (0° in radians)
          0, // courseOverGroundTrue (still 0°, but zero progress)
          1.28611, // speedThroughWater (2.5 knots)
          0, // speedOverGround (cancelled by current)
          0 // magneticVariation
        ],
        expected: [
          { path: 'environment.current.drift', value: 1.28611 },
          { path: 'environment.current.setTrue', value: 3.141592653589793 }, // opposite current
          { path: 'environment.current.setMagnetic', value: 3.141592653589793 },
          { path: 'environment.current.driftImpact', value: -1.28611 }
        ]
      }
    ]
  }
}
