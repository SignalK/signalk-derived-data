const suncalc = require('suncalc')
const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'sun',
    optionKey: 'Sun Time',
    title: 'Sets environment.sunlight.times.* to sunrise, sunset, etc',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: ['', undefined],
    properties: {
      forecastDays: {
        type: 'number',
        title: 'Number of days to forecast (0-10)',
        default: 1,
        enum: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      }
    },
    debounceDelay: 60 * 1000,
    calculator: function (datetime, position) {
      var date

      if (datetime && datetime.length > 0) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }

      app.debug(`Using datetime: ${date} position: ${JSON.stringify(position)}`)

      var results = []
      const forecastDays = plugin.properties.sun.forecastDays || 1

      for (let day = 0; day <= forecastDays; day++) {
        const targetDate = new Date(date)
        targetDate.setDate(targetDate.getDate() + day)
        const times = suncalc.getTimes(
          targetDate,
          position.latitude,
          position.longitude
        )

        const prefix =
          day === 0
            ? 'environment.sunlight.times'
            : `environment.sunlight.times.${day}`

        results.push(
          { path: `${prefix}.sunrise`, value: times.sunrise },
          { path: `${prefix}.sunriseEnd`, value: times.sunriseEnd },
          { path: `${prefix}.goldenHourEnd`, value: times.goldenHourEnd },
          { path: `${prefix}.solarNoon`, value: times.solarNoon },
          { path: `${prefix}.goldenHour`, value: times.goldenHour },
          { path: `${prefix}.sunsetStart`, value: times.sunsetStart },
          { path: `${prefix}.sunset`, value: times.sunset },
          { path: `${prefix}.dusk`, value: times.dusk },
          { path: `${prefix}.nauticalDusk`, value: times.nauticalDusk },
          { path: `${prefix}.night`, value: times.night },
          { path: `${prefix}.nadir`, value: times.nadir },
          { path: `${prefix}.nightEnd`, value: times.nightEnd },
          { path: `${prefix}.nauticalDawn`, value: times.nauticalDawn },
          { path: `${prefix}.dawn`, value: times.dawn }
        )
      }

      return results
    }
  }
}
