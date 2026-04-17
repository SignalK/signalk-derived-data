import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app): Calculation {
  return {
    group: 'depth',
    optionKey: 'transducerToKeel',
    title: 'Transducer to keel (design.draft.maximum),',
    derivedFrom: ['environment.depth.surfaceToTransducer'],
    calculator: function (surfaceToTransducer: unknown) {
      const draft = app.getSelfPath('design.draft.value.maximum') as
        | number
        | undefined

      if (
        typeof surfaceToTransducer !== 'number' ||
        typeof draft !== 'number'
      ) {
        return undefined
      }

      const transducerToKeel = surfaceToTransducer - draft

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
