
module.exports = function(app, plugin) {
  return {
    group: 'wind',
    optionKey: 'groundWind',
    title: "Ground Wind Angle and Speed (based on SOG, AWA and AWS)",
    derivedFrom: [ "navigation.speedOverGround", "environment.wind.speedApparent", "environment.wind.angleApparent" ],
    calculator: function(sog, aws, awa) {
      var apparentX = Math.cos(awa) * aws;
      var apparentY = Math.sin(awa) * aws;
      var angle = Math.atan2(apparentY, -sog + apparentX);
      var speed = Math.sqrt(Math.pow(apparentY, 2) + Math.pow(-sog + apparentX, 2));
      return [{ path: "environment.wind.angleTrueGround", value: angle},
              { path: "environment.wind.speedOverGround", value: speed}]
    }
  };
}
