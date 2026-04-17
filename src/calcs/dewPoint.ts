import type { Calculation, CalculationFactory } from '../types'

const selfData: Record<string, unknown> = {}

const factory: CalculationFactory = function (_app, plugin): Calculation[] {
  return (plugin.air ?? []).map((instance): Calculation => {
    const dewPointPath = 'environment.' + instance + '.dewPointTemperature'
    const derivedFromList = [
      'environment.' + instance + '.temperature',
      'environment.' + instance + '.humidity'
    ]
    return {
      group: 'air',
      optionKey: instance + 'dewPoint',
      title: instance + 'Air dewpoint temperature',
      derivedFrom: function () {
        return derivedFromList
      },
      calculator: function (temp: number, hum: number) {
        let dewPoint: number | null = null
        if (Number.isFinite(temp) && Number.isFinite(hum)) {
          // Magnus formula:
          const tempC = temp - 273.15
          const b = 17.625
          const c = 243.04
          const magnus = Math.log(hum) + (b * tempC) / (c + tempC)
          dewPoint = (c * magnus) / (b - magnus) + 273.15
        }
        return [
          {
            path: dewPointPath,
            value: dewPoint
          }
        ]
      },
      tests: [
        {
          input: [null, 0.6],
          selfData,
          expected: [
            {
              path: 'environment.outside.dewPointTemperature',
              value: null
            }
          ]
        },
        {
          input: [298.15, 0.6],
          selfData,
          expected: [
            {
              path: 'environment.outside.dewPointTemperature',
              value: 289.8476635212129
            }
          ]
        }
      ]
    }
  })
}

module.exports = factory
