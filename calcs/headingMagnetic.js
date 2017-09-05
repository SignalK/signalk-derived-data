
module.exports = function(app) {
  return {
    group: 'navigation',
    optionKey: 'magneticHeading',
    title: "Magnetic heading based on True + Variation. ",
    derivedFrom: [ 'navigation.headingTrue', 'navigation.magneticVariation'],
    calculator: function(headTrue, magneticVariation) {
      var dir = headTrue + magneticVariation;

      if ( dir > Math.PI*2 ) {
        dir = dir - Math.PI*2;
      } else if ( dir < 0 ) {
        dir = dir + Math.PI*2;
      }
      
      return [{ path: "navigation.headingMagnetic", value: dir}]
    }
  };
}
