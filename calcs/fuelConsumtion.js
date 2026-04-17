module.exports = function (app, plugin) {
  const engines = plugin.engines

  app.debug('engines: %j', engines)

  return engines.map((instance) => {
    const economyPath = 'propulsion.' + instance + '.fuel.economy'
    const derivedFromList = [
      'propulsion.' + instance + '.fuel.rate',
      'navigation.speedOverGround'
    ]
    return {
      group: 'propulsion',
      optionKey: 'economy' + instance,
      title: `${instance} fuel economy`,
      derivedFrom: function () {
        return derivedFromList
      },
      calculator: function (rate, speed) {
        return [{ path: economyPath, value: speed / rate }]
      }
    }
  })
}
