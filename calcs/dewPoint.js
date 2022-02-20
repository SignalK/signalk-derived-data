module.exports = function (app, plugin) {
  return plugin.air.map(instance => {
    return {
      group: 'air',
      optionKey: instance + 'dewPoint',
      title:
        instance +
        ' air dew point temperature (based on environment.' +
        instance +
        '.relativeHumidity and environment.' +
        instance +
        '.temperature)',
      derivedFrom: function () {
        return [
          'environment.' + instance + '.temperature',
          'environment.' + instance + '.relativeHumidity'
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
