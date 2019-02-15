var spline = require("cubic-spline")
const _ = require("lodash")
const util = require('util') //dev
const debug = require('debug')('derived-tank')

var instance

//tankInstances = ["tanks.fuel.*", "tanks.fuel.1", "tanks.water.0" ]
module.exports = function(app, plugin) {
  var instances = []
  debug(_.keys(app.signalk.self.tanks))
  if ( _.get(app.signalk.self, "tanks") ){
    debug("tanks found")
    var tank_types = _.keys(app.signalk.self.tanks)
    tank_types.forEach(type => {
      debug(type)
      _.keys(app.signalk.self.tanks[type]).forEach(i => {
        debug(i)
        instances.push("tanks." + type + "." + i)
      })
    })
    return instances.map(instance => {
      return {
        group: 'tanks',
        optionKey: 'tankVolume_' + instance,
        title: "'" + instance + "' Tank Volume (based on currentLevel (requires calibration pairs (>2 for parallell sides, >3 for straight wedge and >4 for more complex shapes))",
        derivedFrom: function(){
          return [  instance + ".currentLevel" ]
        },
        properties: {
          volume_unit: {
            type: "string",
            title: "Input unit",
            enum: ["litres", "gal", "m3"],
            default: "litres"
          },
          ["calibrations."+instance]: {
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
                  "title": "corresponding volume (selected unit)",
                  "description": " "
                }
              }
            }
          }
        },
        calculator: function(level) {

          var calLevels = []
          var calVolumes = []
          debug(plugin.properties.tanks.volume_unit)

          plugin.properties.tanks["calibrations."+instance].forEach(function(i) {
            calLevels.push(i.level)
            if (plugin.properties.tanks.volume_unit === "litres"){
              calVolumes.push(i.volume*0.001)
            } else if (plugin.properties.tanks.volume_unit === "gal") {
              calVolumes.push(i.volume*0.00378541)
            } else {
              calVolumes.push(i.volume)
            }
          })

          return [{ path: instance + '.currentVolume', value: spline(level, calLevels, calVolumes)}]
        }
      }
    })
  } else {
    return {
      group: 'tanks',
      optionKey: 'tankVolume_',
      title: "Tank Volume (based on currentLevel (no tank levels found))",
    }
  }
}
