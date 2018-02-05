const _ = require('lodash')

module.exports = function(app, plugin) {
  var batteries

  if ( app.getSelfPath("electrical.batteries") )
  {
    batteries = _.keys(app.signalk.self.electrical.batteries)
    app.debug("batteries: " + JSON.stringify(batteries))
    app.debug("instances: " + _.keys(app.signalk.self.electrical.batteries))
    
    return batteries.map(instance => {
      return {
        group: 'electrical',
        optionKey: 'batterPower' + instance,
        title: "Battery " + instance + " Power ",
        derivedFrom: function(){ return [ "electrical.batteries." + instance + ".voltage",  "electrical.batteries." + instance + ".current" ] },
        calculator: function(v, a) {
          return [{ path: "electrical.batteries." + instance + ".power", value: v*a }]
        }
      }
    });
  } else {
    return undefined
  }
}
