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
    // gearRatio and propeller.pitch are drivetrain design config — static
    // for the life of the plugin. Cache the first non-undefined read so
    // per-revolution updates no longer walk the state tree twice.
    let cachedGearRatio: number | undefined
    let cachedPitch: number | undefined

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
        if (cachedGearRatio === undefined) {
          cachedGearRatio = app.getSelfPath(gearRatioPath) as number | undefined
        }
        if (cachedPitch === undefined) {
          cachedPitch = app.getSelfPath(pitchPath) as number | undefined
        }
        if (
          !Number.isFinite(revolutions) ||
          revolutions <= 0 ||
          !Number.isFinite(stw) ||
          !Number.isFinite(cachedGearRatio) ||
          !Number.isFinite(cachedPitch) ||
          cachedPitch === 0
        ) {
          return undefined
        }
        return [
          {
            path: slipPath,
            value:
              1 -
              (stw * (cachedGearRatio as number)) /
                (revolutions * (cachedPitch as number))
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
