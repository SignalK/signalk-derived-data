import type { Calculation, CalculationFactory } from '../types'

const DEFAULT_MAGNETIC_VARIATION = 9999

/**
 * Normalize an angle to the range [0, 2π)
 */
function normalizeAngle(angle: number | null | undefined): number | null {
  if (angle == null) return null
  angle = angle % (2 * Math.PI)
  return angle < 0 ? angle + 2 * Math.PI : angle
}

const factory: CalculationFactory = function (_app, _plugin): Calculation {
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
    debounceDelay: 200,

    /**
     * Calculates set and drift vector from motion data
     */
    calculator(
      headingMagnetic: number,
      courseOverGroundTrue: number,
      speedThroughWater: number,
      speedOverGround: number,
      magneticVariation: number | null | undefined
    ) {
      // `magneticVariation` arrives as a stream value (see `derivedFrom`).
      // The sentinel default fires before any real variation has emitted,
      // in which case we continue without setTrue instead of falling back
      // to a per-tick app.getSelfPath tree walk.
      if (magneticVariation === DEFAULT_MAGNETIC_VARIATION) {
        magneticVariation = null
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

      // The heading input is magnetic but COG is true. Convert heading
      // to true before the vector math so all decompositions share a
      // frame; without magneticVariation we cannot make that conversion
      // and therefore cannot compute drift correctly.
      if (magneticVariation == null) {
        return [
          { path: 'environment.current.drift', value: null },
          { path: 'environment.current.setTrue', value: null },
          { path: 'environment.current.setMagnetic', value: null },
          { path: 'environment.current.driftImpact', value: null }
        ]
      }

      const headingTrue = headingMagnetic + magneticVariation
      const delta = courseOverGroundTrue - headingTrue
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

      // Set direction in the true frame. The atan2 returns the current
      // direction relative to heading; shift by π (the "set" convention
      // names the direction the current comes FROM) and by headingTrue
      // (to translate heading-relative into the north-referenced true
      // frame).
      const setTrue = normalizeAngle(
        Math.atan2(
          speedOverGround * sinDelta,
          speedThroughWater - speedOverGround * cosDelta
        ) +
          Math.PI +
          headingTrue
      )
      const setMagnetic = normalizeAngle((setTrue ?? 0) - magneticVariation)

      // Drift vector components — both in the true frame.
      const cogX = speedOverGround * Math.cos(courseOverGroundTrue)
      const cogY = speedOverGround * Math.sin(courseOverGroundTrue)
      const swX = speedThroughWater * Math.cos(headingTrue)
      const swY = speedThroughWater * Math.sin(headingTrue)

      const driftX = cogX - swX
      const driftY = cogY - swY

      // Drift impact (projection of drift onto motion vector)
      let driftImpact: number
      if (speedOverGround === 0) {
        driftImpact = -speedThroughWater
      } else {
        driftImpact = (cogX * driftX + cogY * driftY) / speedOverGround
      }

      return [
        { path: 'environment.current.drift', value: drift },
        { path: 'environment.current.setTrue', value: setTrue },
        { path: 'environment.current.setMagnetic', value: setMagnetic },
        { path: 'environment.current.driftImpact', value: driftImpact }
      ]
    },

    tests: [
      {
        // No magneticVariation — drift cannot be resolved to the true
        // frame, so every output is null.
        input: [0.1, 0.2, 5, 4.5, null],
        expected: [
          { path: 'environment.current.drift', value: null },
          { path: 'environment.current.setTrue', value: null },
          { path: 'environment.current.setMagnetic', value: null },
          { path: 'environment.current.driftImpact', value: null }
        ]
      },
      {
        input: [0.5, 0.7, 6, 5.5, 0.1],
        expected: [
          { path: 'environment.current.drift', value: 0.761396803020796 },
          { path: 'environment.current.setTrue', value: 4.547058237706402 },
          {
            path: 'environment.current.setMagnetic',
            value: 4.447058237706402
          },
          {
            path: 'environment.current.driftImpact',
            value: -0.470024991668155
          } // negative drift
        ]
      },
      {
        input: [0.2, 0.2, 4, 5, 0.05],
        expected: [
          { path: 'environment.current.drift', value: 1.024689994194024 },
          {
            path: 'environment.current.setTrue',
            value: 0.49635906935637264
          },
          {
            path: 'environment.current.setMagnetic',
            value: 0.44635906935637265
          },
          { path: 'environment.current.driftImpact', value: 1.0049989584201349 } // positive drift
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

module.exports = factory

// Exposed for unit testing. The null/undefined guard inside
// normalizeAngle is defensive — it is never reached by the calculator
// above because the inputs are always finite (cos/sin/atan2 outputs or
// the `magneticVariation != null` branch already guarded upstream).
// Exporting lets a test hit the guard directly without contorting the
// calculator inputs.
module.exports.normalizeAngle = normalizeAngle
