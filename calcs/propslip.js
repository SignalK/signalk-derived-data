const _ = require('lodash')

const selfData = {
  propulsion: {
    port: {
      transmission: {
        gearRatio: {
          value: 1
        }
      },
      drive: {
        propeller: {
          pitch: {
            value: 1
          }
        }
      }
    }
  }
}

module.exports = function (app, plugin) {
  return plugin.engines.map(instance => {
    return {
      group: 'propulsion',
      optionKey: 'propslip' + instance,
      title:
        'propulsion.' +
        instance +
        '.slip (propulsion.' +
        instance +
        '.transmission.gearRatio, propulsion.' +
        instance +
        '.drive.propeller.pitch)',
      derivedFrom: function () {
        return [
          'propulsion.' + instance + '.revolutions',
          'navigation.speedThroughWater'
        ]
      },
      calculator: function (revolutions, stw) {
        var gearRatio = app.getSelfPath(
          'propulsion.' + instance + '.transmission.gearRatio.value'
        )
        var pitch = app.getSelfPath(
          'propulsion.' + instance + '.drive.propeller.pitch.value'
        )
        if (revolutions > 0) {
          return [
            {
              path: 'propulsion.' + instance + '.drive.propeller.slip',
              value: 1 - stw * gearRatio / (revolutions * pitch)
            }
          ]
        }
      },
      tests: [
        {
          input: [0, 1],
          selfData,
          expected: undefined
        },
        {
          input: [2, 1],
          selfData,
          expected: [
            {
              path: 'propulsion.port.drive.propeller.slip',
              value: 0.5
            }
          ]
        }
      ]
    }
  })
}
