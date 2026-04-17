// calculation source: https://arvelgentry.jimdo.com/app/download/9157993883/Arvel+Gentry+-+Sailboat_Performance_Testing_Techniques.pdf?t=1485748085
const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'leewayAngle',
    title: 'Leeway Angle',
    derivedFrom: ['navigation.headingTrue', 'navigation.courseOverGroundTrue'],
    calculator: function (hdg, cog) {
      let leewayAngle = null
      if (_.isFinite(hdg) && _.isFinite(cog)) {
        // Circular subtraction preserves the sign (positive to
        // starboard, negative to port) and handles the 0/2*PI wrap.
        const delta = hdg - cog
        leewayAngle = Math.atan2(Math.sin(delta), Math.cos(delta))
      }
      return [{ path: 'navigation.leewayAngle', value: leewayAngle }]
    }
  }
}
