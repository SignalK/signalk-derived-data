import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, _plugin): Calculation {
  return {
    group: 'heading',
    optionKey: 'heading',
    title: 'True Heading',
    derivedFrom: ['navigation.headingMagnetic', 'navigation.magneticVariation'],
    defaults: [undefined, 9999],
    debounceDelay: 200,
    calculator: function (
      heading: number | null | undefined,
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
      if (heading == null) {
        return [{ path: 'navigation.headingTrue', value: null }]
      }
      let headingTrue = heading + magneticVariation
      if (headingTrue < 0) {
        headingTrue = Math.PI * 2 + headingTrue
      } else if (headingTrue > Math.PI * 2) {
        headingTrue = headingTrue - Math.PI * 2
      }
      return [{ path: 'navigation.headingTrue', value: headingTrue }]
    },
    tests: [
      {
        input: [null, 0.01],
        expected: [{ path: 'navigation.headingTrue', value: null }]
      },
      {
        input: [0.2, null]
      }
    ]
  }
}

module.exports = factory
