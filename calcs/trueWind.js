module.exports = function (app) {
  return {
    group: 'wind',
    optionKey: 'trueWind',
    title:
      'True Wind Angle, Direction and Speed (based on speed through water, AWA, AWS, headingTrue)',
    derivedFrom: [
      'navigation.headingTrue',
      'navigation.speedThroughWater',
      'environment.wind.speedApparent',
      'environment.wind.angleApparent'
    ],
    calculator: function (headTrue, speed, aws, awa) {
      var apparentX = Math.cos(awa) * aws
      var apparentY = Math.sin(awa) * aws
      var angle = Math.atan2(apparentY, -speed + apparentX)
      var speed = Math.sqrt(
        Math.pow(apparentY, 2) + Math.pow(-speed + apparentX, 2)
      )

      if (aws < 1e-9) {angle = awa}

      var dir = headTrue + angle

      if (dir > Math.PI * 2) {
        dir = dir - Math.PI * 2
      } else if (dir < 0) {
        dir = dir + Math.PI * 2
      }

      return [
        { path: 'environment.wind.directionTrue', value: dir },
        { path: 'environment.wind.angleTrueWater', value: angle },
        { path: 'environment.wind.speedTrue', value: speed }
      ]
    }
  }
}
