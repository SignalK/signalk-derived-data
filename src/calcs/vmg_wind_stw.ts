import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app): Calculation {
  return {
    group: 'course data',
    optionKey: 'vmg_Wind_STW',
    title: 'Velocity Made Good to wind (B) =>',
    derivedFrom: [
      'environment.wind.angleTrueWater',
      'navigation.speedThroughWater'
    ],
    debounceDelay: 200,
    calculator: function (angleTrueWater: number, speedThroughWater: number) {
      return [
        {
          path: 'performance.velocityMadeGood',
          value: Math.cos(angleTrueWater) * speedThroughWater
        }
      ]
    }
  }
}

module.exports = factory
