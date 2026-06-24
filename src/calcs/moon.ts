import * as suncalc from 'suncalc'
import { isPosition, degreesToRadians } from '../utils'
import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, plugin): Calculation {
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
    calculator: function (datetime: string | undefined, position: unknown) {
      let date: Date

      if (!isPosition(position)) {
        return
      }

      if (datetime !== undefined && datetime.length > 0) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }

      app.debug(`Using datetime: ${date} position: ${JSON.stringify(position)}`)

      function getPhaseName(phase: number): string {
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

      const results: Array<{ path: string; value: unknown }> = []
      const moonProps = plugin.properties?.['moon'] as
        | { forecastDays?: number }
        | undefined
      const forecastDays = moonProps?.forecastDays || 1

      for (let day = 0; day <= forecastDays; day++) {
        const targetDate = new Date(date)
        targetDate.setDate(targetDate.getDate() + day)

        const illumination = suncalc.getMoonIllumination(targetDate)
        // suncalc v2 returns the bright-limb angle in degrees; SignalK
        // expects angles in radians, so convert it. fraction and phase are
        // unitless ratios and pass through unchanged.
        const fraction = Math.round(illumination.fraction * 100) / 100
        const phase = Math.round(illumination.phase * 100) / 100
        const angle =
          Math.round(degreesToRadians(illumination.angle) * 100) / 100
        app.debug(
          `moon illumination day ${day}: ` +
            JSON.stringify({ fraction, phase, angle }, null, 2)
        )

        const phaseName = getPhaseName(phase)
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
          { path: `${prefix}.fraction`, value: fraction },
          { path: `${prefix}.phase`, value: phase },
          { path: `${prefix}.phaseName`, value: phaseName },
          { path: `${prefix}.angle`, value: angle },
          { path: `${prefix}.times.rise`, value: times.rise || null },
          { path: `${prefix}.times.set`, value: times.set || null },
          { path: `${prefix}.times.alwaysUp`, value: !!times.alwaysUp },
          { path: `${prefix}.times.alwaysDown`, value: !!times.alwaysDown }
        )
      }

      return results
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

module.exports = factory
