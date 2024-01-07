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
        // Magnus formula:
        var tempC = temp - 273.16
        const b = 18.678
        const c = 257.14
        var magnus = Math.log(hum) + b * tempC / (c + tempC)
        var dewPoint = c * magnus / (b - magnus) + 273.16
        return [
          {
            path: 'environment.' + instance + '.dewPointTemperature',
            value: dewPoint
          }
        ]
      }
    }
  })
}
