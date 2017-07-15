const _ = require("lodash")
const debug = require('debug')('signalk-derived-data')
var util = require('util')

module.exports = function(app) {
  //produce enum from propulsion *
  var enumm = _.keys(app.signalk.self['propulsion'])
  if (enumm.length !== 1){
    //prop slip currently only works with single engine installations
  } else {
    var instance = enumm[0]
  }

  return {
    optionKey: "propslip",
    title: "Propeller slip (based on RPM, propulsion.*.transmission.gearRatio and propulsion.*.drive.propeller.pitch)",
    derivedFrom: [ "propulsion." + instance + ".revolutions", "navigation.speedThroughWater"],

    calculator: function(revolutions, stw){
      var addlOption = instance//replace
      var gearRatio = _.get(app.signalk.self, 'propulsion.' + addlOption + '.transmission.gearRatio.value')
      var pitch = _.get(app.signalk.self, 'propulsion.' + addlOption + '.drive.propeller.pitch.value')
      if ( typeof gearRatio !== 'undefined' && typeof pitch!== 'undefined') {
        return [{ path: 'propulsion.' + addlOption + '.drive.propeller.slip', value: 1 - ((stw * gearRatio)/(revolutions*pitch))}]
        //from http://teaguecustommarine.com/teagueblog/how-to-correctly-determine-propeller-slip/ , normalized for SI units
      } else {
        debug("not enough info for prop slip calculation")
        return undefined
      }
    }
  };
}
