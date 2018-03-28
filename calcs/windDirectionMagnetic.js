

module.exports = function(app, plugin) {
  return {
    group: 'wind',
    optionKey: 'directionMagnetic',
    title: "Magnetic Wind Direction (based on wind.directionTrue and magneticVariation)",
    derivedFrom: [ "environment.wind.directionTrue", "navigation.magneticVariation" ],
    calculator: function (directionTrue, magneticVariation) {
        var directionMagnetic
        if (magneticVariation < 0) {
            directionMagnetic = directionTrue + Math.abs(magneticVariation)
        }
        else {
            directionMagnetic = directionTrue - magneticVariation
        }
      
      if ( directionMagnetic < 0 ) {
        directionMagnetic = (Math.PI*2) + directionMagnetic
      } else if ( directionMagnetic > (Math.PI*2) ) {
        directionMagnetic = directionMagnetic - (Math.PI*2)
      }
      return [{ path: "environment.wind.directionMagnetic", value: directionMagnetic}]
    }
  };
}
