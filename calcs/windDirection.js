module.exports = function (app, plugin) {
  return [
    {
      group: 'wind',
      optionKey: 'directionTrue',
      title: 'True Wind Direction (based on AWA and headingTrue)',
      derivedFrom: ['navigation.headingTrue', 'environment.wind.angleApparent'],
      calculator: function (headingTrue, awa) {
        let windHeading = headingTrue + awa

        if (windHeading > Math.PI * 2) windHeading -= Math.PI * 2
        else if (windHeading < 0) windHeading += Math.PI * 2

        return [{ path: 'environment.wind.directionTrue', value: windHeading }]
      }
    },
    {
      group: 'wind',
      optionKey: 'directionMagnetic2',
      title: 'Magnetic Wind Direction (based on AWA and headingMagnetic)',
      derivedFrom: [
        'navigation.headingMagnetic',
        'environment.wind.angleApparent'
      ],
      calculator: function (headingMagnetic, awa) {
        let windHeading = headingMagnetic + awa

        if (windHeading > Math.PI * 2) windHeading -= Math.PI * 2
        else if (windHeading < 0) windHeading += Math.PI * 2

        return [
          { path: 'environment.wind.directionMagnetic', value: windHeading }
        ]
      }
    }
  ]
}
