const _ = require('lodash')

module.exports = function (app, plugin) {
  return plugin.batteries.map(instance => {
    return {
      group: 'electrical',
      optionKey: 'batteryTimeToFull' + instance,
      title: 'Battery ' + instance + ' Time to Full',
      derivedFrom: function () {
        return [
          'electrical.batteries.' + instance + '.power',
          'electrical.batteries.' + instance + '.capacity.stateOfCharge'
        ]
      },
      calculator: function (p, soc) {
        var capacity = 5120 * 6

        var time_to_full = 0
        if (p > 0) time_to_full = Math.round(capacity * 60 * 60 * (1 - soc) / p)

        return [
          {
            path: 'electrical.batteries.' + instance + '.capacity.timeToFull',
            value: time_to_full
          }
        ]
      }
    }
  })
}
