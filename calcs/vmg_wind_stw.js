module.exports = function (app) {
  return {
    group: 'course data',
    optionKey: 'vmg_Wind_STW',
    title: 'Velocity Made Good to wind (B) =>',
    derivedFrom: [
      'environment.wind.angleTrueWater',
      'navigation.speedThroughWater'
    ],
    calculator: function (angleTrueWater, speedThroughWater) {
      return [
        {
          path: 'performance.velocityMadeGood',
          value: Math.cos(angleTrueWater) * speedThroughWater
        }
      ]
    }
  }
}
