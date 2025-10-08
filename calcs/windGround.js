const { formatCompassAngle, okToSend } = require('../utils')
const _ = require('lodash')

const selfData = {
  environment: {
    wind: {
      directionTrue: 0.123,
      angleTrueGround: 0.234,
      speedOverGround: 0.2,
      directionGround: 0
    }
  }
}

module.exports = function (app, plugin) {
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
      calculator: function (headTrue, sog, aws, awa) {
        let angle
        let speed
        let dir

        if (
          !_.isFinite(headTrue) ||
          !_.isFinite(sog) ||
          !_.isFinite(aws) ||
          !_.isFinite(awa)
        ) {
          angle = null
          speed = null
          dir = null
        } else {
          const apparentX = Math.cos(awa) * aws
          const apparentY = Math.sin(awa) * aws
          angle = Math.atan2(apparentY, -sog + apparentX)
          speed = Math.sqrt(
            Math.pow(apparentY, 2) + Math.pow(-sog + apparentX, 2)
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
        path = 'environment.wind.angleTrueGround'
        if (okToSend(app, angle, path)) {
          r.push({ path: path, value: angle })
        }
        path = 'environment.wind.speedOverGround'
        if (okToSend(app, speed, path)) {
          r.push({ path: path, value: speed })
        }
        return r
      },
      tests: [
        {
          input: [3, 2, null, null],
          selfData,
          expected: [
            { path: 'environment.wind.directionTrue', value: null },
            { path: 'environment.wind.angleTrueGround', value: null },
            { path: 'environment.wind.speedOverGround', value: null }
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
              path: 'environment.wind.angleTrueGround',
              value: 2.406948646541353
            },
            {
              path: 'environment.wind.speedOverGround',
              value: 0.1481892482444493
            }
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
      calculator: function (headingTrue, gwa) {
        if (!_.isFinite(headingTrue) || !_.isFinite(gwa)) {
          return [{ path: 'environment.wind.directionGround', value: null }]
        }

        const wdg = formatCompassAngle(headingTrue + gwa)

        const r = []
        const path = 'environment.wind.directionGround'
        if (okToSend(app, wdg, path)) {
          r.push({ path: path, value: wdg })
        }
        return r
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
