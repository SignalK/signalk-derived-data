import {
  sunEvents,
  sunAltitudeEvents,
  sunTransits,
  type Observer
} from '@openwaters/almanac'
import { isPosition } from './utils'

const minTime = Date.parse('1950-01-01T00:00Z')
const maxTime = Date.parse('2101-01-01T00:00Z')
const dayMs = 24 * 60 * 60 * 1000

export function isAstronomyDate(date: Date): boolean {
  return date.getTime() >= minTime && date.getTime() < maxTime
}

export function astronomyInput(
  datetime: string | undefined,
  position: unknown
) {
  if (!isPosition(position)) return
  const date = datetime ? new Date(datetime) : new Date()
  if (!isAstronomyDate(date)) return
  return {
    date,
    observer: {
      latitudeDeg: position.latitude,
      longitudeDeg: position.longitude
    }
  }
}

export function solarDay(date: Date, observer: Observer) {
  const transits = sunTransits(
    new Date(Math.max(minTime, date.getTime() - 1.5 * dayMs)),
    new Date(Math.min(maxTime, date.getTime() + 1.5 * dayMs)),
    observer
  )
  // Forecasts follow the solar day around the nearest local noon.
  const noon = transits
    .filter((event) => event.kind === 'upper')
    .sort(
      (a, b) =>
        Math.abs(a.time.getTime() - date.getTime()) -
        Math.abs(b.time.getTime() - date.getTime())
    )[0]!.time
  return {
    noon,
    start:
      transits
        .filter((event) => event.kind === 'lower' && event.time < noon)
        .at(-1)?.time ?? new Date(minTime),
    end:
      transits.find((event) => event.kind === 'lower' && event.time > noon)
        ?.time ?? new Date(maxTime)
  }
}

export const sunTimeNames = [
  'sunrise',
  'sunriseEnd',
  'goldenHourEnd',
  'solarNoon',
  'goldenHour',
  'sunsetStart',
  'sunset',
  'dusk',
  'nauticalDusk',
  'night',
  'nadir',
  'nightEnd',
  'nauticalDawn',
  'dawn'
] as const
type SunTimeName = (typeof sunTimeNames)[number]

export function sunTimes(date: Date, observer: Observer) {
  const { start, end, noon } = solarDay(date, observer)
  const times = Object.fromEntries(
    sunTimeNames.map((name) => [name, null])
  ) as Record<SunTimeName, Date | null>
  const names = {
    rise: 'sunrise',
    set: 'sunset',
    transit: 'solarNoon',
    civilDawn: 'dawn',
    civilDusk: 'dusk',
    nauticalDawn: 'nauticalDawn',
    nauticalDusk: 'nauticalDusk',
    astroDawn: 'nightEnd',
    astroDusk: 'night'
  } as const
  for (const event of sunEvents(start, end, observer))
    times[names[event.kind]] = event.time
  for (const [altitude, rising, falling] of [
    [-0.3, 'sunriseEnd', 'sunsetStart'],
    [6, 'goldenHourEnd', 'goldenHour']
  ] as const) {
    for (const event of sunAltitudeEvents(start, end, observer, altitude)) {
      times[event.kind === 'rising' ? rising : falling] = event.time
    }
  }
  times.solarNoon = noon
  times.nadir = start.getTime() === minTime ? null : start
  return times
}
