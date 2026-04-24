import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app): Calculation {
  // See depthBelowKeel.ts for why this is cached — draft.maximum is vessel
  // design data and static for the life of the plugin.
  let cachedDraft: number | undefined

  return {
    group: 'depth',
    optionKey: 'transducerToKeel',
    title: 'Transducer to keel (design.draft.maximum),',
    derivedFrom: ['environment.depth.surfaceToTransducer'],
    calculator: function (surfaceToTransducer: unknown) {
      if (cachedDraft === undefined) {
        cachedDraft = app.getSelfPath('design.draft.value.maximum') as
          | number
          | undefined
      }

      if (
        typeof surfaceToTransducer !== 'number' ||
        typeof cachedDraft !== 'number'
      ) {
        return undefined
      }

      const transducerToKeel = cachedDraft - surfaceToTransducer

      if (isNaN(transducerToKeel)) {
        return undefined
      }

      return [
        {
          path: 'environment.depth.transducerToKeel',
          value: transducerToKeel
        }
      ]
    }
  }
}

module.exports = factory
