const _ = require('lodash')

module.exports = function (app) {
  return {
    group: 'depth',
    optionKey: 'belowKeel',
    title: 'Depth Below Keel (design.draft.maximum)',
    derivedFrom: ['environment.depth.belowSurface'],
    calculator: function (depthBelowSurface) {
      var draft = app.getSelfPath('design.draft.value.maximum')

      if (typeof depthBelowSurface !== 'number' || typeof draft !== 'number') {
        return undefined
      }

      const value = depthBelowSurface - draft
      if (isNaN(value)) {
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
