import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, plugin): Calculation[] {
  const engines = plugin.engines ?? []

  app.debug('engines: %j', engines)

  return engines.map((instance): Calculation => {
    const statePath = 'propulsion.' + instance + '.state'
    const currentStatePath = 'propulsion.' + instance + '.state.value'
    const derivedFromList = ['propulsion.' + instance + '.revolutions']
    return {
      group: 'propulsion',
      optionKey: instance + 'state',
      title: `${instance} propulsion state (based on revolutions)`,
      derivedFrom: function () {
        return derivedFromList
      },
      calculator: function (revol: number | null | undefined) {
        const currentState =
          (app.getSelfPath(currentStatePath) as string | undefined) || 'none'

        if (
          revol !== null &&
          revol !== undefined &&
          revol > 0 &&
          currentState !== 'started'
        ) {
          return [
            {
              path: statePath,
              value: 'started'
            }
          ]
        } else if (!revol && currentState !== 'stopped') {
          return [
            {
              path: statePath,
              value: 'stopped'
            }
          ]
        }
        return undefined
      },
      tests: [
        // Spinning, no prior state -> transition to 'started'.
        {
          input: [1200],
          expected: [
            { path: 'propulsion.' + instance + '.state', value: 'started' }
          ]
        },
        // Spinning, already 'started' -> no update.
        {
          input: [1200],
          selfData: {
            propulsion: { [instance]: { state: { value: 'started' } } }
          }
        },
        // revol === 0 while running -> transition to 'stopped'.
        {
          input: [0],
          selfData: {
            propulsion: { [instance]: { state: { value: 'started' } } }
          },
          expected: [
            { path: 'propulsion.' + instance + '.state', value: 'stopped' }
          ]
        },
        // revol === null while running -> transition to 'stopped'.
        // Regression coverage for the bug fixed in this PR: NMEA gateways
        // that emit revolutions = null when the engine is off used to leave
        // propulsion.<instance>.state stuck on 'started'.
        {
          input: [null],
          selfData: {
            propulsion: { [instance]: { state: { value: 'started' } } }
          },
          expected: [
            { path: 'propulsion.' + instance + '.state', value: 'stopped' }
          ]
        },
        // revol === undefined while running -> transition to 'stopped'.
        {
          input: [undefined],
          selfData: {
            propulsion: { [instance]: { state: { value: 'started' } } }
          },
          expected: [
            { path: 'propulsion.' + instance + '.state', value: 'stopped' }
          ]
        },
        // revol === 0, already 'stopped' -> no update.
        {
          input: [0],
          selfData: {
            propulsion: { [instance]: { state: { value: 'stopped' } } }
          }
        }
      ]
    }
  })
}

module.exports = factory
