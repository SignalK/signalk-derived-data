var spline = require("cubic-spline")
const _ = require("lodash")
const debug = require('debug')('signalk-derived-data')

module.exports = function(app, plugin) {
  var tankInstances

  if ( _.get(app.signalk.self, "tanks") )
  {
    tankInstances = _.keys(app.signalk.self['tanks'])

    return tankInstances.map(instance => {
      return {
        group: 'tanks',
        optionKey: 'tankVolume' + instance,
        title: "tanks." + instance + ".currentVolume (based on currentLevel (requires calibration points (>2 for parallell sides, >3 for straight wedge and >4 for more complex shapes))",
        derivedFrom: function() { return [ "tanks." + instance + ".currentLevel"] },
        properties:{
          tank_instance: {
            type: "string",
            title: "Propulsion Instance (one at a time currently)",
            "enum": [0,1,2]//enumm
          }, 
          calibration:{
            type: "object"
            // MISSING PIECE
          }
        }
        calculator: function(level) { // and arrays of volumes and levels
          return [{ path: 'tanks.' + instance + '.currentVolume', value: spline(level, levelArray, volumeArray)}]
        }
      }
    });
  } else {
    return {
      optionKey: 'tankVolume',
      title: "tanks.*.*.currentVolume (based on tanks.*.*.currentLevel)"
    }
  }
}
