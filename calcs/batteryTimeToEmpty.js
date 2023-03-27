const _ = require('lodash')

module.exports = function (app, plugin) {
  return plugin.batteries.map(instance => {
    return {
      group: 'electrical',
      optionKey: 'batteryTimeToEmpty' + instance,
      title: 'Battery ' + instance + ' Time to Empty',
      derivedFrom: function () {
        return [
          'electrical.batteries.' + instance + '.power',
          'electrical.batteries.' + instance + '.capacity.stateOfCharge'
        ]
      },
      calculator: function (p, soc) {
        var soc_remaining = soc - 0.2
        var capacity = 5120 * 6

        var time_to_empty = 0
        if (soc_remaining > 0 && p < 0) {
          p = Math.abs(p)
          time_to_empty = Math.round(capacity * 60 * 60 * soc_remaining / p)
        }

        return [
          {
            path: 'electrical.batteries.' + instance + '.capacity.timeToEmpty',
            value: time_to_empty
          }
        ]
      }
    }
  })
}
