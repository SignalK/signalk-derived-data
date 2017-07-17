const _ = require('lodash')
const debug = require('debug')('signalk-derived-data')

module.exports = function(app, plugin) {
  var batteries

  if ( _.get(app.signalk.self, "electrical.batteries") )
  {
    batteries = _.keys(app.signalk.self.electrical.batteries)
    debug("batteries: " + JSON.stringify(batteries))
    debug("instances: " + _.keys(app.signalk.self.electrical.batteries))
    
    return batteries.map(instance => {
      return {
        optionKey: 'batterPower' + instance,
        title: "Battery " + instance + " Power ",
        derivedFrom: function(){ return [ "electrical.batteries." + instance + ".voltage"]}, // "electrical.batteries." + instance + ".current" ] },
        calculator: function(v, a) {
          return [{ path: "electrical.batteries." + instance + ".power", value: v*10 }]
        }
      }
    });
  } else {
    return undefined
  }
}
