

module.exports = function(app) {
  return {
    group: 'wind',
    optionKey: 'trueWind2',
    title: "True Wind Angle, Direction and Speed (based on SOG, AWA, AWS and the hope that speed through water = SOG)",
    derivedFrom: [ "navigation.courseOverGroundTrue", "navigation.speedOverGround", "environment.wind.speedApparent", "environment.wind.angleApparent" ],
    calculator: function(cog, sog, aws, awa) {
      var trueX = Math.cos(awa) * aws;
      var trueY = Math.sin(awa) * aws;
      var twa = Math.atan2(trueY, -sog + trueX);
      var tws = Math.sqrt(Math.pow(trueY, 2) + Math.pow(-sog + trueX, 2));

      var dir = cog + twa;

      if ( dir > Math.PI*2 ) {
        dir = dir - Math.PI*2;
      } else if ( dir < 0 ) {
        dir = dir + Math.PI*2;
      }

      return [{ path: "environment.wind.directionTrue", value: dir},
              { path: "environment.wind.angleTrueWater", value: twa},
              { path: "environment.wind.speedTrue", value: tws}]
    }
  };
}
