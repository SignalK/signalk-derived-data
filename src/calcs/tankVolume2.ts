import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, plugin): Calculation[] {
  return (plugin.tanks ?? []).map((instance): Calculation => {
    const levelPath = 'tanks.' + instance + '.currentLevel'
    const capacityPath = 'tanks.' + instance + '.capacity'
    const volumePath = 'tanks.' + instance + '.currentVolume'
    const derivedFromList = [levelPath, capacityPath]

    // Seed `capacity` from the data tree so the calc works whether
    // capacity comes from `defaults.json` (static; would otherwise
    // leave the combine blocked, since defaults aren't replayed as
    // deltas to late subscribers) or from a tank sender (real deltas
    // supersede the seed via Bacon's `toProperty`, so live updates
    // still flow).
    const rawCapacity = app.getSelfPath(capacityPath + '.value') as
      | number
      | undefined
    const seededCapacity =
      Number.isFinite(rawCapacity) && (rawCapacity as number) > 0
        ? rawCapacity
        : undefined

    if (seededCapacity !== undefined) {
      app.debug(
        'tankVolume2[%s]: seeded capacity %s from data tree',
        instance,
        seededCapacity
      )
    } else {
      app.debug(
        'tankVolume2[%s]: no capacity seed available, waiting for capacity stream',
        instance
      )
    }

    // Build the defaults array positionally so a future reorder of
    // `derivedFromList` cannot silently misalign the seed with the
    // wrong stream slot.
    const seededDefaults =
      seededCapacity !== undefined
        ? derivedFromList.map((path) =>
            path === capacityPath ? seededCapacity : undefined
          )
        : undefined

    return {
      group: 'tanks',
      optionKey: 'tankVolume2_' + instance,
      title:
        "'tanks." +
        instance +
        "' Tank Volume (alternate currentVolume calculation; select only one calculation per tank)",
      derivedFrom: function () {
        return derivedFromList
      },
      defaults: seededDefaults,
      calculator: function (level: number, capacity: number) {
        // Guard sensor inputs against NaN, Infinity, and physically
        // meaningless capacities (negative or zero). A negative
        // capacity in defaults.json or from a misconfigured tank
        // sender would otherwise emit negative volumes on every
        // sensor tick.
        if (
          !Number.isFinite(level) ||
          !Number.isFinite(capacity) ||
          capacity <= 0
        ) {
          return undefined
        }
        return [
          {
            path: volumePath,
            value: level * capacity
          }
        ]
      }
    }
  })
}

module.exports = factory
