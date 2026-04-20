import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app): Calculation {
  // design.draft.value.maximum is vessel design config — populated once by
  // the SignalK server (or the user) and unchanged for the life of the
  // plugin. Cache the first non-undefined read so the per-tick code no
  // longer walks the state tree on every depth update.
  let cachedDraft: number | undefined

  return {
    group: 'depth',
    optionKey: 'belowKeel',
    title: 'Depth Below Keel (design.draft.maximum)',
    derivedFrom: ['environment.depth.belowSurface'],
    calculator: function (depthBelowSurface: number) {
      if (cachedDraft === undefined) {
        cachedDraft = app.getSelfPath('design.draft.value.maximum') as
          | number
          | undefined
      }

      if (
        typeof depthBelowSurface !== 'number' ||
        typeof cachedDraft !== 'number'
      ) {
        return undefined
      }

      const value = depthBelowSurface - cachedDraft
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
