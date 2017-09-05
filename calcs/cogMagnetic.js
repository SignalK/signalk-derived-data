
module.exports = function(app) {
  return {
    group: 'navigation',
    optionKey: 'courseOverGroundMagnetic',
    title: "Magneticcog True + Variation. ",
    derivedFrom: [ 'navigation.courseOverGroundTrue', 'navigation.magneticVariation'],
    calculator: function(cogTrue, magneticVariation) {
      var dir = cogTrue + magneticVariation;

      if ( dir > Math.PI*2 ) {
        dir = dir - Math.PI*2;
      } else if ( dir < 0 ) {
        dir = dir + Math.PI*2;
      }
      
      return [{ path: "navigation.courseOverGroundMagnetic", value: dir}]
    }
  };
}
