const _ = require('lodash')

module.exports = function (app) {
  let depthTransducerToKeel = app.getSelfPath('environment.depth.transducerToKeel.value') || 0

  return {
    group: 'depth',
    optionKey: 'belowKeel_2',
    title: 'Depth Below Keel (based on depth.belowTransducer and depth.transducerToKeel)',
    derivedFrom: ['environment.depth.belowTransducer', 'environment.depth.transducerToKeel'],
    calculator: function (depthBelowTransducer, transducerToKeel) {
      if (typeof transducerToKeel === 'number') {
        depthTransducerToKeel = transducerToKeel
      } else {
        depthTransducerToKeel = app.getSelfPath('environment.depth.transducerToKeel.value') || 0
      }

      // Need to check if number, because 0 is a valid value but also falsy
      if (typeof depthBelowTransducer !== 'number' || typeof depthTransducerToKeel !== 'number') {
        return undefined
      }

      const value = depthBelowTransducer + depthTransducerToKeel

      if (isNaN(value)) {
        return undefined
      }

      return [
        {
          path: 'environment.depth.belowKeel',
          value,
        },
      ]
    },
  }
}
