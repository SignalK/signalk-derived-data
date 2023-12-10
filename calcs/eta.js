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
      var timetopoint = Math.floor(
        distance / (velocityMadeGood * 0.514444) * 1000
      )

      //      app.debug(`Using datetime: ${date} ms to point : ${timetopoint} currentms: ${datems}`)
      var etams = datems + timetopoint
      //      app.debug(`eta in ms: ${etams} ms to point : ${timetopoint} currentms: ${datems}`)

      if (velocityMadeGood > 0) {
        var etad = new Date(parseInt(etams))
        var eta = etad.toISOString()
        seconds = Math.floor((timetopoint / 1000) % 60),
        minutes = Math.floor((timetopoint / (1000 * 60)) % 60),
        hours = Math.floor((timetopoint / (1000 * 60 * 60)) % 24);

                hours = (hours < 10) ? "0" + hours : hours;
                minutes = (minutes < 10) ? "0" + minutes : minutes;
                seconds = (seconds < 10) ? "0" + seconds : seconds;

                var hms = hours + ":" + minutes + ":" + seconds;
      } else {
        var eta = null
        var hms = '--'
      }
      app.debug(`what is eta: ${eta} etams: ${etams} etad: ${etad}`)

      return [
        {
          path: 'navigation.courseGreatCircle.nextPoint.estimatedTimeOfArrival',
          value: eta
        },
        {
          path: 'navigation.courseGreatCircle.nextPoint.TimeToArrival',
          value: hms
        },
        {
          path: 'navigation.courseGreatCircle.nextPoint.eta',
          value: eta
        }
      ]
    }
  }
}
