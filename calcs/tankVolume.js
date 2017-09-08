var spline = require("cubic-spline")
const _ = require("lodash")
const util = require('util') //dev
const debug = require('debug')('derived-tank')




//tankInstances = ["tanks.fuel.*", "tanks.fuel.1", "tanks.water.0" ]
module.exports = function(app, plugin) {
  return {
    group: 'tanks',
    optionKey: 'tankVolume',
    title: ".currentVolume (based on currentLevel (requires calibration points (>2 for parallell sides, >3 for straight wedge and >4 for more complex shapes))",
    derivedFrom: function(){ return [  plugin.properties.tank_instance + ".currentLevel" ] },
    properties: {
      tank_instance: {
        type: "string",
        title: "Tank Instance",
        default: "tanks.fuel.0",
      },

      calibrations: {
        "type": "array",
        "title": "Calibration entries (pairs of level => volume)",
        "items": {
          "type": "object",
          "required": [
            "level",
            "volume"
          ],
          "properties": {
            "level": {
              "type": "number",
              "title": "level (ratio max 1)",
              "description": " "
            },
            "volume": {
              "type": "number",
              "title": "corresponding volume (m^3)",
              "description": " "
            }
          }
        }
      }
    },
    calculator: function(level) { // and arrays of volumes and levels
      var inst = plugin.properties.tank_instance
      return [{ path: inst + '.currentVolume', value: spline(level, [0,2,4], [0,1,2])}]//..calibrations.level, ..calibrations.volume)}]
    }
  }
}
