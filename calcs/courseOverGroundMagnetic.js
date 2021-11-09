const _ = require('lodash')

module.exports = function (app, plugin) {
  return {
    group: 'heading',
    optionKey: 'cog_magnetic',
    title: 'Magnetic Course Over Ground (based on true course over ground and magneticVariation)',
    derivedFrom: ['navigation.courseOverGroundTrue', 'navigation.magneticVariation'],
    defaults: [undefined, 9999],
    calculator: function (courseOverGroundTrue, magneticVariation) {
      if (magneticVariation === 9999) {
        magneticVariation = app.getSelfPath(
          'navigation.magneticVariation.value'
        )
        if (_.isUndefined(magneticVariation)) {
          return
        }
      }
      var courseOverGroundMagnetic = courseOverGroundTrue - magneticVariation
      if (courseOverGroundMagnetic < 0) {
        courseOverGroundMagnetic = Math.PI * 2 + courseOverGroundMagnetic
      } else if (courseOverGroundMagnetic > Math.PI * 2) {
        courseOverGroundMagnetic = courseOverGroundMagnetic - Math.PI * 2
      }
      return [{ path: 'navigation.courseOverGroundMagnetic', value: courseOverGroundMagnetic }]
    },
    tests: [
      {
        input: [ 1.0, 0.1 ],
        expected: [
          { path: 'navigation.courseOverGroundMagnetic', value: 0.9 }
        ]
      }
    ]    
  }
}
