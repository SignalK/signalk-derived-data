const _ = require("lodash")

module.exports = function(app, plugin) {
  var propulsionInstances

  if ( app.getSelfPath("propulsion") )
  {
    propulsionInstances = _.keys(app.signalk.self['propulsion'])

    return propulsionInstances.map(instance => {
      return {
        group: 'propulsion',
        optionKey: 'propslip' + instance,
        title: "propulsion." + instance + ".slip (based on RPM, propulsion." + instance + ".transmission.gearRatio and propulsion." + instance + ".drive.propeller.pitch)",
        derivedFrom: function() { return [ "propulsion." + instance + ".revolutions", "navigation.speedThroughWater"] },
        calculator: function(revolutions, stw) {
          var gearRatio = app.getSelfPath('propulsion.' + instance + '.transmission.gearRatio.value')
          var pitch = app.getSelfPath('propulsion.' + instance + '.drive.propeller.pitch.value')
          return [{ path: 'propulsion.' + instance + '.drive.propeller.slip', value: 1 - ((stw * gearRatio)/(revolutions*pitch))}]
        }
      }
    });
  } else {
    return {
      optionKey: 'propslip',
      title: "propulsion.*.slip (will not work without RPM, propulsion.*.transmission.gearRatio and propulsion.*.drive.propeller.pitch, the two latter inserted in defaults.json)"
    }
  }
}
