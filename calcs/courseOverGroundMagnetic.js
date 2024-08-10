const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'course data',
    optionKey: 'cog_magnetic',
    title: 'Magnetic Course Over Ground',
    derivedFrom: [
      'navigation.courseOverGroundTrue',
      'navigation.magneticVariation'
    ],
    defaults: [undefined, 9999],
    calculator: function (courseOverGroundTrue, magneticVariation) {
      if (magneticVariation === 9999) {
        magneticVariation = app.getSelfPath(
          'navigation.magneticVariation.value'
        )
      }
      if (_.isUndefined(magneticVariation) || magneticVariation === null) {
        return
      }
      if (
        _.isUndefined(courseOverGroundTrue) ||
        courseOverGroundTrue === null
      ) {
        return [{ path: 'navigation.courseOverGroundMagnetic', value: null }]
      }
      var courseOverGroundMagnetic = courseOverGroundTrue - magneticVariation
      if (courseOverGroundMagnetic < 0) {
        courseOverGroundMagnetic = Math.PI * 2 + courseOverGroundMagnetic
      } else if (courseOverGroundMagnetic > Math.PI * 2) {
        courseOverGroundMagnetic = courseOverGroundMagnetic - Math.PI * 2
      }
      return [
        {
          path: 'navigation.courseOverGroundMagnetic',
          value: courseOverGroundMagnetic
        }
      ]
    },
    tests: [
      {
        input: [1.0, 0.1],
        expected: [{ path: 'navigation.courseOverGroundMagnetic', value: 0.9 }]
      },
      {
        input: [null, -0.01],
        expected: [{ path: 'navigation.courseOverGroundMagnetic', value: null }]
      },
      {
        input: [0.2, null]
      }
    ]
  }
}
