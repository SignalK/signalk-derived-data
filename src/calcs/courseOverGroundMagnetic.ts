import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, _plugin): Calculation {
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
      if (magneticVariation === 9999) {
        magneticVariation = app.getSelfPath(
          'navigation.magneticVariation.value'
        ) as number | null | undefined
      }
      if (magneticVariation == null) {
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
