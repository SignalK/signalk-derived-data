const suncalc = require('suncalc')
const _ = require('lodash')
const { isPosition } = require('../utils')

module.exports = function (app, plugin) {
  return {
    group: 'sun',
    optionKey: 'Sun',
    title:
      'Sets environment.sun to nauticalDawn, dawn, sunrise, day, sunset, dusk, nauticalDusk or night. Sets environment.mode to day or night.',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: ['', undefined],
    debounceDelay: 60 * 1000,
    calculator: function (datetime, position) {
      var value
      var mode
      var date

      // navigation.position is null during startup before the first GPS
      // fix; suncalc would throw on null coordinates and crash the server.
      if (!isPosition(position)) {
        return
      }

      if (datetime && datetime.length > 0) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }

      app.debug(`Using datetime: ${date} position: ${JSON.stringify(position)}`)

      var times = suncalc.getTimes(date, position.latitude, position.longitude)
      var now = date.getTime()

      _.keys(times).forEach(key => {
        times[key] = new Date(times[key]).getTime()
      })

      if (now >= times.sunrise) {
        if (now < times.sunriseEnd) {
          value = 'sunrise'
          mode = 'day'
        } else if (now <= times.sunsetStart) {
          value = 'day'
          mode = 'day'
        } else if (now >= times.sunsetStart && now < times.dusk) {
          value = 'sunset'
          mode = 'night'
        } else if (now < times.nauticalDusk) {
          value = 'dusk'
          mode = 'night'
        } else if (now < times.night) {
          value = 'nauticalDusk'
          mode = 'night'
        } else {
          value = 'night'
          mode = 'night'
        }
      } else {
        mode = 'night'
        if (now >= times.nauticalDawn) {
          value = 'nauticalDawn'
        } else if (now >= times.dawn) {
          value = 'dawn'
        } else {
          value = 'night'
        }
      }

      app.debug(`Setting sun to ${value} and mode to ${mode}`)

      return [
        { path: 'environment.sun', value: value },
        { path: 'environment.mode', value: mode }
      ]
    },
    tests: [
      {
        input: ['2024-06-21T12:00:00Z', null]
      },
      {
        input: ['2024-06-21T12:00:00Z', undefined]
      },
      {
        input: ['2024-06-21T12:00:00Z', { latitude: null, longitude: null }]
      }
    ]
  }
}
