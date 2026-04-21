import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app): Calculation {
  return {
    group: 'depth',
    optionKey: 'belowKeel',
    title: 'Depth Below Keel (design.draft.maximum)',
    derivedFrom: ['environment.depth.belowSurface'],
    calculator: function (depthBelowSurface: number) {
      const draft = app.getSelfPath('design.draft.value.maximum') as
        | number
        | undefined

      if (typeof depthBelowSurface !== 'number' || typeof draft !== 'number') {
        return undefined
      }

      const value = depthBelowSurface - draft
      if (Number.isNaN(value)) {
        return undefined
      }

      return [
        {
          path: 'environment.depth.belowKeel',
          value
        }
      ]
    }
  }
}

module.exports = factory
