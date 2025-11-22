const _ = require('lodash')
const geomagnetism = require('geomagnetism')

module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'magneticVariation',
    title: 'Magnetic Variation',
    derivedFrom: ['navigation.position'],
    defaults: [undefined, 9999],
    calculator: function (position) {
      if (!position || !position.latitude || !position.longitude) return

      const model = geomagnetism.model()
      const info = model.point([position.latitude, position.longitude])
      const magVar = info.decl * Math.PI / 180

      const today = new Date()
      const ageOfService =
        today.getFullYear() +
        '.' +
        String(today.getMonth() + 1).padStart(2, '0') +
        '.' +
        String(today.getDate()).padStart(2, '0')

      return [
        { path: 'navigation.magneticVariation', value: magVar },
        {
          path: 'navigation.magneticVariation.source',
          value: model.name || 'WMM-2025'
        },
        {
          path: 'navigation.magneticVariation.ageOfService',
          value: ageOfService
        }
      ]
    },
    tests: [
      {
        input: [{ latitude: 39.0631232, longitude: -76.4872768 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: -0.1923,
            delta: 0.01
          }
        ]
      },
      {
        input: [{ latitude: null, longitude: null }]
      }
    ]
  }
}
