const _ = require("lodash")
const debug = require('debug')('signalk-derived-data')

module.exports = function(app, plugin) {
  //produce enum from propulsion *
  var enumm = _.keys(app.signalk.self['propulsion'])
  if (enumm.length === 1){
    enumm[1] = "none" //need to fill enumm
  }
  if (enumm.length === 0){
    enumm[0] = enumm[1] = "none" //no propulsion instances to choose from, still need to fill enumm
  }

  return {
    group: 'propulsion',
    optionKey: "propslip",
    title: "Propeller slip (based on RPM, propulsion.*.transmission.gearRatio and propulsion.*.drive.propeller.pitch)",
    derivedFrom: function(){ return [ "propulsion." + plugin.properties.prop_instance + ".revolutions", "navigation.speedThroughWater"] },
    properties: {
      prop_instance: {
        type: "string",
        title: "Propulsion Instance (one at a time currently)",
        "enum": enumm
      }
    },

    calculator: function(revolutions, stw){
      var inst = plugin.properties.prop_instance
      var gearRatio = _.get(app.signalk.self, 'propulsion.' + inst + '.transmission.gearRatio.value')
      var pitch = _.get(app.signalk.self, 'propulsion.' + inst + '.drive.propeller.pitch.value')
      if ( typeof gearRatio !== 'undefined' && typeof pitch!== 'undefined') {
        return [{ path: 'propulsion.' + inst + '.drive.propeller.slip', value: 1 - ((stw * gearRatio)/(revolutions*pitch))}]
        //from http://teaguecustommarine.com/teagueblog/how-to-correctly-determine-propeller-slip/ , normalized for SI units
      } else {
        debug("not enough info for prop slip calculation")
        return undefined
      }
    }
  };
}
