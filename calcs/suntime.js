const suncalc = require('suncalc')
const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'sun',
    optionKey: 'Sun Time',
    title:
      'Sets environment.sunlight.times.* to sunrise, sunset, etc (based on navigation.datetime or system time and navigation.position)',
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

      return [
        { path: 'environment.sunlight.times.sunrise', value: times.sunrise},
        { path: 'environment.sunlight.times.sunriseEnd', value: times.sunriseEnd},
        { path: 'environment.sunlight.times.goldenHourEnd', value: times.goldenHourEnd},
        { path: 'environment.sunlight.times.solarNoon', value: times.solarNoon},
        { path: 'environment.sunlight.times.goldenHour', value: times.goldenHour},
        { path: 'environment.sunlight.times.sunsetStart', value: times.sunsetStart},
        { path: 'environment.sunlight.times.sunset', value: times.sunset},
        { path: 'environment.sunlight.times.dusk', value: times.dusk},
        { path: 'environment.sunlight.times.nauticalDusk', value: times.nauticalDusk},
        { path: 'environment.sunlight.times.night', value: times.night},
        { path: 'environment.sunlight.times.nadir', value: times.nadir},
        { path: 'environment.sunlight.times.nightEnd', value: times.nightEnd},
        { path: 'environment.sunlight.times.nauticalDawn', value: times.nauticalDawn},
        { path: 'environment.sunlight.times.dawn', value: times.dawn}
      ]
    }
  }
}
