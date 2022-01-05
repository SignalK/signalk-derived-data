//calculation source: https://arvelgentry.jimdo.com/app/download/9157993883/Arvel+Gentry+-+Sailboat_Performance_Testing_Techniques.pdf?t=1485748085
module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'leeway',
    title: 'Leeway (based on heel angle and STW)',
    derivedFrom: [
      'navigation.attitude',
      'navigation.speedThroughWater'
    ],
    properties: {
      kFactor: {
        type: 'number',
        title:
        'Leeway correlation constant, typically from 9 to 16 (9 for super racer)',
        default: 12
      }
    },
    calculator: function (attitude, stw) {
      if (stw == 0) return  // devision by zero
      var roll = attitude.roll
      var kFactor = plugin.properties.heading.kFactor
      var rollDegrees = roll / Math.PI * 360
      var stwKnots = stw * 1.94384
      var leewayAngle = (kFactor * rollDegrees / ( Math.pow(stwKnots, 2)))/360*Math.PI
      //app.debug('roll: ' + rollDegrees + ' stw: ' + stwKnots + ' knots => leeway: ' + leewayAngle/Math.PI*360)
      return [
        { path: 'performance.leeway', value: leewayAngle }
      ]
    }
  }
}
