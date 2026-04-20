import type { Calculation, CalculationFactory } from '../types'

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

const factory: CalculationFactory = function (app, plugin): Calculation[] {
  return (plugin.engines ?? []).map((instance): Calculation => {
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
      calculator: function (revolutions: number, stw: number) {
        const gearRatio = app.getSelfPath(gearRatioPath) as number | undefined
        const pitch = app.getSelfPath(pitchPath) as number | undefined
        if (
          !Number.isFinite(revolutions) ||
          revolutions <= 0 ||
          !Number.isFinite(stw) ||
          !Number.isFinite(gearRatio) ||
          !Number.isFinite(pitch) ||
          pitch === 0
        ) {
          return undefined
        }
        return [
          {
            path: slipPath,
            value:
              1 -
              (stw * (gearRatio as number)) / (revolutions * (pitch as number))
          }
        ]
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

module.exports = factory
