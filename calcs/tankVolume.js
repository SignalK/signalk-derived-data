const Spline = require('cubic-spline')

// Volume units as configured in the plugin schema -> factor to convert to
// cubic metres (the SignalK canonical unit).
const VOLUME_UNIT_FACTORS = {
  litres: 0.001,
  gal: 0.00378541,
  m3: 1
}

// tankInstances = ["tanks.fuel.*", "tanks.fuel.1", "tanks.water.0" ]
module.exports = function (app, plugin) {
  return plugin.tanks.map((instance) => {
    // Output paths and derivedFrom list are constant per instance.
    const capacityPath = 'tanks.' + instance + '.capacity'
    const volumePath = 'tanks.' + instance + '.currentVolume'
    const derivedFromList = ['tanks.' + instance + '.currentLevel']
    const calibrationKey = 'calibrations.' + instance

    // Lazily built on the first calculator call — plugin.properties is only
    // populated by plugin.start(), which runs after the factory. Once built,
    // the spline and the derived capacity are reused for every tick until
    // the plugin restarts (calibrations are static config, applied on
    // restart).
    let interpolator = null
    let capacity = null

    return {
      group: 'tanks',
      optionKey: 'tankVolume_' + instance,
      title:
        "'tanks." +
        instance +
        "' Tank Volume and Capacity (requires calibration pairs (>2 for parallell sides, >3 for straight wedge and >4 for more complex shapes)",
      derivedFrom: function () {
        return derivedFromList
      },
      properties: {
        volume_unit: {
          type: 'string',
          title: 'Input unit',
          enum: ['litres', 'gal', 'm3'],
          default: 'litres'
        },
        [calibrationKey]: {
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
        if (interpolator === null) {
          const cal = plugin.properties.tanks[calibrationKey]
          const unit = plugin.properties.tanks.volume_unit
          // Unknown unit falls back to 1 (m^3) — matches the pre-refactor
          // else branch.
          const factor =
            unit in VOLUME_UNIT_FACTORS ? VOLUME_UNIT_FACTORS[unit] : 1
          const calLevels = new Array(cal.length)
          const calVolumes = new Array(cal.length)
          for (let i = 0; i < cal.length; i++) {
            calLevels[i] = cal[i].level
            calVolumes[i] = cal[i].volume * factor
          }
          app.debug(unit)
          // cubic-spline 2.x dropped the `spline(x, xs, ys)` function form
          // in favour of `new Spline(xs, ys).at(x)`. The interpolator and
          // its derived capacity are constant for the life of the plugin.
          interpolator = new Spline(calLevels, calVolumes)
          capacity = interpolator.at(1)
        }

        return [
          {
            path: capacityPath,
            value: capacity
          },
          {
            path: volumePath,
            value: interpolator.at(level)
          }
        ]
      }
    }
  })
}
