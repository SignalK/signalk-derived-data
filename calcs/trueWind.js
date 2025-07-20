module.exports = function (app) {
  return {
    group: 'wind',
    optionKey: 'trueWind',
    title: 'True Wind Angle and Speed',
    derivedFrom: [
      'navigation.speedThroughWater',
      'environment.wind.speedApparent',
      'environment.wind.angleApparent'
    ],
    calculator: function (speed, aws, awa) {
      var angle
      var speed

      if (speed == null || aws == null || awa == null) {
        angle = null
        speed = null
      } else {
        var apparentX = Math.cos(awa) * aws
        var apparentY = Math.sin(awa) * aws
        angle = Math.atan2(apparentY, -speed + apparentX)
        speed = Math.sqrt(
          Math.pow(apparentY, 2) + Math.pow(-speed + apparentX, 2)
        )

        if (aws < 1e-9) {
          angle = awa
        }
      }

      return [
        { path: 'environment.wind.angleTrueWater', value: angle },
        { path: 'environment.wind.speedTrue', value: speed }
      ]
    }
  }
}
