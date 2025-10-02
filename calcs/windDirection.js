const { formatCompassAngle } = require('../utils')
const _ = require('lodash')

const selfData = {}

module.exports = function (app, plugin) {
  return [
    {
      group: 'wind',
      optionKey: 'directionTrue',
      title: 'True Wind Direction (directionTrue)',
      derivedFrom: [
        'navigation.headingTrue',
        'environment.wind.angleTrueWater'
      ],
      calculator: function (headingTrue, twa) {
        if (!_.isFinite(headingTrue) || !_.isFinite(twa)) {
          return [{ path: 'environment.wind.directionTrue', value: null }]
        }

        const twd = formatCompassAngle(headingTrue + twa)

        return [{ path: 'environment.wind.directionTrue', value: twd }]
      },
      tests: [
        {
          input: [null, 2],
          selfData,
          expected: [
            {
              path: 'environment.wind.directionTrue',
              value: null
            }
          ]
        },
        {
          input: [2.17, 0.13],
          selfData,
          expected: [
            {
              path: 'environment.wind.directionTrue',
              value: 2.3
            }
          ]
        }
      ]
    },
    {
      group: 'wind',
      optionKey: 'trueWind',
      title: 'True Wind Angle and Speed (angleTrueWater)',
      derivedFrom: [
        'navigation.speedThroughWater',
        'environment.wind.speedApparent',
        'environment.wind.angleApparent'
      ],
      calculator: function (stw, aws, awa) {
        let angle
        let speed

        if (!_.isFinite(stw) || !_.isFinite(aws) || !_.isFinite(awa)) {
          angle = null
          speed = null
        } else {
          const apparentX = Math.cos(awa) * aws
          const apparentY = Math.sin(awa) * aws
          angle = Math.atan2(apparentY, -stw + apparentX)
          speed = Math.sqrt(
            Math.pow(apparentY, 2) + Math.pow(-stw + apparentX, 2)
          )
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
          input: [2, null, null],
          selfData,
          expected: [
            { path: 'environment.wind.angleTrueWater', value: null },
            { path: 'environment.wind.speedTrue', value: null }
          ]
        }
      ]
    },
    {
      group: 'wind',
      optionKey: 'directionMagnetic2',
      title: 'Magnetic Wind Direction (A) =>',
      derivedFrom: [
        'navigation.headingMagnetic',
        'environment.wind.angleApparent'
      ],
      calculator: function (headingMagnetic, awa) {
        if (!_.isFinite(headingMagnetic) || !_.isFinite(awa)) {
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
        if (!_.isFinite(directionTrue) || !_.isFinite(magneticVariation)) {
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
    }
  ]
}
