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
        return [{ path: economyPath, value: speed / rate }]
      }
    }
  })
}

module.exports = factory
