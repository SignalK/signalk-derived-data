const { formatCompassAngle } = require('../utils')
const _ = require('lodash')

const selfData = {}

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

          dir = formatCompassAngle(headingTrue + angle)
        }

        return [
          { path: 'environment.wind.directionTrue', value: dir },
          { path: 'environment.wind.angleTrueGround', value: angle },
          { path: 'environment.wind.speedOverGround', value: speed }
        ]
      },
      tests: [
        {
          input: [2, null, null],
          selfData,
          expected: [
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
      calculator: function (headingTrue, gwa) {
        if (!_.isFinite(headingTrue) || !_.isFinite(gwa)) {
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
