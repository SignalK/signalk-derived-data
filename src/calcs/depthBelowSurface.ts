import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app): Calculation {
  // See depthBelowKeel.ts for why this is cached — draft.maximum is vessel
  // design data and static for the life of the plugin.
  let cachedDraft: number | undefined

  return {
    group: 'depth',
    optionKey: 'belowSurface',
    title: 'Depth Below Surface (design.draft.maximum)',
    derivedFrom: ['environment.depth.belowKeel'],
    calculator: function (depthBelowKeel: number) {
      if (cachedDraft === undefined) {
        cachedDraft = app.getSelfPath('design.draft.value.maximum') as
          | number
          | undefined
      }

      if (
        typeof depthBelowKeel !== 'number' ||
        typeof cachedDraft !== 'number'
      ) {
        return undefined
      }

      const value = depthBelowKeel + cachedDraft
      if (Number.isNaN(value)) {
        return undefined
      }

      return [
        {
          path: 'environment.depth.belowSurface',
          value
        }
      ]
    }
  }
}

module.exports = factory
