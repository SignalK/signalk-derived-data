const _ = require('lodash')

module.exports = function (app, plugin) {
  return plugin.tanks.map(instance => {
    return {
      group: 'tanks',
      optionKey: 'tankVolume2_' + instance,
      title:
        'Tank ' + instance + ' Volume (based on currentLevel and capacity)',
      derivedFrom: function () {
        return [
          'tanks.' + instance + '.currentLevel',
          'tanks.' + instance + '.capacity'
        ]
      },
      calculator: function (level, capacity) {
        return [
          {
            path: 'tanks.' + instance + '.currentVolume',
            value: level * capacity
          }
        ]
      }
    }
  })
}
