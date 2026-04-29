import { formatCompassAngle } from '../utils'
import type { Calculation, CalculationFactory } from '../types'

const selfData: Record<string, unknown> = {}

const factory: CalculationFactory = function (_app, _plugin): Calculation[] {
  return [
    {
      group: 'wind',
      optionKey: 'groundWind',
      title: 'Ground Wind Direction Angle and Speed =>',
      derivedFrom: [
        'navigation.headingTrue',
        'navigation.speedOverGround',
        'environment.wind.speedApparent',
        'environment.wind.angleApparent'
      ],
      debounceDelay: 200,
      calculator: function (
        headTrue: number,
        sog: number,
        aws: number,
        awa: number
      ) {
        let angle: number | null
        let speed: number | null
        let dir: number | null

        if (
          !Number.isFinite(headTrue) ||
          !Number.isFinite(sog) ||
          !Number.isFinite(aws) ||
          !Number.isFinite(awa)
        ) {
          angle = null
          speed = null
          dir = null
        } else {
          const apparentX = Math.cos(awa) * aws
          const apparentY = Math.sin(awa) * aws
          const gx = apparentX - sog
          angle = Math.atan2(apparentY, gx)
          speed = Math.sqrt(apparentY * apparentY + gx * gx)
          if (aws < 1e-9) {
            angle = awa
          }

          dir = formatCompassAngle(headTrue + angle)
        }

        return [
          { path: 'environment.wind.directionGround', value: dir },
          { path: 'environment.wind.angleTrueGround', value: angle },
          { path: 'environment.wind.speedOverGround', value: speed }
        ]
      },
      tests: [
        {
          input: [3, 2, null, null],
          selfData,
          expected: [
            { path: 'environment.wind.directionGround', value: null },
            { path: 'environment.wind.angleTrueGround', value: null },
            { path: 'environment.wind.speedOverGround', value: null }
          ]
        }
      ]
    },
    {
      group: 'wind',
      optionKey: 'groundWindDirection',
      title: 'DEPRECATED (use Ground Wind Direction)',
      derivedFrom: [
        'navigation.headingTrue',
        'environment.wind.angleTrueGround'
      ],
      debounceDelay: 200,
      calculator: function (headingTrue: number, gwa: number) {
        if (!Number.isFinite(headingTrue) || !Number.isFinite(gwa)) {
          return [{ path: 'environment.wind.directionGround', value: null }]
        }

        const wdg = formatCompassAngle(headingTrue + gwa)

        return [{ path: 'environment.wind.directionGround', value: wdg }]
      },
      tests: [
        {
          input: [2, null],
          selfData,
          expected: [{ path: 'environment.wind.directionGround', value: null }]
        }
      ]
    }
  ]
}

module.exports = factory
