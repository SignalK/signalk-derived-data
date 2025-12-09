const suncalc = require('suncalc')
const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'sun',
    optionKey: 'Sun Time',
    title: 'Sets environment.sunlight.times.* to sunrise, sunset, etc',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: ['', undefined],
    debounceDelay: 60 * 1000,
    calculator: function (datetime, position) {
      var value
      var mode
      var date

      if (datetime && datetime.length > 0) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }

      app.debug(`Using datetime: ${date} position: ${JSON.stringify(position)}`)

      var times = suncalc.getTimes(date, position.latitude, position.longitude)

      const tomorrow = new Date(date)
      tomorrow.setDate(tomorrow.getDate() + 1)
      var tomorrowTimes = suncalc.getTimes(tomorrow, position.latitude, position.longitude)

      return [
        { path: 'environment.sunlight.times.sunrise', value: times.sunrise },
        {
          path: 'environment.sunlight.times.sunriseEnd',
          value: times.sunriseEnd
        },
        {
          path: 'environment.sunlight.times.goldenHourEnd',
          value: times.goldenHourEnd
        },
        {
          path: 'environment.sunlight.times.solarNoon',
          value: times.solarNoon
        },
        {
          path: 'environment.sunlight.times.goldenHour',
          value: times.goldenHour
        },
        {
          path: 'environment.sunlight.times.sunsetStart',
          value: times.sunsetStart
        },
        { path: 'environment.sunlight.times.sunset', value: times.sunset },
        { path: 'environment.sunlight.times.dusk', value: times.dusk },
        {
          path: 'environment.sunlight.times.nauticalDusk',
          value: times.nauticalDusk
        },
        { path: 'environment.sunlight.times.night', value: times.night },
        { path: 'environment.sunlight.times.nadir', value: times.nadir },
        { path: 'environment.sunlight.times.nightEnd', value: times.nightEnd },
        {
          path: 'environment.sunlight.times.nauticalDawn',
          value: times.nauticalDawn
        },
        { path: 'environment.sunlight.times.dawn', value: times.dawn },
        { path: 'environment.sunlight.times.tomorrow.sunrise', value: tomorrowTimes.sunrise },
        { path: 'environment.sunlight.times.tomorrow.sunriseEnd', value: tomorrowTimes.sunriseEnd },
        { path: 'environment.sunlight.times.tomorrow.goldenHourEnd', value: tomorrowTimes.goldenHourEnd },
        { path: 'environment.sunlight.times.tomorrow.solarNoon', value: tomorrowTimes.solarNoon },
        { path: 'environment.sunlight.times.tomorrow.goldenHour', value: tomorrowTimes.goldenHour },
        { path: 'environment.sunlight.times.tomorrow.sunsetStart', value: tomorrowTimes.sunsetStart },
        { path: 'environment.sunlight.times.tomorrow.sunset', value: tomorrowTimes.sunset },
        { path: 'environment.sunlight.times.tomorrow.dusk', value: tomorrowTimes.dusk },
        { path: 'environment.sunlight.times.tomorrow.nauticalDusk', value: tomorrowTimes.nauticalDusk },
        { path: 'environment.sunlight.times.tomorrow.night', value: tomorrowTimes.night },
        { path: 'environment.sunlight.times.tomorrow.nadir', value: tomorrowTimes.nadir },
        { path: 'environment.sunlight.times.tomorrow.nightEnd', value: tomorrowTimes.nightEnd },
        { path: 'environment.sunlight.times.tomorrow.nauticalDawn', value: tomorrowTimes.nauticalDawn },
        { path: 'environment.sunlight.times.tomorrow.dawn', value: tomorrowTimes.dawn }
      ]
    }
  }
}
