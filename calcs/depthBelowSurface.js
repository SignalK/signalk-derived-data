const _ = require('lodash')

module.exports = function (app) {
  return {
    group: 'depth',
    optionKey: 'belowSurface',
    title: 'Depth Below Surface (design.draft.maximum)',
    derivedFrom: ['environment.depth.belowKeel'],
    calculator: function (depthBelowKeel) {
      var draft = app.getSelfPath('design.draft.value.maximum')

      if (typeof depthBelowKeel !== 'number' || typeof draft !== 'number') {
        return undefined
      }

      const value = depthBelowKeel + draft
      if (isNaN(value)) {
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
