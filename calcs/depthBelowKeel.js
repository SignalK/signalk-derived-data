const _ = require('lodash')

module.exports = function(app) {
  return {
    optionKey: 'belowKeel',
    title: "Depth Below Keel (based on depth.belowSurface and design.draft.maximum)",
    derivedFrom: [ "environment.depth.belowSurface" ],
    calculator: function(depthBelowSurface)
    {
      var draft = _.get(app.signalk.self, 'design.draft.maximum.value')
      if ( typeof draft !== 'undefined' ) {
        return [{ path: 'environment.depth.belowKeel', value: depthBelowSurface - draft}]
      } else {
        return undefined
      }
    }
  };
}
