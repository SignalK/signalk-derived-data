const _ = require('lodash')

module.exports = function(app) {
  return {
    optionKey: 'belowKeel_2',
    title: "Depth Below Keel (based on depth.belowTransducer and depth.transducerToKeel)",
    derivedFrom: [ "environment.depth.belowTransducer"],

    calculator: function(depthBelowTransducer){
      var depthTransducerToKeel = _.get(app.signalk.self, 'environment.depth.transducerToKeel.value')
      if ( typeof depthTransducerToKeel !== 'undefined') {
        return [{ path: 'environment.depth.belowKeel', value: depthBelowTransducer + depthTransducerToKeel}]
      } else {
        return undefined
      }
    }
  };
}
