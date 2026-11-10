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
import { daysAfterToday } from '../utils'
import type { Calculation, CalculationFactory, PathMeta } from '../types'

function moonMeta(forecastDays: number): Record<string, PathMeta> {
  const meta: Record<string, PathMeta> = {}
  for (let day = 0; day <= forecastDays; day++) {
    const prefix = day === 0 ? 'environment.moon' : `environment.moon.${day}`
    // '' today, or ', 2 days after today' for a forecast day
    const when = day === 0 ? '' : `, ${daysAfterToday(day)}`
    const theDay = day === 0 ? 'today' : 'that day'
    const onDay = day === 0 ? 'today' : daysAfterToday(day)
    meta[`${prefix}.fraction`] = {
      units: 'ratio',
      description: `Illuminated fraction of the moon${when}.`
    }
    meta[`${prefix}.phase`] = {
      units: 'ratio',
      description: `Moon phase as a fraction of the lunar cycle${when}: 0 new moon, 0.25 first quarter, 0.5 full moon, 0.75 last quarter.`
    }
    meta[`${prefix}.phaseName`] = {
      description:
        day === 0
          ? 'Name of the current moon phase, such as new moon or full moon.'
          : `Name of the moon phase${when}, such as new moon or full moon.`
    }
    meta[`${prefix}.angle`] = {
      units: 'rad',
      description: `Position angle of the moon's bright limb${when}, measured eastward from the north point of the disk.`
    }
    meta[`${prefix}.times.rise`] = {
      units: 'RFC 3339 (UTC)',
      description: `Time of moonrise ${onDay} at the vessel's position, or null when the moon does not rise ${theDay}.`
    }
    meta[`${prefix}.times.set`] = {
      units: 'RFC 3339 (UTC)',
      description: `Time of moonset ${onDay} at the vessel's position, or null when the moon does not set ${theDay}.`
    }
    meta[`${prefix}.times.alwaysUp`] = {
      description: `True when the moon stays above the horizon all day at the vessel's position${when}.`
    }
    meta[`${prefix}.times.alwaysDown`] = {
      description: `True when the moon stays below the horizon all day at the vessel's position${when}.`
    }
  }
  return meta
}

const factory: CalculationFactory = function (app, plugin): Calculation {
  const moonProps = plugin.properties?.['moon'] as
    { forecastDays?: number } | undefined
  return {
    group: 'moon',
    optionKey: 'Moon',
    title: 'Sets environment.moon.* information such as phase, rise, and set',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: [undefined, undefined],
    meta: moonMeta(moonProps?.forecastDays ?? 1),
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
