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
        { path: 'environment.moon.fraction', value: illumination.fraction },
        { path: 'environment.moon.phase', value: illumination.phase },
        { path: 'environment.moon.phaseName', value: phaseName },
        { path: 'environment.moon.angle', value: illumination.angle },
        { path: 'environment.moon.times.rise', value: times.rise || null },
        { path: 'environment.moon.times.set', value: times.set || null },
        {
          path: 'environment.moon.times.alwaysUp',
          value: times.alwaysUp ? 'true' : 'false'
        },
        {
          path: 'environment.moon.times.alwaysDown',
          value: times.alwaysDown ? 'true' : 'false'
        }
      ]
    }
  }
}
