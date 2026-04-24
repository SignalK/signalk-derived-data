import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app): Calculation {
  return {
    group: 'depth',
    optionKey: 'belowKeel_2',
    title: 'Depth Below Keel (depth.transducerToKeel)',
    derivedFrom: ['environment.depth.belowTransducer'],
    calculator: function (depthBelowTransducer: unknown) {
      const depthTransducerToKeel =
        (app.getSelfPath('environment.depth.transducerToKeel.value') as
          | number
          | undefined) || 0

      // Need to check if number, because 0 is a valid value but also falsy
      if (
        typeof depthBelowTransducer !== 'number' ||
        typeof depthTransducerToKeel !== 'number'
      ) {
        return undefined
      }

      const value = depthBelowTransducer - depthTransducerToKeel

      if (isNaN(value)) {
        return undefined
      }

      return [{ path: 'environment.depth.belowKeel', value }]
    }
  }
}

module.exports = factory
