module.exports = function (app) {
  return {
    group: 'course data',
    optionKey: 'steer_error',
    title: 'Estimated steer error and direction',
    derivedFrom: [
      'navigation.courseOverGroundTrue',
      'navigation.courseRhumbline.bearingToDestinationTrue'
    ],
    calculator: function (courseOverGroundTrue, bearingToDestinationTrue) {
      var steererr
      var steer
      var leftSteer
      var rightSteer

      steererr = courseOverGroundTrue - bearingToDestinationTrue
      if (steererr > 3.14159265359) {
        steer = (steererr - 3.14159265359) * -1
      } else if (steererr < -3.14159265359) {
        steer = (steererr + 3.14159265359) * -1
      } else {
        steer = steererr
      }

      if (steer > 0) {
        ;(leftSteer = steer), (rightSteer = 0)
      } else {
        ;(leftSteer = 0), (rightSteer = steer * -1)
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
