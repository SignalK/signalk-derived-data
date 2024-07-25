module.exports = function (app) {
  return {
    group: 'wind',
    optionKey: 'trueWind',
    title: 'True Wind Angle, Direction and Speed',
    derivedFrom: [
      'navigation.headingTrue',
      'navigation.speedThroughWater',
      'environment.wind.speedApparent',
      'environment.wind.angleApparent'
    ],
    calculator: function (headTrue, speed, aws, awa) {
      var angle
      var speed
      var dir

      if (headTrue == null || speed == null || aws == null || awa == null) {
        angle = null
        speed = null
        dir   = null
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

        dir = headTrue + angle

        if (dir > Math.PI * 2) {
          dir = dir - Math.PI * 2
        } else if (dir < 0) {
          dir = dir + Math.PI * 2
        }
      }

      return [
        { path: 'environment.wind.directionTrue', value: dir },
        { path: 'environment.wind.angleTrueWater', value: angle },
        { path: 'environment.wind.speedTrue', value: speed }
      ]
    }
  }
}
