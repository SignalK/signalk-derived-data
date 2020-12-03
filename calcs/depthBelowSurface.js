const _ = require('lodash')

module.exports = function (app) {
  return {
    group: 'depth',
    optionKey: 'belowSurface',
    title:
      'Depth Below Surface (based on depth.belowKeel and design.draft.maximum)',
    derivedFrom: ['environment.depth.belowKeel'],
    calculator: function (depthBelowKeel) {
      var draft = (draft = app.getSelfPath('design.draft.value.maximum'))

      return [
        {
          path: 'environment.depth.belowSurface',
          value: depthBelowKeel + draft
        }
      ]
    }
  }
}
