module.exports = function (app, plugin) {
  return plugin.tanks.map((instance) => {
    const volumePath = 'tanks.' + instance + '.currentVolume'
    const derivedFromList = [
      'tanks.' + instance + '.currentLevel',
      'tanks.' + instance + '.capacity'
    ]
    return {
      group: 'tanks',
      optionKey: 'tankVolume2_' + instance,
      title:
        'Tank ' +
        instance +
        ' Volume (alternate currentVolume calculation than one above, select only one calculation per tank.) Uses ',
      derivedFrom: function () {
        return derivedFromList
      },
      calculator: function (level, capacity) {
        return [
          {
            path: volumePath,
            value: level * capacity
          }
        ]
      }
    }
  })
}
