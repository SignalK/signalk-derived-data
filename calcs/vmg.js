module.exports = function (app) {
  return {
    group: 'course data',
    optionKey: 'vmg_Course',
    title: 'Velocity Made Good towards next waypoint',
    derivedFrom: [
      'navigation.courseGreatCircle.nextPoint.bearingTrue',
      'navigation.courseOverGroundTrue',
      'navigation.speedOverGround'
    ],
    calculator: function (bearingTrue, cogTrue, speedOverGround) {
      return [
        {
          path: 'navigation.courseGreatCircle.nextPoint.velocityMadeGood',
          value: Math.cos(bearingTrue - cogTrue) * speedOverGround
        }
      ]
    }
  }
}
