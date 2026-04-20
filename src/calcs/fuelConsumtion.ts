import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, plugin): Calculation[] {
  const engines = plugin.engines ?? []

  app.debug('engines: %j', engines)

  return engines.map((instance): Calculation => {
    const economyPath = 'propulsion.' + instance + '.fuel.economy'
    const derivedFromList = [
      'propulsion.' + instance + '.fuel.rate',
      'navigation.speedOverGround'
    ]
    return {
      group: 'propulsion',
      optionKey: 'economy' + instance,
      title: `${instance} fuel economy`,
      derivedFrom: function () {
        return derivedFromList
      },
      calculator: function (rate: number, speed: number) {
        // Fuel rate is strictly positive (an injector can't un-burn
        // fuel); SOG is a magnitude so it can't be negative. Treat
        // either non-finite or non-positive rate, and any non-finite
        // or negative speed, as "no data" so the calc silently drops
        // the sample instead of publishing Infinity or a nonsense
        // economy value.
        if (
          !Number.isFinite(rate) ||
          rate <= 0 ||
          !Number.isFinite(speed) ||
          speed < 0
        ) {
          return undefined
        }
        return [{ path: economyPath, value: speed / rate }]
      }
    }
  })
}

module.exports = factory
