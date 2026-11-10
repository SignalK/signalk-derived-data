# signalk-derived-data

[![CI](https://github.com/SignalK/signalk-derived-data/actions/workflows/ci.yml/badge.svg)](https://github.com/SignalK/signalk-derived-data/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/signalk-derived-data.svg)](https://www.npmjs.com/package/signalk-derived-data)
[![License](https://img.shields.io/npm/l/signalk-derived-data.svg)](https://github.com/SignalK/signalk-derived-data/blob/master/LICENSE)

Signal K server plugin that emits deltas for values derived from other
Signal K values — wind angles computed from AWA + heading, CPA/TCPA
from AIS tracks, moon illumination from time + position, tank volumes
from calibrated levels, and so on.

## Installation

Through the Signal K server admin UI — App Store → search for
_signalk-derived-data_ → install. Or from the command line in your
`~/.signalk` dir:

```sh
npm install signalk-derived-data
```

Requires [signalk-server](https://github.com/SignalK/signalk-server)
with Node `>=22`.

## Auto and manual mode

On a fresh install the plugin starts by itself in **auto mode**: it
runs every calculation whose inputs are available and adds more as
new sensors start reporting.

- A minute after the server starts (at once when only the plugin
  restarts), and every 15 s after that, it looks at the data
  model. A calculation runs when its inputs come from a sensor or from
  another running calculation, and the vessel data it needs (such as
  `design.draft` for depth below keel) is set.
- It leaves out any calculation whose result already comes from another
  source, and stops one when such a source appears, so it never
  competes with a sensor on the same path. Where two calculations
  produce the same path, only the first one runs.
- Engines, batteries and tanks are found in the data model.
- Wind Shift, the calibrated tank volume and deprecated calculations
  are never enabled automatically.
- Duplicate values are held back for 5 s unless you set another TTL.
- The config screen shows the state of each calculation: active,
  waiting for a path, or skipped because another source provides it.

**Manual mode** runs exactly the calculations ticked in the config
screen. An existing configuration from before auto mode stays in
manual mode, and switching from auto back to manual brings back the
ticks you had.

## What it calculates

Each calculation has a `derivedFrom` list of Signal K paths and emits
on one or more output paths.

### Environment

- **Air density** from humidity, temperature, and pressure
- **Air dew point** from humidity and temperature
- **Wind chill** from wind speed and outside temperature
- **Heat index** from outside temperature and humidity
- **Moon illumination**, phase, rise, and set from time + position
- **Sun mode** (`dawn` / `sunrise` / `day` / `sunset` / `dusk` /
  `night`) from time + position
- **Sun times** — `sunrise`, `sunriseEnd`, `goldenHourEnd`,
  `solarNoon`, `goldenHour`, `sunsetStart`, `sunset`, `dusk`,
  `nauticalDusk`, `night`, `nadir`, `nightEnd`, `nauticalDawn`, `dawn`
- **Celestial positions** — apparent altitude and true azimuth of the Sun, Moon, Mercury, Venus, Mars, Jupiter, and Saturn

### Astronomy

Sun and Moon calculations use [@openwaters/almanac](https://github.com/openwatersio/almanac), an offline astronomy library with no runtime dependencies or data downloads. Its [accuracy contract](https://github.com/openwatersio/almanac/blob/main/docs/CONTRACT.md#fixture-corpus-and-accuracy) is checked against JPL Horizons and USNO fixtures, with one-arcminute Sun/Moon position and 60-second event-time tolerances.

The **Sun**, **Sun Time**, and **Moon** options retain their output paths and forecast prefixes. Forecast day zero is the solar day around the local noon nearest `navigation.datetime`; later days advance by calendar date in the server's timezone. Missing rise/set or twilight crossings are `null`, and the Moon reports `times.alwaysUp` / `times.alwaysDown` when it has no crossing that day. `forecastDays: 0` emits only day zero. Invalid dates and dates outside 1950–2100 skip calculation; forecasts stop at the supported boundary.

Enable **Celestial positions** in the **celestial** config group to publish these plugin extension paths:

| Body    | Altitude path                         | Azimuth path                         |
| ------- | ------------------------------------- | ------------------------------------ |
| Sun     | `environment.sunlight.altitude`       | `environment.sunlight.azimuth`       |
| Moon    | `environment.moon.altitude`           | `environment.moon.azimuth`           |
| Planets | `environment.planets.<name>.altitude` | `environment.planets.<name>.azimuth` |

Planet names are `mercury`, `venus`, `mars`, `jupiter`, and `saturn`. All angles are radians. Azimuth is clockwise from true north in `[0, 2π)`; altitude is relative to the horizontal plane and includes standard atmospheric refraction. Positions use sea-level observer elevation. The calculator suggests `rad` path metadata on servers with `setDefaultMetadata`, updates at most once per minute, and uses the existing source timestamp handling for replay. These values can drive a sky display or help identify a bright object above the horizon.

### Navigation

- **Distance to go** from `courseGreatCircle.nextPoint.position`
- **Set and drift** from heading, course over ground, speed
  through water, speed over ground, and magnetic variation. Writes
  `environment.current.drift`, `setTrue`, `setMagnetic`, plus
  `environment.current.driftImpact` — the last of these is a
  plugin-specific extension, not part of the Signal K spec.
- **True course over ground** from magnetic COG + magnetic variation
- **Magnetic course over ground** from true COG + magnetic variation
- **ETA** to the active waypoint

### Depth

- **Depth below keel** from `depth.belowSurface` + `design.draft.maximum`
- **Depth below keel** from `depth.belowTransducer` + `depth.transducerToKeel`
- **Depth below surface** from `depth.belowKeel` + `design.draft.maximum`

### Wind

- **True wind angle / direction / speed** from speed-through-water,
  apparent wind angle, and apparent wind speed
- **True wind direction** from AWA and true heading
- **Ground wind angle / speed** from SOG, AWA, and AWS
- **Magnetic wind direction** (two variants: from AWA + magnetic
  heading, or from true wind direction + magnetic variation)
- **Wind shift** (experimental)

### Performance

- **VMG to course** from the next-point true bearing, true heading,
  and SOG
- **VMG to wind** from true wind direction and SOG
- **Propeller slip** (requires per-engine pitch + gear ratio in
  `defaults.json`)
- **Fuel economy** from SOG and fuel rate

### Boat state

- **Battery power** from battery voltage × current
- **Tank volume** from current level, using calibration pairs
  (>= 2 pairs for parallel sides, >= 3 for a wedge, >= 4 for
  more complex shapes)

### AIS

- **CPA / TCPA** (closest-point-of-approach / time-to-CPA) for
  nearby vessels, with configurable notification zones

## Writing a new calculator

Drop a file into `src/calcs/`. Each calculator is a default-exported
factory function that receives the server app + plugin instance and
returns a `Calculation` descriptor:

```ts
import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app): Calculation {
  return {
    group: 'course data',
    optionKey: 'vmg_Wind',
    title: 'Velocity Made Good to wind',
    derivedFrom: [
      'environment.wind.angleTrueWater',
      'navigation.speedOverGround'
    ],
    outputs: ['performance.velocityMadeGood'],
    debounceDelay: 200,
    calculator: function (trueWindAngle: number, speedOverGround: number) {
      const vmg_wind = Math.cos(trueWindAngle) * speedOverGround
      return [{ path: 'performance.velocityMadeGood', value: vmg_wind }]
    }
  }
}

module.exports = factory
```

`derivedFrom` lists the Signal K paths the calculator subscribes to;
the plugin feeds their latest values into `calculator` in the same
order. Return a `{ path, value }` list (or `[]` / `undefined` to skip
emission this tick).

Auto mode needs three more fields:

- `outputs` lists the paths the calculator writes (a branch such as
  `environment.moon` covers everything below it). A calculation without
  `outputs` never runs in auto mode, and a test fails when a path in
  `tests[].expected` is missing from it.
- `requires` lists vessel data the calculator reads with `getSelfPath`
  rather than from a stream, as the exact `getSelfPath` argument (for
  example `design.draft.value.maximum`).
- `auto: false` keeps a calculation out of auto mode, for example when
  it needs settings only the user can give.

Each emitted delta is stamped with the minimum timestamp observed
across the source paths, so staleness on any input propagates to the
derived value and filestream replay preserves original timing. Calcs
that author their own `{ context, updates }` deltas (`cpa_tcpa`) are
responsible for their own timestamps.

A calculator that writes paths the Signal K specification does not
define can describe them with `meta`, keyed by path; the plugin sends
the meta of the enabled calculators once at start:

```ts
    meta: {
      'environment.sun': {
        description:
          "Phase of the sun at the vessel's position, such as dawn, day, dusk or night."
      }
    },
```

Leave out the paths the specification defines (for example
`performance.velocityMadeGood` above): the server already gives their
description and units from its path metadata (`@signalk/path-metadata`),
and meta sent by a plugin would override it. A test checks this rule.

## Contributing

Issues and pull requests welcome at
[SignalK/signalk-derived-data](https://github.com/SignalK/signalk-derived-data).
`npm test` runs the full mocha suite; `npm run typecheck` +
`npm run build` guard the TypeScript surface; `npm run mutation`
runs Stryker against the calcs.

## License

Apache-2.0. See [LICENSE](LICENSE).
