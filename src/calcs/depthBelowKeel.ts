import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app): Calculation {
  return {
    group: 'depth',
    optionKey: 'belowKeel',
    title: 'Depth Below Keel (design.draft.maximum)',
    derivedFrom: ['environment.depth.belowSurface'],
    calculator: function (depthBelowSurface: number) {
      const draft = app.getSelfPath('design.draft.value.maximum') as number

      return [
        {
          path: 'environment.depth.belowKeel',
          value: depthBelowSurface - draft
        }
      ]
    }
  }
}

module.exports = factory
