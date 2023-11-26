const suncalc = require('suncalc')
const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'moon',
    optionKey: 'Moon',
    title: 'Sets environment.moon.* information such as phase, rise, and set',
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

      var illumination = suncalc.getMoonIllumination(date)
      _.keys(illumination).forEach(key => {
        illumination[key] = illumination[key].toFixed(2)
      })
      app.debug('moon illumination:' + JSON.stringify(illumination, null, 2))

      // get the phase name
      var phaseName = null
      switch (true) {
        case illumination.phase == 0:
          phaseName = 'New Moon'
          break
        case illumination.phase < 0.25:
          phaseName = 'Waxing Crescent'
          break
        case illumination.phase == 0.25:
          phaseName = 'First Quarter'
          break
        case illumination.phase < 0.5:
          phaseName = 'Waxing Gibbous'
          break
        case illumination.phase == 0.5:
          phaseName = 'Full Moon'
          break
        case illumination.phase < 0.75:
          phaseName = 'Waning Gibbous'
          break
        case illumination.phase == 0.75:
          phaseName = 'Last Quarter'
          break
        default:
          phaseName = 'Waning Crescent'
      }
      app.debug('Phase Name:' + phaseName)

      var times = suncalc.getMoonTimes(
        date,
        position.latitude,
        position.longitude
      )
      app.debug('moon times:' + JSON.stringify(times, null, 2))

      return [
        {
          path: 'environment.moon.fraction',
          value: Number(illumination.fraction)
        },
        { path: 'environment.moon.phase', value: Number(illumination.phase) },
        { path: 'environment.moon.phaseName', value: phaseName },
        { path: 'environment.moon.angle', value: Number(illumination.angle) },
        { path: 'environment.moon.times.rise', value: times.rise || null },
        { path: 'environment.moon.times.set', value: times.set || null },
        {
          path: 'environment.moon.times.alwaysUp',
          value: Boolean(times.alwaysUp ? 'true' : 'false')
        },
        {
          path: 'environment.moon.times.alwaysDown',
          value: Boolean(times.alwaysDown ? 'true' : 'false')
        }
      ]
    },
    tests: [
      {
        input: [
          '2017-04-15T17:18:33Z',
          { longitude: -76.2966773, latitude: 39.0589637 }
        ],
        expected: [
          {
            path: 'environment.moon.fraction',
            value: 0.82
          },
          {
            path: 'environment.moon.phase',
            value: 0.64
          },
          {
            path: 'environment.moon.phaseName',
            value: 'Waning Gibbous'
          },
          {
            path: 'environment.moon.angle',
            value: 1.6
          },
          {
            path: 'environment.moon.times.rise',
            value: '2017-04-15T02:59:40.105Z'
          },
          {
            path: 'environment.moon.times.set',
            value: '2017-04-15T13:25:54.314Z'
          },
          {
            path: 'environment.moon.times.alwaysUp',
            value: true
          },
          {
            path: 'environment.moon.times.alwaysDown',
            value: true
          }
        ]
      }
    ]
  }
}
