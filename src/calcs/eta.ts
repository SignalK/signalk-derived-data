import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app): Calculation {
  return {
    group: 'course data',
    optionKey: 'eta_waypoint',
    title:
      'DEPRECATED (use course-provider) Estimated time of arrival at the next waypoint',
    derivedFrom: [
      'navigation.datetime',
      'navigation.courseRhumbline.nextPoint.distance',
      'navigation.courseRhumbline.nextPoint.velocityMadeGood'
    ],
    calculator: function (
      datetime: string | undefined,
      distance: number,
      velocityMadeGood: number
    ) {
      let date: Date

      if (datetime && datetime.length > 0) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }

      const datems = date.getTime()
      const timetopoint = Math.floor((distance / velocityMadeGood) * 1000)

      //      app.debug(`Using datetime: ${date} ms to point : ${timetopoint} currentms: ${datems}`)
      const etams = datems + timetopoint
      //      app.debug(`eta in ms: ${etams} ms to point : ${timetopoint} currentms: ${datems}`)

      let eta: string | null
      if (velocityMadeGood > 0) {
        const etad = new Date(etams)
        eta = etad.toISOString()
      } else {
        eta = null
      }
      //      app.debug(`what is eta: ${eta} etams: ${etams} etad: ${etad}`)

      return [
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
            path: 'navigation.courseGreatCircle.nextPoint.eta',
            value: '2024-07-12T18:08:20.000Z'
          }
        ]
      }
    ]
  }
}

module.exports = factory
