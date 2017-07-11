
module.exports = function(app) {
  return {
    optionKey: 'vmg',
    title: "Velocity Made Goog (based on courseGreatCircle.nextPoint.bearingTrue heading true and speedOverGround)",
    derivedFrom: [ "navigation.courseGreatCircle.nextPoint.bearingTrue",
                   "navigation.headingTrue",
                   "navigation.speedOverGround" ],
    calculator: function (bearingTrue, headingTrue, speedOverGround)
    {
      var angle = Math.abs(bearingTrue-headingTrue)
      return [{ path: "navigation.courseGreatCircle.nextPoint.velocityMadeGood",
                value: Math.cos(bearingTrue-headingTrue) * speedOverGround}]
    }
  };
}
