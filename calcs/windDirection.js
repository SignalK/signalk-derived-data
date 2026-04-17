const { formatCompassAngle } = require('../utils')

const selfData = {}

module.exports = function (app, plugin) {
  return [
    {
      group: 'wind',
      optionKey: 'directionMagnetic2',
      title: 'Magnetic Wind Direction (A) =>',
      derivedFrom: [
        'navigation.headingMagnetic',
        'environment.wind.angleApparent'
      ],
      calculator: function (headingMagnetic, awa) {
        if (!Number.isFinite(headingMagnetic) || !Number.isFinite(awa)) {
          return [{ path: 'environment.wind.directionMagnetic', value: null }]
        }

        const twd = formatCompassAngle(headingMagnetic + awa)

        return [{ path: 'environment.wind.directionMagnetic', value: twd }]
      },
      tests: [
        {
          input: [null, 2],
          selfData,
          expected: [
            {
              path: 'environment.wind.directionMagnetic',
              value: null
            }
          ]
        },
        {
          input: [2.17, 0.13],
          selfData,
          expected: [
            {
              path: 'environment.wind.directionMagnetic',
              value: 2.3
            }
          ]
        }
      ]
    },
    {
      group: 'wind',
      optionKey: 'directionMagnetic',
      title: 'Magnetic Wind Direction (B) =>',
      derivedFrom: [
        'environment.wind.directionTrue',
        'navigation.magneticVariation'
      ],
      calculator: function (directionTrue, magneticVariation) {
        if (
          !Number.isFinite(directionTrue) ||
          !Number.isFinite(magneticVariation)
        ) {
          return [{ path: 'environment.wind.directionMagnetic', value: null }]
        }

        const directionMagnetic = formatCompassAngle(
          directionTrue - magneticVariation
        )

        return [
          {
            path: 'environment.wind.directionMagnetic',
            value: directionMagnetic
          }
        ]
      },
      tests: [
        {
          input: [null, -0.01],
          expected: [
            { path: 'environment.wind.directionMagnetic', value: null }
          ]
        },
        {
          input: [0.2, null],
          expected: [
            { path: 'environment.wind.directionMagnetic', value: null }
          ]
        },
        {
          input: [0.8, -0.01],
          expected: [
            { path: 'environment.wind.directionMagnetic', value: 0.81 }
          ]
        },
        {
          input: [-0.8, -0.01],
          expected: [
            {
              path: 'environment.wind.directionMagnetic',
              value: 5.493185307179586
            }
          ]
        }
      ]
    },
    {
      group: 'wind',
      optionKey: 'angleTrueWater',
      title: 'True Wind Angle and Speed =>',
      derivedFrom: [
        'navigation.speedThroughWater',
        'environment.wind.speedApparent',
        'environment.wind.angleApparent'
      ],
      calculator: function (stw, aws, awa) {
        let angle
        let speed

        if (
          !Number.isFinite(stw) ||
          !Number.isFinite(aws) ||
          !Number.isFinite(awa)
        ) {
          angle = null
          speed = null
        } else {
          const apparentX = Math.cos(awa) * aws
          const apparentY = Math.sin(awa) * aws
          const gx = apparentX - stw
          angle = Math.atan2(apparentY, gx)
          speed = Math.sqrt(apparentY * apparentY + gx * gx)
          if (aws < 1e-9) {
            angle = awa
          }
        }

        return [
          { path: 'environment.wind.angleTrueWater', value: angle },
          { path: 'environment.wind.speedTrue', value: speed }
        ]
      },
      tests: [
        {
          input: [null, null, null],
          selfData,
          expected: [
            { path: 'environment.wind.angleTrueWater', value: null },
            { path: 'environment.wind.speedTrue', value: null }
          ]
        },
        {
          input: [3.0, 5.0, 0.5],
          selfData,
          expected: [
            {
              path: 'environment.wind.angleTrueWater',
              value: 1.0459686742419587
            },
            { path: 'environment.wind.speedTrue', value: 2.769931974487608 }
          ]
        }
      ]
    },
    {
      group: 'wind',
      optionKey: 'directionTrue',
      title: 'True Wind Direction =>',
      derivedFrom: [
        'navigation.headingTrue',
        'environment.wind.angleTrueWater'
      ],
      calculator: function (headingTrue, twa) {
        if (!Number.isFinite(headingTrue) || !Number.isFinite(twa)) {
          return [{ path: 'environment.wind.directionTrue', value: null }]
        }

        const twd = formatCompassAngle(headingTrue + twa)

        return [{ path: 'environment.wind.directionTrue', value: twd }]
      },
      tests: [
        {
          input: [null, 1.0],
          selfData,
          expected: [{ path: 'environment.wind.directionTrue', value: null }]
        },
        {
          input: [1.0, null],
          selfData,
          expected: [{ path: 'environment.wind.directionTrue', value: null }]
        },
        {
          input: [1.0, 1.0459686742419587],
          selfData,
          expected: [
            {
              path: 'environment.wind.directionTrue',
              value: 2.0459686742419585
            }
          ]
        }
      ]
    }
  ]
}
