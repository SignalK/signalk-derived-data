import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app, _plugin): Calculation {
  return {
    group: 'course data',
    optionKey: 'cog_magnetic',
    title: 'Magnetic Course Over Ground',
    derivedFrom: [
      'navigation.courseOverGroundTrue',
      'navigation.magneticVariation'
    ],
    defaults: [undefined, 9999],
    debounceDelay: 200,
    calculator: function (
      courseOverGroundTrue: number | null | undefined,
      magneticVariation: number | null | undefined
    ) {
      // `magneticVariation` arrives as a stream value (see `derivedFrom`).
      // The 9999 sentinel is the `toProperty` default that fires when no
      // real variation has emitted yet; null/undefined mean the source
      // pushed an absent value. In either case we can't convert.
      if (magneticVariation === 9999 || magneticVariation == null) {
        return
      }
      if (courseOverGroundTrue == null) {
        return [{ path: 'navigation.courseOverGroundMagnetic', value: null }]
      }
      let courseOverGroundMagnetic = courseOverGroundTrue - magneticVariation
      if (courseOverGroundMagnetic < 0) {
        courseOverGroundMagnetic = Math.PI * 2 + courseOverGroundMagnetic
      } else if (courseOverGroundMagnetic > Math.PI * 2) {
        courseOverGroundMagnetic = courseOverGroundMagnetic - Math.PI * 2
      }
      return [
        {
          path: 'navigation.courseOverGroundMagnetic',
          value: courseOverGroundMagnetic
        }
      ]
    },
    tests: [
      {
        input: [1.0, 0.1],
        expected: [{ path: 'navigation.courseOverGroundMagnetic', value: 0.9 }]
      },
      {
        input: [null, -0.01],
        expected: [{ path: 'navigation.courseOverGroundMagnetic', value: null }]
      },
      {
        input: [0.2, null]
      }
    ]
  }
}

module.exports = factory
