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

      _.keys(times).forEach((key) => {
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
        if (now >= times.dawn) {
          value = 'dawn'
        } else if (now >= times.nauticalDawn) {
          value = 'nauticalDawn'
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
      // Early-return guards: invalid / missing position.
      {
        input: ['2024-06-21T12:00:00Z', null]
      },
      {
        input: ['2024-06-21T12:00:00Z', undefined]
      },
      {
        input: ['2024-06-21T12:00:00Z', { latitude: null, longitude: null }]
      },
      // Day-side branches. All datetimes are on 2024-06-21 at lat/lon 0,0,
      // which gives this fixed schedule (UTC):
      //   nauticalDawn 05:10 | dawn 05:37 | sunrise 05:59 | sunriseEnd 06:02
      //   sunsetStart 18:04 | sunset 18:07 | dusk 18:29 | nauticalDusk 18:55 | night 19:22
      {
        input: ['2024-06-21T06:00:00Z', { latitude: 0, longitude: 0 }],
        expected: [
          { path: 'environment.sun', value: 'sunrise' },
          { path: 'environment.mode', value: 'day' }
        ]
      },
      {
        input: ['2024-06-21T12:00:00Z', { latitude: 0, longitude: 0 }],
        expected: [
          { path: 'environment.sun', value: 'day' },
          { path: 'environment.mode', value: 'day' }
        ]
      },
      {
        input: ['2024-06-21T18:15:00Z', { latitude: 0, longitude: 0 }],
        expected: [
          { path: 'environment.sun', value: 'sunset' },
          { path: 'environment.mode', value: 'night' }
        ]
      },
      {
        input: ['2024-06-21T18:40:00Z', { latitude: 0, longitude: 0 }],
        expected: [
          { path: 'environment.sun', value: 'dusk' },
          { path: 'environment.mode', value: 'night' }
        ]
      },
      {
        input: ['2024-06-21T19:00:00Z', { latitude: 0, longitude: 0 }],
        expected: [
          { path: 'environment.sun', value: 'nauticalDusk' },
          { path: 'environment.mode', value: 'night' }
        ]
      },
      {
        input: ['2024-06-21T20:00:00Z', { latitude: 0, longitude: 0 }],
        expected: [
          { path: 'environment.sun', value: 'night' },
          { path: 'environment.mode', value: 'night' }
        ]
      },
      // Night-side branches (now < sunrise). Regression coverage for the
      // dawn / nauticalDawn ordering bug: with the buggy ordering, 05:45Z
      // would be reported as 'nauticalDawn' instead of 'dawn'.
      {
        input: ['2024-06-21T05:45:00Z', { latitude: 0, longitude: 0 }],
        expected: [
          { path: 'environment.sun', value: 'dawn' },
          { path: 'environment.mode', value: 'night' }
        ]
      },
      {
        input: ['2024-06-21T05:20:00Z', { latitude: 0, longitude: 0 }],
        expected: [
          { path: 'environment.sun', value: 'nauticalDawn' },
          { path: 'environment.mode', value: 'night' }
        ]
      },
      {
        input: ['2024-06-21T03:00:00Z', { latitude: 0, longitude: 0 }],
        expected: [
          { path: 'environment.sun', value: 'night' },
          { path: 'environment.mode', value: 'night' }
        ]
      }
    ]
  }
}
