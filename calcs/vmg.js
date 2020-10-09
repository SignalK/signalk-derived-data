module.exports = function (app) {
  return {
    group: 'course data',
    optionKey: 'vmg_Course',
    title:
      'Velocity Made Good to Course (based on courseGreatCircle.nextPoint.bearingTrue heading true and speedOverGround)',
    derivedFrom: [
      'navigation.courseGreatCircle.nextPoint.bearingTrue',
      'navigation.headingTrue',
      'navigation.speedOverGround'
    ],
    calculator: function (bearingTrue, headingTrue, speedOverGround) {
      var angle = Math.abs(bearingTrue - headingTrue)
      return [
        {
          path: 'navigation.courseGreatCircle.nextPoint.velocityMadeGood',
          value: Math.cos(bearingTrue - headingTrue) * speedOverGround
        }
      ]
    }
  }
}
