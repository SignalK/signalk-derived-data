

module.exports = function(app, plugin) {
  return {
    group: 'wind',
    optionKey: 'directionMagnetic',
    title: "Magnetic Wind Direction (based on wind.directionTrue and magenticVarition)",
    derivedFrom: [ "environment.wind.directionTrue", "navigation.magneticVariation" ],
    calculator: function(directionTrue, magneticVariation) {
      return [{ path: "environment.wind.directionMagnetic", value: directionTrue - magneticVariation}]
    }
  };
}
