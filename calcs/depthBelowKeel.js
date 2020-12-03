const _ = require('lodash')

module.exports = function (app) {
  return {
    group: 'depth',
    optionKey: 'belowKeel',
    title:
      'Depth Below Keel (based on depth.belowSurface and design.draft.maximum)',
    derivedFrom: ['environment.depth.belowSurface'],
    calculator: function (depthBelowSurface) {
      var draft = app.getSelfPath('design.draft.value.maximum')

      return [
        {
          path: 'environment.depth.belowKeel',
          value: depthBelowSurface - draft
        }
      ]
    }
  }
}
