const _ = require('lodash')

selfData = {}

module.exports = function (app, plugin) {
  return plugin.air.map(instance => {
    return {
      group: 'air',
      optionKey: instance + 'dewPoint',
      title: instance + 'Air dewpoint temperature',
      derivedFrom: function () {
        return [
          'environment.' + instance + '.temperature',
          'environment.' + instance + '.humidity'
        ]
      },
      calculator: function (temp, hum) {
        let dewPoint = null
        if (_.isFinite(temp) && _.isFinite(hum)) {
          // Magnus formula:
          const tempC = temp - 273.15
          const b = 17.625
          const c = 243.04
          const magnus = Math.log(hum) + b * tempC / (c + tempC)
          dewPoint = c * magnus / (b - magnus) + 273.15
        }
        return [
          {
            path: 'environment.' + instance + '.dewPointTemperature',
            value: dewPoint
          }
        ]
      },
      tests: [
        {
          input: [null, 0.6],
          selfData,
          expected: [
            {
              path: 'environment.outside.dewPointTemperature',
              value: null
            }
          ]
        },
        {
          input: [298.15, 0.6],
          selfData,
          expected: [
            {
              path: 'environment.outside.dewPointTemperature',
              value: 289.8476635212129
            }
          ]
        }
      ]
    }
  })
}
