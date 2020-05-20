const _ = require('lodash')

module.exports = function (app) {
  return {
    group: 'depth',
    optionKey: 'belowKeel_2',
    title:
      'Depth Below Keel (based on depth.belowTransducer and depth.transducerToKeel)',
    derivedFrom: ['environment.depth.belowTransducer'],
    calculator: function (depthBelowTransducer) {
      const depthTransducerToKeel =
        app.getSelfPath('environment.depth.transducerToKeel.value') || 0

      // Need to check if number, because 0 is a valid value but also falsy
      if (
        typeof depthBelowTransducer !== 'number' ||
        typeof depthTransducerToKeel !== 'number'
      ) {
        return undefined
      }

      const value = depthBelowTransducer + depthTransducerToKeel

      if (isNaN(value)) {
        return undefined
      }

      return [{ path: 'environment.depth.belowKeel', value }]
    }
  }
}
