import Spline from 'cubic-spline'
import type { Calculation, CalculationFactory } from '../types'

// Volume units as configured in the plugin schema -> factor to convert to
// cubic metres (the SignalK canonical unit).
const VOLUME_UNIT_FACTORS: Record<string, number> = {
  litres: 0.001,
  gal: 0.00378541,
  m3: 1
}

interface CalibrationEntry {
  level: number
  volume: number
}

// tankInstances = ["tanks.fuel.*", "tanks.fuel.1", "tanks.water.0" ]
const factory: CalculationFactory = function (app, plugin): Calculation[] {
  return (plugin.tanks ?? []).map((instance): Calculation => {
    // Output paths and derivedFrom list are constant per instance.
    const capacityPath = 'tanks.' + instance + '.capacity'
    const volumePath = 'tanks.' + instance + '.currentVolume'
    const derivedFromList = ['tanks.' + instance + '.currentLevel']
    const calibrationKey = 'calibrations.' + instance

    // Lazily built on the first calculator call — plugin.properties is only
    // populated by plugin.start(), which runs after the factory. Once built,
    // the spline and the derived capacity are reused for every tick until
    // the plugin restarts (calibrations are static config, applied on
    // restart). When calibrations are missing or too sparse to form a
    // spline, both stay null and the calculator short-circuits.
    let interpolator: Spline | null = null
    let capacity: number | null = null
    let calibrationChecked = false

    return {
      group: 'tanks',
      optionKey: 'tankVolume_' + instance,
      title:
        "'tanks." +
        instance +
        "' Tank Volume and Capacity (requires calibration pairs (>2 for parallell sides, >3 for straight wedge and >4 for more complex shapes)",
      derivedFrom: function () {
        return derivedFromList
      },
      properties: {
        volume_unit: {
          type: 'string',
          title: 'Input unit',
          enum: ['litres', 'gal', 'm3'],
          default: 'litres'
        },
        [calibrationKey]: {
          type: 'array',
          title: 'Calibration entries (pairs of level => volume)',
          items: {
            type: 'object',
            required: ['level', 'volume'],
            properties: {
              level: {
                type: 'number',
                title: 'level (ratio max 1)',
                description: ' '
              },
              volume: {
                type: 'number',
                title: 'corresponding volume (selected unit)',
                description: ' '
              }
            }
          }
        }
      },
      calculator: function (level: number) {
        if (!Number.isFinite(level)) {
          return undefined
        }
        if (!calibrationChecked) {
          calibrationChecked = true
          const tankProps = plugin.properties?.['tanks'] as
            | Record<string, unknown>
            | undefined
          const cal =
            (tankProps?.[calibrationKey] as CalibrationEntry[] | undefined) ??
            []
          // cubic-spline needs at least two knot points; anything fewer
          // collapses to a constant or throws inside getNaturalKs. A user
          // who enables a tank instance without configuring calibrations
          // would otherwise see the calculator emit NaN volumes on every
          // level update.
          if (cal.length < 2) {
            return undefined
          }
          const unit = tankProps?.['volume_unit'] as string | undefined
          // Unknown unit falls back to 1 (m^3) — matches the pre-refactor
          // else branch.
          const factor =
            unit && unit in VOLUME_UNIT_FACTORS ? VOLUME_UNIT_FACTORS[unit]! : 1
          const calLevels = new Array<number>(cal.length)
          const calVolumes = new Array<number>(cal.length)
          for (let i = 0; i < cal.length; i++) {
            calLevels[i] = cal[i]!.level
            calVolumes[i] = cal[i]!.volume * factor
          }
          app.debug(unit ?? '')
          // cubic-spline 2.x dropped the `spline(x, xs, ys)` function form
          // in favour of `new Spline(xs, ys).at(x)`. The interpolator and
          // its derived capacity are constant for the life of the plugin.
          interpolator = new Spline(calLevels, calVolumes)
          capacity = interpolator.at(1)
        }

        if (interpolator === null) {
          return undefined
        }

        const volume = interpolator.at(level)
        if (!Number.isFinite(capacity) || !Number.isFinite(volume)) {
          return undefined
        }

        return [
          {
            path: capacityPath,
            value: capacity
          },
          {
            path: volumePath,
            value: volume
          }
        ]
      }
    }
  })
}

module.exports = factory
