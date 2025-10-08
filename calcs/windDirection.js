const { formatCompassAngle, okToSend } = require('../utils')
const _ = require('lodash')

const selfData = {
  environment: {
    wind: {
      directionTrue: 0.123,
      directionMagnetic: 0.234,
      angleTrueWater: 0.1,
      speedTrue: 0.2
    }
  }
}

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
        if (!_.isFinite(headingMagnetic) || !_.isFinite(awa)) {
          return [{ path: 'environment.wind.directionMagnetic', value: null }]
        }

        const mwd = formatCompassAngle(headingMagnetic + awa)

        const r = []
        const path = 'environment.wind.directionMagnetic'
        if (okToSend(app, mwd, path)) {
          r.push({ path: path, value: mwd })
        }
        return r
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

        const mwd = formatCompassAngle(directionTrue - magneticVariation)

        const r = []
        const path = 'environment.wind.directionMagnetic'
        if (okToSend(app, mwd, path)) {
          r.push({ path: path, value: mwd })
        }
        return r
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
      optionKey: 'trueWind',
      title: 'True Wind Direction, Angle and Speed =>',
      derivedFrom: [
        'navigation.headingTrue',
        'navigation.speedThroughWater',
        'environment.wind.speedApparent',
        'environment.wind.angleApparent'
      ],
      calculator: function (headTrue, stw, aws, awa) {
        let angle
        let speed
        let dir

        if (
          !_.isFinite(headTrue) ||
          !_.isFinite(stw) ||
          !_.isFinite(aws) ||
          !_.isFinite(awa)
        ) {
          angle = null
          speed = null
          dir = null
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

          dir = formatCompassAngle(headTrue + angle)
        }

        const r = []
        let path = 'environment.wind.directionTrue'
        if (okToSend(app, dir, path)) {
          r.push({ path: path, value: dir })
        }
        path = 'environment.wind.angleTrueWater'
        if (okToSend(app, angle, path)) {
          r.push({ path: path, value: angle })
        }
        path = 'environment.wind.speedTrue'
        if (okToSend(app, speed, path)) {
          r.push({ path: path, value: speed })
        }
        return r
      },
      tests: [
        {
          input: [2, null, null, 1],
          selfData,
          expected: [
            { path: 'environment.wind.directionTrue', value: null },
            { path: 'environment.wind.angleTrueWater', value: null },
            { path: 'environment.wind.speedTrue', value: null }
          ]
        },
        {
          input: [1.1, 0.6, 0.5, 0.2],
          selfData,
          expected: [
            {
              path: 'environment.wind.directionTrue',
              value: 3.5069486465413533
            },
            {
              path: 'environment.wind.angleTrueWater',
              value: 2.406948646541353
            },
            { path: 'environment.wind.speedTrue', value: 0.1481892482444493 }
          ]
        }
      ]
    }
  ]
}
