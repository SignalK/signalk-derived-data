const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'cog_true',
    title: 'True Course Over Ground',
    derivedFrom: [
      'navigation.courseOverGroundMagnetic',
      'navigation.magneticVariation'
    ],
    defaults: [undefined, 9999],
    calculator: function (courseOverGroundMagnetic, magneticVariation) {
      if (magneticVariation === 9999) {
        magneticVariation = app.getSelfPath(
          'navigation.magneticVariation.value'
        )
      }
      if (_.isUndefined(magneticVariation) || magneticVariation === null) {
        return
      }
      if (
        _.isUndefined(courseOverGroundMagnetic) ||
        courseOverGroundMagnetic === null
      ) {
        return [{ path: 'navigation.courseOverGroundTrue', value: null }]
      }
      var courseOverGroundTrue = courseOverGroundMagnetic + magneticVariation
      if (courseOverGroundTrue < 0) {
        courseOverGroundTrue = Math.PI * 2 + courseOverGroundTrue
      } else if (courseOverGroundTrue > Math.PI * 2) {
        courseOverGroundTrue = courseOverGroundTrue - Math.PI * 2
      }
      return [
        { path: 'navigation.courseOverGroundTrue', value: courseOverGroundTrue }
      ]
    },
    tests: [
      {
        input: [null, 0.01],
        expected: [{ path: 'navigation.courseOverGroundTrue', value: null }]
      },
      {
        input: [0.2, null]
      }
    ]
  }
}
