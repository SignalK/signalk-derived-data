const Spline = require('cubic-spline')
const _ = require('lodash')
const util = require('util') // dev

var instance

// tankInstances = ["tanks.fuel.*", "tanks.fuel.1", "tanks.water.0" ]
module.exports = function (app, plugin) {
  return plugin.tanks.map(instance => {
    return {
      group: 'tanks',
      optionKey: 'tankVolume_' + instance,
      title:
        "'tanks." +
        instance +
        "' Tank Volume and Capacity (requires calibration pairs (>2 for parallell sides, >3 for straight wedge and >4 for more complex shapes)",
      derivedFrom: function () {
        return ['tanks.' + instance + '.currentLevel']
      },
      properties: {
        volume_unit: {
          type: 'string',
          title: 'Input unit',
          enum: ['litres', 'gal', 'm3'],
          default: 'litres'
        },
        ['calibrations.' + instance]: {
          type: 'array',
          title: 'Calibration entries (pairs of level => volume)',
          items: {
            type: 'object',
            required: ['level', 'volume'],
            properties: {
              level: {
                type: 'number',
                title: 'level (ratio max 1)',
                description: ' '
              },
              volume: {
                type: 'number',
                title: 'corresponding volume (selected unit)',
                description: ' '
              }
            }
          }
        }
      },
      calculator: function (level) {
        var calLevels = []
        var calVolumes = []
        app.debug(plugin.properties.tanks.volume_unit)

        plugin.properties.tanks['calibrations.' + instance].forEach(function (
          i
        ) {
          calLevels.push(i.level)
          if (plugin.properties.tanks.volume_unit === 'litres') {
            calVolumes.push(i.volume * 0.001)
          } else if (plugin.properties.tanks.volume_unit === 'gal') {
            calVolumes.push(i.volume * 0.00378541)
          } else {
            calVolumes.push(i.volume)
          }
        })

        // cubic-spline 2.x dropped the `spline(x, xs, ys)` function form
        // in favour of a `new Spline(xs, ys).at(x)` constructor + method.
        // Build the interpolator once per calculation and reuse it for
        // both capacity (at level=1) and current volume (at the measured
        // level).
        const interpolator = new Spline(calLevels, calVolumes)

        return [
          {
            path: 'tanks.' + instance + '.capacity',
            value: interpolator.at(1)
          },
          {
            path: 'tanks.' + instance + '.currentVolume',
            value: interpolator.at(level)
          }
        ]
      }
    }
  })
}
