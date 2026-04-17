module.exports = function (app, plugin) {
  return plugin.batteries.map((instance) => {
    const powerPath = 'electrical.batteries.' + instance + '.power'
    const derivedFromList = [
      'electrical.batteries.' + instance + '.voltage',
      'electrical.batteries.' + instance + '.current'
    ]
    return {
      group: 'electrical',
      optionKey: 'batterPower' + instance,
      title: 'Battery ' + instance + ' Power ',
      derivedFrom: function () {
        return derivedFromList
      },
      calculator: function (v, a) {
        return [{ path: powerPath, value: v * a }]
      }
    }
  })
}
