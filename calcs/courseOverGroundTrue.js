const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'cog_true',
    title: 'True Course Over Ground (based on magnetic course over ground and magneticVariation)',
    derivedFrom: ['navigation.courseOverGroundMagnetic', 'navigation.magneticVariation'],
    defaults: [undefined, 9999],
    calculator: function (courseOverGroundMagnetic, magneticVariation) {
      if (magneticVariation === 9999) {
        magneticVariation = app.getSelfPath(
          'navigation.magneticVariation.value'
        )
        if (_.isUndefined(magneticVariation)) {
          return
        }
      }
      var courseOverGroundTrue = courseOverGroundMagnetic + magneticVariation
      if (courseOverGroundTrue < 0) {
        courseOverGroundTrue = Math.PI * 2 + courseOverGroundTrue
      } else if (courseOverGroundTrue > Math.PI * 2) {
        courseOverGroundTrue = courseOverGroundTrue - Math.PI * 2
      }
      return [{ path: 'navigation.courseOverGroundTrue', value: courseOverGroundTrue }]
    }
  }
}
