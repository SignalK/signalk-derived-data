module.exports = function (app, plugin) {
  return {
    group: 'wind',
    optionKey: 'directionMagnetic',
    title: 'Magnetic Wind Direction',
    derivedFrom: [
      'environment.wind.directionTrue',
      'navigation.magneticVariation'
    ],
    calculator: function (directionTrue, magneticVariation) {
      if (directionTrue === null) {
        return [{ path: 'environment.wind.directionMagnetic', value: null }]
      }
      var directionMagnetic = directionTrue - magneticVariation
      if (directionMagnetic < 0) {
        directionMagnetic = Math.PI * 2 + directionMagnetic
      } else if (directionMagnetic > Math.PI * 2) {
        directionMagnetic = directionMagnetic - Math.PI * 2
      }
      return [
        { path: 'environment.wind.directionMagnetic', value: directionMagnetic }
      ]
    },
    tests: [
      {
        input: [null, -0.01],
        expected: [{ path: 'environment.wind.directionMagnetic', value: null }]
      }
    ]
  }
}
