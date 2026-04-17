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
  return plugin.engines.map((instance) => {
    const slipPath = 'propulsion.' + instance + '.drive.propeller.slip'
    const gearRatioPath =
      'propulsion.' + instance + '.transmission.gearRatio.value'
    const pitchPath = 'propulsion.' + instance + '.drive.propeller.pitch.value'
    const derivedFromList = [
      'propulsion.' + instance + '.revolutions',
      'navigation.speedThroughWater'
    ]
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
        return derivedFromList
      },
      calculator: function (revolutions, stw) {
        const gearRatio = app.getSelfPath(gearRatioPath)
        const pitch = app.getSelfPath(pitchPath)
        if (revolutions > 0) {
          return [
            {
              path: slipPath,
              value: 1 - (stw * gearRatio) / (revolutions * pitch)
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
