import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app, _plugin): Calculation {
  return {
    group: 'heading',
    optionKey: 'cog_true',
    title: 'True Course Over Ground',
    derivedFrom: [
      'navigation.courseOverGroundMagnetic',
      'navigation.magneticVariation'
    ],
    defaults: [undefined, 9999],
    debounceDelay: 200,
    calculator: function (
      courseOverGroundMagnetic: number | null | undefined,
      magneticVariation: number | null | undefined
    ) {
      // See courseOverGroundMagnetic.ts — 9999 is the `toProperty` sentinel
      // that fires before any real magneticVariation has arrived; null
      // or undefined mean the source pushed an absent value.
      if (magneticVariation === 9999 || magneticVariation == null) {
        return
      }
      if (courseOverGroundMagnetic == null) {
        return [{ path: 'navigation.courseOverGroundTrue', value: null }]
      }
      let courseOverGroundTrue = courseOverGroundMagnetic + magneticVariation
      if (courseOverGroundTrue < 0) {
        courseOverGroundTrue = Math.PI * 2 + courseOverGroundTrue
      } else if (courseOverGroundTrue > Math.PI * 2) {
        courseOverGroundTrue = courseOverGroundTrue - Math.PI * 2
      }
      return [
        { path: 'navigation.courseOverGroundTrue', value: courseOverGroundTrue }
      ]
    },
    tests: [
      {
        input: [null, 0.01],
        expected: [{ path: 'navigation.courseOverGroundTrue', value: null }]
      },
      {
        input: [0.2, null]
      }
    ]
  }
}

module.exports = factory
