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
        return ['propulsion.' + instance + '.revolutions']
      },
      calculator: function (revol) {
        const currentState =
          app.getSelfPath('propulsion.' + instance + '.state.value') || 'none'

        if (revol > 0 && currentState !== 'started') {
          return [
            {
              path: 'propulsion.' + instance + '.state',
              value: 'started'
            }
          ]
        } else if (revol == 0 && currentState !== 'stopped') {
          return [
            {
              path: 'propulsion.' + instance + '.state',
              value: 'stopped'
            }
          ]
        }
      }
    }
  })
}
