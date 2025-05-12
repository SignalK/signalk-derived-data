const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'course data',
    optionKey: 'setDrift',
    title: 'Set and Drift',
    derivedFrom: [
      'navigation.headingMagnetic',
      'navigation.courseOverGroundTrue',
      'navigation.speedThroughWater',
      'navigation.speedOverGround',
      'navigation.magneticVariation'
    ],
    defaults: [undefined, undefined, undefined, undefined, 9999],
    calculator: function (
      headingMagnetic,
      courseOverGroundTrue,
      speedThroughWater,
      speedOverGround,
      magneticVariation
    ) {
      if (magneticVariation === 9999) {
        magneticVariation = app.getSelfPath(
          'navigation.magneticVariation.value'
        )
      }

      let drift = 0
      let setMagnetic = 0

      if (speedOverGround !== 0 || speedThroughWater !== 0) {
        const delta = courseOverGroundTrue - headingMagnetic
        drift = Math.sqrt(
          speedOverGround ** 2 +
            speedThroughWater ** 2 -
            2 * speedThroughWater * speedOverGround * Math.cos(delta)
        )
        setMagnetic =
          Math.PI -
          Math.atan2(
            speedOverGround * Math.sin(delta),
            speedThroughWater - speedOverGround * Math.cos(delta)
          )

        if (setMagnetic < 0) {
          setMagnetic += 2 * Math.PI
        }
      }

      var setTrue = setMagnetic + magneticVariation
      if (_.isUndefined(magneticVariation) || magneticVariation === null) {
        setTrue = null
      } else if (setTrue >= 2 * Math.PI) {
        setTrue = setTrue - Math.PI * 2
      } else if (setTrue < 0) {
        setTrue = setTrue + Math.PI * 2
      }

      return [
        { path: 'environment.current.drift', value: drift },
        { path: 'environment.current.setTrue', value: setTrue },
        { path: 'environment.current.setMagnetic', value: setMagnetic }
      ]
    },
    tests: [
      {
        input: [0.1, 0.2, 5, 4.5, null],
        expected: [
          { path: 'environment.current.drift', value: 0.6890664427243886 },
          {
            path: 'environment.current.setTrue',
            value: null
          },
          {
            path: 'environment.current.setMagnetic',
            value: 3.0482899952302343
          }
        ]
      }
    ]
  }
}
