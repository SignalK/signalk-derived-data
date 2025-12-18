const suncalc = require('suncalc')
const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'moon',
    optionKey: 'Moon',
    title: 'Sets environment.moon.* information such as phase, rise, and set',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: [undefined, undefined],
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

      if (!_.isUndefined(datetime) && datetime.length > 0) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }

      app.debug(`Using datetime: ${date} position: ${JSON.stringify(position)}`)

      function getPhaseName (phase) {
        switch (true) {
          case phase == 0:
            return 'New Moon'
          case phase < 0.25:
            return 'Waxing Crescent'
          case phase == 0.25:
            return 'First Quarter'
          case phase < 0.5:
            return 'Waxing Gibbous'
          case phase == 0.5:
            return 'Full Moon'
          case phase < 0.75:
            return 'Waning Gibbous'
          case phase == 0.75:
            return 'Last Quarter'
          default:
            return 'Waning Crescent'
        }
      }

      var results = []
      const forecastDays = plugin.properties.moon.forecastDays || 1

      for (let day = 0; day <= forecastDays; day++) {
        const targetDate = new Date(date)
        targetDate.setDate(targetDate.getDate() + day)

        const illumination = suncalc.getMoonIllumination(targetDate)
        _.keys(illumination).forEach(key => {
          illumination[key] = _.round(illumination[key], 2)
        })
        app.debug(
          `moon illumination day ${day}:` +
            JSON.stringify(illumination, null, 2)
        )

        const phaseName = getPhaseName(illumination.phase)
        app.debug(`Phase Name day ${day}: ${phaseName}`)

        const times = suncalc.getMoonTimes(
          targetDate,
          position.latitude,
          position.longitude
        )
        app.debug(`moon times day ${day}:` + JSON.stringify(times, null, 2))

        const prefix =
          day === 0 ? 'environment.moon' : `environment.moon.${day}`

        results.push(
          { path: `${prefix}.fraction`, value: illumination.fraction },
          { path: `${prefix}.phase`, value: illumination.phase },
          { path: `${prefix}.phaseName`, value: phaseName },
          { path: `${prefix}.angle`, value: illumination.angle },
          { path: `${prefix}.times.rise`, value: times.rise || null },
          { path: `${prefix}.times.set`, value: times.set || null },
          { path: `${prefix}.times.alwaysUp`, value: !!times.alwaysUp },
          { path: `${prefix}.times.alwaysDown`, value: !!times.alwaysDown }
        )
      }

      return results
    }
  }
}
