import * as suncalc from 'suncalc'
import { isPosition } from '../utils'
import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, _plugin): Calculation {
  // environment.mode is also switched by hand (App Dock's day/night button).
  // Restating it every minute would undo that switch, so it is published only
  // when sunrise or sunset changes it; a manual switch then holds until then.
  let publishedMode: string | undefined
  return {
    group: 'sun',
    optionKey: 'Sun',
    title:
      'Sets environment.sun to nauticalDawn, dawn, sunrise, day, sunset, dusk, nauticalDusk or night. Sets environment.mode to day or night at sunrise and sunset.',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: ['', undefined],
    debounceDelay: 60 * 1000,
    calculator: function (datetime: string | undefined, position: unknown) {
      let value: string
      let mode: string
      let date: Date

      if (!isPosition(position)) {
        return
      }

      if (datetime && datetime.length > 0) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }

      app.debug(`Using datetime: ${date} position: ${JSON.stringify(position)}`)

      const times = suncalc.getTimes(
        date,
        position.latitude,
        position.longitude
      ) as unknown as Record<string, Date>
      const now = date.getTime()

      const timesMs: Record<string, number> = {}
      Object.keys(times).forEach((key) => {
        timesMs[key] = new Date(times[key]!).getTime()
      })

      if (now >= timesMs['sunrise']!) {
        if (now < timesMs['sunriseEnd']!) {
          value = 'sunrise'
          mode = 'day'
        } else if (now <= timesMs['sunsetStart']!) {
          value = 'day'
          mode = 'day'
        } else if (now >= timesMs['sunsetStart']! && now < timesMs['dusk']!) {
          value = 'sunset'
          mode = 'night'
        } else if (now < timesMs['nauticalDusk']!) {
          value = 'dusk'
          mode = 'night'
        } else if (now < timesMs['night']!) {
          value = 'nauticalDusk'
          mode = 'night'
        } else {
          value = 'night'
          mode = 'night'
        }
      } else {
        mode = 'night'
        if (now >= timesMs['dawn']!) {
          value = 'dawn'
        } else if (now >= timesMs['nauticalDawn']!) {
          value = 'nauticalDawn'
        } else {
          value = 'night'
        }
      }

      app.debug(`Setting sun to ${value} and mode to ${mode}`)

      const values = [{ path: 'environment.sun', value: value }]
      if (mode !== publishedMode) {
        values.push({ path: 'environment.mode', value: mode })
        publishedMode = mode
      }
      return values
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
      }
    ]
  }
}

module.exports = factory
