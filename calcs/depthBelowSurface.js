const _ = require('lodash')

module.exports = function (app) {
  var draft = app.getSelfPath('design.draft.maximum.value')

  var derivedFrom =
    typeof draft === 'undefined' ? [] : ['environment.depth.belowKeel']

  return {
    group: 'depth',
    optionKey: 'belowSurface',
    title:
      'Depth Below Surface (based on depth.belowKeel and design.draft.maximum)',
    derivedFrom: derivedFrom,
    calculator: function (depthBelowKeel) {
      return [
        {
          path: 'environment.depth.belowSurface',
          value: depthBelowKeel + draft
        }
      ]
    }
  }
}
