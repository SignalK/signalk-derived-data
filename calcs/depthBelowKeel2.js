const _ = require('lodash')

module.exports = function (app) {
  return {
    group: 'depth',
    optionKey: 'belowKeel_2',
    title: 'Depth Below Keel (based on depth.belowTransducer and depth.transducerToKeel)',
    derivedFrom: ['environment.depth.belowTransducer', 'environment.depth.transducerToKeel'],
    calculator: function (depthBelowTransducer, depthTransducerToKeel) {
      if (!depthBelowTransducer || !depthTransducerToKeel) {
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
