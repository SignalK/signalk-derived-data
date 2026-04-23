import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app, plugin): Calculation {
  return {
    group: 'course data',
    optionKey: 'vmg_Wind',
    title: 'Velocity Made Good to wind (A) =>',
    derivedFrom: [
      'environment.wind.angleTrueWater',
      'navigation.speedOverGround'
    ],
    debounceDelay: 200,
    calculator: function (trueWindAngle: number, speedOverGround: number) {
      const vmg_wind = Math.cos(trueWindAngle) * speedOverGround
      const vmgPath =
        plugin.vmgType === 'both'
          ? 'performance.velocityMadeGoodGround'
          : 'performance.velocityMadeGood'
      return [{ path: vmgPath, value: vmg_wind }]
    }
  }
}

module.exports = factory
