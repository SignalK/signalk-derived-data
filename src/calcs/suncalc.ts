import { sunIsUp } from '@openwaters/almanac'
import { astronomyInput, sunTimes } from '../astronomy'
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
    meta: {
      'environment.sun': {
        description:
          "Phase of the sun at the vessel's position, such as dawn, day, dusk or night."
      }
    },
    debounceDelay: 60 * 1000,
    calculator: function (datetime: string | undefined, position: unknown) {
      const input = astronomyInput(datetime, position)
      if (!input) return
      const { date, observer } = input
      const times = sunTimes(date, observer)
      const transitions = [
        ['nauticalDawn', 'nauticalDawn'],
        ['dawn', 'dawn'],
        ['sunrise', 'sunrise'],
        ['sunriseEnd', 'day'],
        ['sunsetStart', 'sunset'],
        ['sunset', 'sunset'],
        ['dusk', 'dusk'],
        ['nauticalDusk', 'nauticalDusk'],
        ['night', 'night']
      ] as const
      const latest = transitions
        .filter(([name]) => times[name] !== null && times[name]! <= date)
        .sort(([a], [b]) => times[a]!.getTime() - times[b]!.getTime())
        .at(-1)
      const isUp = sunIsUp(date, observer)
      const polarDay = times.sunrise === null && times.sunset === null && isUp
      const value = polarDay ? 'day' : (latest?.[1] ?? 'night')
      const mode = isUp ? 'day' : 'night'

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
