const debug = require('debug')('signalk-derived-data')

module.exports = function(app, plugin) {
  return {
    group: 'wind',
    optionKey: 'groundWind',
    title: "Ground Wind Angle and Speed (based on SOG, AWA and AWS)",
    derivedFrom: [ "navigation.courseOverGround", "navigation.speedOverGround", "environment.wind.speedApparent", "environment.wind.angleApparent" ],
    calculator: function(cog, sog, aws, awa) {
      var apparentX = Math.cos(awa) * aws;
      var apparentY = Math.sin(awa) * aws;
      var angle = Math.atan2(apparentY, -sog + apparentX);
      var speed = Math.sqrt(Math.pow(apparentY, 2) + Math.pow(-sog + apparentX, 2));
      if ( speed > 100 ) {
        console.log("Speed > 100 ", sog, aws, awa, apparentX, apparentY,  angle,  speed);
      }
       var dir = cog + angle

      if ( dir > Math.PI*2 ) {
        dir = dir - Math.PI*2;
      } else if ( dir < 0 ) {
        dir = dir + Math.PI*2;
      }
      return [{ path: "environment.wind.directionGround", value: dir},
              { path: "environment.wind.angleGround", value: angle},
              { path: "environment.wind.speedGround", value: speed}]
    }
  };
}
