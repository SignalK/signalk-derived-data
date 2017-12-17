const _ = require('lodash')

module.exports = function(app) {
  var draft = _.get(app.signalk.self, 'design.draft.maximum.value')

  if ( ! draft ) {
    draft = _.get(app.signalk.self, 'design.draft.value.maximum')
  }

  var derivedFrom = typeof draft === 'undefined' ? [] : [ "environment.depth.belowSurface" ];
    
  return {
    group: "depth",
    optionKey: 'belowKeel',
    title: "Depth Below Keel (based on depth.belowSurface and design.draft.maximum)",
    derivedFrom: derivedFrom,
    calculator: function(depthBelowSurface)
    {
      return [{ path: 'environment.depth.belowKeel', value: depthBelowSurface - draft}]
    }
  };
}
