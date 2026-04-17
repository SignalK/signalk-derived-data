import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app): Calculation {
  return {
    group: 'depth',
    optionKey: 'belowSurface',
    title: 'Depth Below Surface (design.draft.maximum)',
    derivedFrom: ['environment.depth.belowKeel'],
    calculator: function (depthBelowKeel: number) {
      const draft = app.getSelfPath('design.draft.value.maximum') as number

      return [
        {
          path: 'environment.depth.belowSurface',
          value: depthBelowKeel + draft
        }
      ]
    }
  }
}

module.exports = factory
