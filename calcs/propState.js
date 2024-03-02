const _ = require('lodash')

module.exports = function (app, plugin) {
  var engines = plugin.engines

  app.debug('engines: %j', engines)

  return engines.map(instance => {
    return {
      group: 'propulsion',
      optionKey: instance + 'state',
      title: `${instance} propulsion state (based on revolutions)`,
      derivedFrom: function () {
        return [
          'propulsion.' + instance + '.revolutions'
        ]
      },
      calculator: function (revol) {
        if (revol > 0) {
          return [
            {
              path: 'propulsion.' + instance + '.state',
              value: "started"
            }
          ]
        } else {
          return [
            {
              path: 'propulsion.' + instance + '.state',
              value: "stopped"
            }
          ]
        }
      }
    }
  })
}
