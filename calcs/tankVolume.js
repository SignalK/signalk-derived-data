var spline = require("cubic-spline")
const _ = require("lodash")
const util = require('util') //dev
const debug = require('debug')('derived-tank')




//tankInstances = ["tanks.fuel.*", "tanks.fuel.1", "tanks.water.0" ]
module.exports = function(app, plugin) {
  return {
    group: 'tanks',
    optionKey: 'tankVolume',
    title: "[tank instance].currentVolume (based on currentLevel (requires calibration pairs (>2 for parallell sides, >3 for straight wedge and >4 for more complex shapes))",
    derivedFrom: function(){
      return [  plugin.properties.tanks.tank_instance + ".currentLevel" ] },
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
    calculator: function(level) {
      var inst = plugin.properties.tanks.tank_instance
      var calLevels = []
      calVolumes = []

      plugin.properties.tanks.calibrations.forEach(function(i) {
        calLevels.push(i.level)
        calVolumes.push(i.volume)
      });

      return [{ path: inst + '.currentVolume', value: spline(level, calLevels, calVolumes)}]
    }
  }
}
