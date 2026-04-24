import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app, plugin): Calculation[] {
  return (plugin.batteries ?? []).map((instance): Calculation => {
    const powerPath = 'electrical.batteries.' + instance + '.power'
    const derivedFromList = [
      'electrical.batteries.' + instance + '.voltage',
      'electrical.batteries.' + instance + '.current'
    ]
    return {
      group: 'electrical',
      optionKey: 'batteryPower' + instance,
      title: 'Battery ' + instance + ' Power ',
      derivedFrom: function () {
        return derivedFromList
      },
      calculator: function (v: number, a: number) {
        return [{ path: powerPath, value: v * a }]
      }
    }
  })
}

module.exports = factory
