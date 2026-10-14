import {
  moonIllumination,
  moonOrientation,
  moonEvents,
  moonAltAz,
  moonPosition,
  degreesToRadians,
  radiansToDegrees
} from '@openwaters/almanac'
import { astronomyInput, isAstronomyDate, solarDay } from '../astronomy'
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
      const input = astronomyInput(datetime, position)
      if (!input) return
      const { date, observer } = input

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
        { forecastDays?: number } | undefined
      const forecastDays = moonProps?.forecastDays ?? 1

      for (let day = 0; day <= forecastDays; day++) {
        const targetDate = new Date(date)
        targetDate.setDate(targetDate.getDate() + day)
        if (!isAstronomyDate(targetDate)) break

        const illumination = moonIllumination(targetDate)
        const orientation = moonOrientation(targetDate, observer)
        const fraction = Math.round(illumination.fraction * 100) / 100
        const phase = Math.round(illumination.phase * 100) / 100
        // Signal K clients use a signed bright-limb angle.
        const signedAngle =
          orientation.brightLimbAngleDeg > 180
            ? orientation.brightLimbAngleDeg - 360
            : orientation.brightLimbAngleDeg
        const angle = Math.round(degreesToRadians(signedAngle) * 100) / 100
        app.debug(
          `moon illumination day ${day}: ` +
            JSON.stringify({ fraction, phase, angle }, null, 2)
        )

        const phaseName = getPhaseName(phase)
        app.debug(`Phase Name day ${day}: ${phaseName}`)

        const { start, end } = solarDay(targetDate, observer)
        const events = moonEvents(start, end, observer)
        const rise = events.find((event) => event.kind === 'rise')?.time ?? null
        const set = events.find((event) => event.kind === 'set')?.time ?? null
        // Upper-limb visibility includes the Moon's semidiameter (Almanac's mean radius).
        const limbAltitude =
          moonAltAz(targetDate, observer).altDeg +
          radiansToDegrees(
            Math.asin(1737.4 / moonPosition(targetDate).distanceKm)
          )
        const times = {
          rise,
          set,
          alwaysUp: events.length === 0 && limbAltitude > 0,
          alwaysDown: events.length === 0 && limbAltitude <= 0
        }
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
