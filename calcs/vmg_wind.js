module.exports = function (app) {
  return {
    group: 'course data',
    optionKey: 'vmg_Wind',
    title: 'Velocity Made Good to wind (A) =>',
    derivedFrom: [
      'environment.wind.angleTrueWater',
      'navigation.speedOverGround'
    ],
    calculator: function (trueWindAngle, speedOverGround) {
      var vmg_wind = Math.cos(trueWindAngle) * speedOverGround
      return [{ path: 'performance.velocityMadeGood', value: vmg_wind }]
    }
  }
}
