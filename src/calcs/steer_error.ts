import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app): Calculation {
  return {
    group: 'course data',
    optionKey: 'steer_error',
    title: 'Estimated steer error and direction =>',
    derivedFrom: [
      'navigation.courseOverGroundTrue',
      'navigation.course.calcValues.bearingTrue'
    ],
    meta: {
      'navigation.courseGreatCircle.nextPoint.steerError': {
        units: 'rad',
        description:
          'Deprecated path: the Course API (navigation.course.*) replaces navigation.courseGreatCircle and has no steer error path. Difference between the course over ground and the bearing to the next point (navigation.course.calcValues.bearingTrue): positive means steer left, negative means steer right.'
      },
      'navigation.courseGreatCircle.nextPoint.leftSteerError': {
        units: 'rad',
        description:
          'Deprecated path: the Course API (navigation.course.*) replaces navigation.courseGreatCircle and has no steer error path. How far to steer left (to port) to bring the course over ground onto the bearing to the next point; 0 when the correction is to the right.'
      },
      'navigation.courseGreatCircle.nextPoint.rightSteerError': {
        units: 'rad',
        description:
          'Deprecated path: the Course API (navigation.course.*) replaces navigation.courseGreatCircle and has no steer error path. How far to steer right (to starboard) to bring the course over ground onto the bearing to the next point; 0 when the correction is to the left.'
      }
    },
    debounceDelay: 200,
    calculator: function (
      courseOverGroundTrue: number,
      bearingToDestinationTrue: number
    ) {
      let steererr: number
      let steer: number | null = null
      let leftSteer: number | null = null
      let rightSteer: number | null = null

      if (
        Number.isFinite(courseOverGroundTrue) &&
        Number.isFinite(bearingToDestinationTrue)
      ) {
        steererr = courseOverGroundTrue - bearingToDestinationTrue
        // Normalise to (-PI, PI]. atan2(sin, cos) handles both the >PI
        // and <-PI wraps with a single expression.
        steer = Math.atan2(Math.sin(steererr), Math.cos(steererr))

        if (steer > 0) {
          ;((leftSteer = steer), (rightSteer = 0))
        } else {
          ;((leftSteer = 0), (rightSteer = steer * -1))
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

module.exports = factory
