
module.exports = function(app, plugin) {
  return [
    {
      group: 'wind',
      optionKey: 'directionTrue',
      title: "True Wind Direction (based on AWA and headingTrue)",
      derivedFrom: [ "navigation.headingTrue", "environment.wind.angleApparent" ],
      calculator: function(headingTrue, awa) {
        
        let windHeading = headingTrue + awa;
        
        if ( windHeading > 360 )
	  windHeading -= 360.0;
        else if ( windHeading < 0 )
	  windHeading += 360;
        
        return [{ path: "environment.wind.directionTrue", value: windHeading}]
      }
    }, {
      group: 'wind',
      optionKey: 'directionMagnetic2',
      title: "Magnetic Wind Direction (based on AWA and headingMagnetic)",
      derivedFrom: [ "navigation.headingMagnetic", "environment.wind.angleApparent" ],
      calculator: function(headingMagnetic, awa) {
        
        let windHeading = headingMagnetic + awa;
        
        if ( windHeading > 360 )
	  windHeading -= 360.0;
        else if ( windHeading < 0 )
	windHeading += 360;
        
        return [{ path: "environment.wind.directionMagnetic", value: windHeading}]
      }
    }
  ]
}
