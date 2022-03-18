module.exports = function (app, plugin) {
  return [
    {
      group: 'wind',
      optionKey: 'groundWind',
      title: 'Ground Wind Angle and Speed (based on SOG, AWA and AWS)',
      derivedFrom: [
        'navigation.speedOverGround',
        'environment.wind.speedApparent',
        'environment.wind.angleApparent'
      ],
      calculator: function (sog, aws, awa) {
        var apparentX = Math.cos(awa) * aws
        var apparentY = Math.sin(awa) * aws
        var angle = Math.atan2(apparentY, -sog + apparentX)
        var speed = Math.sqrt(
          Math.pow(apparentY, 2) + Math.pow(-sog + apparentX, 2)
        )

        if (aws < 1e-9) {
          angle = awa
        }

        return [
          { path: 'environment.wind.angleTrueGround', value: angle },
          { path: 'environment.wind.speedOverGround', value: speed }
        ]
      }
    },
    {
      group: 'wind',
      optionKey: 'groundWindDirection',
      title:
        'DEPRECATED env.wind.directionGround (based on headingTrue and GWA)',
      derivedFrom: [
        'navigation.headingTrue',
        'environment.wind.angleTrueGround'
      ],
      calculator: function (headingTrue, gwa) {
        let windHeading = headingTrue + gwa

        if (windHeading > Math.PI * 2) windHeading -= Math.PI * 2
        else if (windHeading < 0) windHeading += Math.PI * 2

        return [
          { path: 'environment.wind.directionGround', value: windHeading }
        ]
      }
    },
    {
      group: 'wind',
      optionKey: 'groundWindDirection2',
      title:
        'Ground Wind Direction (based on headingTrue and GWA, env.wind.directionTrue)',
      derivedFrom: [
        'navigation.headingTrue',
        'environment.wind.angleTrueGround'
      ],
      calculator: function (headingTrue, gwa) {
        let windHeading = headingTrue + gwa

        if (windHeading > Math.PI * 2) windHeading -= Math.PI * 2
        else if (windHeading < 0) windHeading += Math.PI * 2

        return [{ path: 'environment.wind.directionTrue', value: windHeading }]
      }
    }
  ]
}
