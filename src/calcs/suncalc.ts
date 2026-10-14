import { sunIsUp } from '@openwaters/almanac'
import { astronomyInput, sunTimes } from '../astronomy'
import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, _plugin): Calculation {
  return {
    group: 'sun',
    optionKey: 'Sun',
    title:
      'Sets environment.sun to nauticalDawn, dawn, sunrise, day, sunset, dusk, nauticalDusk or night. Sets environment.mode to day or night.',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: ['', undefined],
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
      // which gives this approximate schedule (UTC):
      //   nauticalDawn 05:09 | dawn 05:35 | sunrise 05:58 | sunriseEnd 06:00
      //   sunsetStart 18:03 | sunset 18:05 | dusk 18:28 | nauticalDusk 18:54 | night 19:20
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

module.exports = factory
