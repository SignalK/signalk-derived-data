const _ = require('lodash')

module.exports = function(app, plugin) {
  return plugin.batteries.map(instance => {
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
}
