import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app, plugin): Calculation[] {
  return (plugin.tanks ?? []).map((instance): Calculation => {
    const volumePath = 'tanks.' + instance + '.currentVolume'
    const derivedFromList = [
      'tanks.' + instance + '.currentLevel',
      'tanks.' + instance + '.capacity'
    ]
    return {
      group: 'tanks',
      optionKey: 'tankVolume2_' + instance,
      title:
        'Tank ' +
        instance +
        ' Volume (alternate currentVolume calculation than one above, select only one calculation per tank.) Uses ',
      derivedFrom: function () {
        return derivedFromList
      },
      calculator: function (level: number, capacity: number) {
        // Guard non-finite sensor inputs so the calculator doesn't
        // surface NaN volumes, matching the pattern used by
        // depthBelowKeel and propslip.
        if (!Number.isFinite(level) || !Number.isFinite(capacity)) {
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
