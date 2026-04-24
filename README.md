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

## What it calculates

Every calculator here is optional and enabled individually in the
plugin's config screen. Each has a `derivedFrom` list of Signal K
paths and emits on one or more output paths.

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

## Contributing

Issues and pull requests welcome at
[SignalK/signalk-derived-data](https://github.com/SignalK/signalk-derived-data).
`npm test` runs the full mocha suite; `npm run typecheck` +
`npm run build` guard the TypeScript surface; `npm run mutation`
runs Stryker against the calcs.

## License

Apache-2.0. See [LICENSE](LICENSE).
