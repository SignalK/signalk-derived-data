const _ = require('lodash')

module.exports = function(app) {
  var depthTransducerToKeel = _.get(app.signalk.self, 'environment.depth.transducerToKeel.value')

  var derivedFrom = typeof depthTransducerToKeel === 'undefined' ? [] : [ "environment.depth.belowTransducer"];

  return {
    optionKey: 'belowKeel_2',
    title: "Depth Below Keel (based on depth.belowTransducer and depth.transducerToKeel)",
    derivedFrom: derivedFrom,
    calculator: function(depthBelowTransducer){
      return [{ path: 'environment.depth.belowKeel', value: depthBelowTransducer + depthTransducerToKeel}]
    }
  };
}
