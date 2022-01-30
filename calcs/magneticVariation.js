const _ = require('lodash')
const MagVar = require('magvar')

module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'magneticVariation',
    title: 'Magnetic Variation (based on navigation.position)',
    derivedFrom: ['navigation.position'],
    defaults: [undefined, 9999],
    calculator: function (position) {
      if (!position || !position.latitude || !position.longitude) return

      let degreesVar = MagVar.get([position.latitude], [position.longitude])
      let magVar = degreesVar * Math.PI / 180
      return [{ path: 'navigation.magneticVariation', value: magVar }]
    },
    tests: [
      {
        input: [{ latitude: 39.0631232, longitude: -76.4872768 }],
        expectedRange: [
          {
            path: 'navigation.magneticVariation',
            value: -0.19338248112097173,
            delta: 0.05
          }
        ]
      },
      {
        input: [{ latitude: null, longitude: null }]
      }
    ]
  }
}
