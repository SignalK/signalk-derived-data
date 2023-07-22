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
      if (speedOverGround == 0 && speedThroughWater == 0) {
        var drift = 0
        var setMagnetic = 0
      } else {
        var drift = Math.sqrt(
          speedOverGround ** 2 +
            speedThroughWater ** 2 -
            2 *
              speedThroughWater *
              speedOverGround *
              Math.cos(courseOverGroundTrue - headingMagnetic)
        )
        var setMagnetic =
          Math.PI -
          Math.atan2(
            speedOverGround * Math.sin(courseOverGroundTrue - headingMagnetic),
            speedThroughWater -
              courseOverGroundTrue *
                Math.cos(courseOverGroundTrue - headingMagnetic)
          )

        if (setMagnetic < 0) {
          setMagnetic = setMagnetic + Math.PI * 2
        }
      }

      var setTrue = setMagnetic + magneticVariation
      if (_.isUndefined(magneticVariation)) {
        setTrue = null
      } else if (setTrue >= 2 * Math.Pi) {
        setTrue = setTrue - Math.PI * 2
      } else if (setTrue < 0) {
        setTrue = setTrue + Math.PI * 2
      }

      return [
        { path: 'environment.current.drift', value: drift },
        { path: 'environment.current.setTrue', value: setTrue },
        { path: 'environment.current.setMagnetic', value: setMagnetic }
      ]
    }
  }
}
