

module.exports = function(app) {
  return {
    optionKey: 'trueWind',
    title: "True Wind Angle and Speed (based on speed through water, AWA and AWS)",
    derivedFrom: [ "navigation.headingTrue", "navigation.speedThroughWater", "environment.wind.speedApparent", "environment.wind.angleApparent" ],
    calculator: function(headTrue, speed, aws, awa) {
      var apparentX = Math.cos(awa) * aws;
      var apparentY = Math.sin(awa) * aws;
      var angle = Math.atan2(apparentY, -speed + apparentX);
      var speed = Math.sqrt(Math.pow(apparentY, 2) + Math.pow(-speed + apparentX, 2));
      
      angle = headTrue + angle
      
      return [{ path: "environment.wind.directionTrue", value: angle},
            { path: "environment.wind.speedTrue", value: speed}]
    }
  };
}
