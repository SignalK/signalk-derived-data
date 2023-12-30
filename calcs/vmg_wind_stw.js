module.exports = function (app) {
  return {
    group: 'course data',
    optionKey: 'vmg_Wind_STW',
    title:
      'Velocity Made Good to wind (based on wind.angleTrueWater and speedThroughWater)',
    derivedFrom: [
      'environment.wind.angleTrueWater',
      'navigation.speedThroughWater'
    ],
    calculator: function (trueWindAngle, speedThroughWater) {
      var vmg_wind = Math.cos(trueWindAngle) * speedThroughWater
      if (vmg_wind < 0) {
        return [
          { path: 'performance.velocityMadeGood', value: vmg_wind }
        ]
      } else {
        return [
          { path: 'performance.velocityMadeGood', value: vmg_wind }
        ]
      }
    }
  }
}
