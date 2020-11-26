module.exports = function (app) {
  return {
    group: 'course data',
    optionKey: 'vmg_Wind',
    title:
      'Velocity Made Good to wind (based on wind.angleTrueWater and speedOverGround)',
    derivedFrom: [
      'environment.wind.angleTrueWater',
      'navigation.speedOverGround'
    ],
    calculator: function (trueWindAngle, speedOverGround) {
      var vmg_wind = Math.cos(trueWindAngle) * speedOverGround
      if (vmg_wind < 0) {
        return [
          { path: 'performance.velocityMadeGood', value: vmg_wind },
          { path: 'performance.gybeAngleVelocityMadeGood', value: vmg_wind }
        ]
      } else {
        return [
          { path: 'performance.velocityMadeGood', value: vmg_wind },
          { path: 'performance.beatAngleVelocityMadeGood', value: vmg_wind }
        ]
      }
    }
  }
}
