import {
  astronomyInput,
  isAstronomyDate,
  sunTimes,
  sunTimeNames
} from '../astronomy'
import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, plugin): Calculation {
  return {
    group: 'sun',
    optionKey: 'Sun Time',
    title: 'Sets environment.sunlight.times.* to sunrise, sunset, etc',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: ['', undefined],
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

      const results: Array<{ path: string; value: unknown }> = []
      const sunProps = plugin.properties?.['sun'] as
        { forecastDays?: number } | undefined
      const forecastDays = sunProps?.forecastDays ?? 1

      for (let day = 0; day <= forecastDays; day++) {
        const targetDate = new Date(date)
        targetDate.setDate(targetDate.getDate() + day)
        if (!isAstronomyDate(targetDate)) break
        const times = sunTimes(targetDate, observer)

        const prefix =
          day === 0
            ? 'environment.sunlight.times'
            : `environment.sunlight.times.${day}`

        results.push(
          ...sunTimeNames.map((name) => ({
            path: `${prefix}.${name}`,
            value: times[name]
          }))
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
