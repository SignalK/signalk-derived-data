const _ = require('lodash')

module.exports = function (app, plugin) {
  var engines = plugin.engines

  app.debug('engines: %j', engines)

  return engines.map((instance) => {
    return {
      group: 'propulsion',
      optionKey: 'economy' + instance,
      title: `${instance} fuel economy`,
      derivedFrom: function () {
        return [
          'propulsion.' + instance + '.fuel.rate',
          'navigation.speedOverGround'
        ]
      },
      calculator: function (rate, speed) {
        if (!_.isFinite(rate) || rate === 0 || !_.isFinite(speed)) {
          return undefined
        }
        return [
          {
            path: 'propulsion.' + instance + '.fuel.economy',
            value: speed / rate
          }
        ]
      }
    }
  })
}
