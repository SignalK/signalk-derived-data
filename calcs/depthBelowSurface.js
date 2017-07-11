const _ = require('lodash')

module.exports = function(app) {
  return {
    optionKey: 'belowSurface',
    title: "Depth Below Surface (based on depth.belowKeel and design.draft.maximum)",
    derivedFrom: [ "environment.depth.belowKeel" ],
    calculator: function(depthBelowKeel)
    {
      var draft = _.get(app.signalk.self, 'design.draft.maximum.value')
      if ( typeof draft !== 'undefined' ) {
        return [{ path: 'environment.depth.belowSurface', value: depthBelowKeel + draft}]
      } else {
        return undefined
      }
    }
  };
}
