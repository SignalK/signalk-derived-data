// calculation source: https://arvelgentry.jimdo.com/app/download/9157993883/Arvel+Gentry+-+Sailboat_Performance_Testing_Techniques.pdf?t=1485748085
module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'leewayAngle',
    title: 'Leeway Angle',
    derivedFrom: ['navigation.headingTrue', 'navigation.courseOverGroundTrue'],
    debounceDelay: 200,
    calculator: function (hdg, cog) {
      let leewayAngle = null
      if (!Number.isFinite(hdg) || !Number.isFinite(cog)) {
        leewayAngle = Math.abs(hdg - cog)
      }
      return [{ path: 'navigation.leewayAngle', value: leewayAngle }]
    }
  }
}
