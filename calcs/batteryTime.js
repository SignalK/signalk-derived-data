const _ = require('lodash')

module.exports = function (app, plugin) {
  return plugin.batteries.map(instance => {
    return {
      group: 'electrical',
      optionKey: 'batteryTime' + instance,
      title: 'Battery ' + instance + ' Time to Full / Empty',
      properties: {
        ['capacity.' + instance]: {
          type: 'number',
          title: 'Capacity of battery bank in Wh',
          default: 5120
        },
        ['socHigh.' + instance]: {
          type: 'number',
          title: 'State of Charge at Full (Percentage)',
          default: 100
        },
        ['socLow.' + instance]: {
          type: 'number',
          title: 'State of Charge at Empty (Percentage)',
          default: 20
        }
      },
      derivedFrom: function () {
        return [
          'electrical.batteries.' + instance + '.power',
          'electrical.batteries.' + instance + '.capacity.stateOfCharge'
        ]
      },
      calculator: function (p, soc) {
        let capacity = parseFloat(
          plugin.properties.electrical['capacity.' + instance]
        )
        let socLow =
          parseFloat(plugin.properties.electrical['socLow.' + instance]) / 100
        let socHigh =
          parseFloat(plugin.properties.electrical['socHigh.' + instance]) / 100

        // app.debug('Capacity: ' + capacity)
        // app.debug('SocLow: ' + socLow)
        // app.debug('SocHigh: ' + socHigh)

        output = []

        // how long til full?
        let time_to_full = 0
        if (p > 0 && soc < 0.99) {
          time_to_full = Math.round(capacity * 60 * 60 * (socHigh - soc) / p)
        }
        output.push({
          path: 'electrical.batteries.' + instance + '.capacity.timeToFull',
          value: time_to_full
        })

        // how long til empty?
        let soc_remaining = soc - socLow
        let time_to_empty = 0
        if (soc_remaining > 0 && p < 0) {
          p = Math.abs(p)
          time_to_empty = Math.round(capacity * 60 * 60 * soc_remaining / p)
        }
        output.push({
          path: 'electrical.batteries.' + instance + '.capacity.timeToEmpty',
          value: time_to_empty
        })

        // app.debug(output)

        return output
      }
    }
  })
}
