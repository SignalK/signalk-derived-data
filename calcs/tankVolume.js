var spline = require("cubic-spline")
const _ = require("lodash")
const util = require('util') //dev
const debug = require('debug')('derived-tank')




//tankInstances = ["tanks.fuel.*", "tanks.fuel.1", "tanks.water.0" ]
module.exports = function(app, plugin) {
  return {
    group: 'tanks',
    optionKey: 'tankVolume',
    title: "Tank Volume (based on currentLevel (requires calibration pairs (>2 for parallell sides, >3 for straight wedge and >4 for more complex shapes))",
    derivedFrom: function(){
      return [  plugin.properties.tanks.tank_instance + ".currentLevel" ] },
    properties: function() {
      var tank_types = _.keys(app.signalk.self.tanks)
      var instances = []
      tank_types.forEach(type => {
        _.keys(app.signalk.self.tanks[type]).forEach(i => {
          instances.push("tanks." + type + "." + i)
        })
      })

      instance_prop = {
        type: "string",
        title: "Tank Instance",
      }

      if ( instances.length > 0 )
        instance_prop.enum = instances
      
      return {
        tank_instance: instance_prop,
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
