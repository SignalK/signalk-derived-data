module.exports = function (app) {
  return {
    group: 'course data',
    optionKey: 'eta_waypoint',
    title: 'Estimated time of arrival at the next waypoint',
    derivedFrom: [
      'navigation.datetime',
      'navigation.courseRhumbline.nextPoint.distance',
      'navigation.courseRhumbline.nextPoint.velocityMadeGood'
    ],
    calculator: function (datetime, distance, velocityMadeGood) {
      var date

      if (datetime && datetime.length > 0) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }

      var datems = date.getTime()
      var timetopoint = Math.floor(distance / velocityMadeGood * 1000)

      //      app.debug(`Using datetime: ${date} ms to point : ${timetopoint} currentms: ${datems}`)
      var etams = datems + timetopoint
      //      app.debug(`eta in ms: ${etams} ms to point : ${timetopoint} currentms: ${datems}`)

      if (velocityMadeGood > 0) {
        var etad = new Date(parseInt(etams))
        var eta = etad.toISOString()
        var ttg = Math.floor(timetopoint / 1000)
      } else {
        var eta = null
        var ttg = null
      }
      //      app.debug(`what is eta: ${eta} etams: ${etams} etad: ${etad}`)

      return [
        {
          path: 'navigation.courseGreatCircle.nextPoint.estimatedTimeOfArrival',
          value: eta
        },
        {
          path: 'navigation.courseGreatCircle.nextPoint.timeToGo',
          value: ttg
        },
        {
          path: 'navigation.courseGreatCircle.nextPoint.eta',
          value: eta
        }
      ]
    },
    tests: [
      {
        input: ['2024-07-12T18:00:00Z', 1000, 2],
        expected: [
          {
            path:
              'navigation.courseGreatCircle.nextPoint.estimatedTimeOfArrival',
            value: '2024-07-12T18:08:20.000Z'
          },
          {
            path: 'navigation.courseGreatCircle.nextPoint.timeToGo',
            value: 500
          },
          {
            path: 'navigation.courseGreatCircle.nextPoint.eta',
            value: '2024-07-12T18:08:20.000Z'
          }
        ]
      }
    ]
  }
}
