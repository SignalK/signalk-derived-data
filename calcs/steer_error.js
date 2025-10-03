const _ = require('lodash')

module.exports = function (app) {
  return {
    group: 'course data',
    optionKey: 'steer_error',
    title: 'Estimated steer error and direction =>',
    derivedFrom: [
      'navigation.courseOverGroundTrue',
      'navigation.course.calcValues.bearingTrue'
    ],
    calculator: function (courseOverGroundTrue, bearingToDestinationTrue) {
      let steererr
      let steer = null
      let leftSteer = null
      let rightSteer = null

      if (
        _.isFinite(courseOverGroundTrue) &&
        _.isFinite(bearingToDestinationTrue)
      ) {
        steererr = courseOverGroundTrue - bearingToDestinationTrue
        if (steererr > Math.PI) {
          steer = (steererr - Math.PI) * -1
        } else if (steererr < -Math.PI) {
          steer = (steererr + Math.PI) * -1
        } else {
          steer = steererr
        }

        if (steer > 0) {
          ;(leftSteer = steer), (rightSteer = 0)
        } else {
          ;(leftSteer = 0), (rightSteer = steer * -1)
        }
      }

      app.debug(
        `steer: ${steer} leftSteer: ${leftSteer} rightSteer: ${rightSteer}`
      )

      return [
        {
          path: 'navigation.courseGreatCircle.nextPoint.steerError',
          value: steer
        },
        {
          path: 'navigation.courseGreatCircle.nextPoint.leftSteerError',
          value: leftSteer
        },
        {
          path: 'navigation.courseGreatCircle.nextPoint.rightSteerError',
          value: rightSteer
        }
      ]
    }
  }
}
