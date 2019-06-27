const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'heading',
    title: 'True Heading (based on magnetic heading  and magneticVarition)',
    derivedFrom: ['navigation.headingMagnetic', 'navigation.magneticVariation'],
    defaults: [undefined, 9999],
    calculator: function (heading, magneticVariation) {
      if (magneticVariation === 9999) {
        magneticVariation = app.getSelfPath(
          'navigation.magneticVariation.value'
        )
        if (_.isUndefined(magneticVariation)) {
          return
        }
      }
      var headingTrue = heading + magneticVariation
      if (headingTrue < 0) {
        headingTrue = Math.PI * 2 + headingTrue
      } else if (headingTrue > Math.PI * 2) {
        headingTrue = headingTrue - Math.PI * 2
      }
      return [{ path: 'navigation.headingTrue', value: headingTrue }]
    }
  }
}
