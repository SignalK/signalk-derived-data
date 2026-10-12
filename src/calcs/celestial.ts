import { sunAltAz, moonAltAz, planetAltAz } from '@openwaters/almanac'
import { astronomyInput } from '../astronomy'
import { degreesToRadians } from '../utils'
import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (app, _plugin): Calculation {
  let metadataSet = false
  return {
    group: 'celestial',
    optionKey: 'Celestial positions',
    title: 'Sun, Moon and naked-eye planet altitude and azimuth',
    derivedFrom: ['navigation.datetime', 'navigation.position'],
    defaults: ['', undefined],
    debounceDelay: 60 * 1000,
    calculator: function (datetime: string | undefined, position: unknown) {
      const input = astronomyInput(datetime, position)
      if (!input) return
      const { date, observer } = input
      const bodies = [
        { path: 'environment.sunlight', position: sunAltAz(date, observer) },
        { path: 'environment.moon', position: moonAltAz(date, observer) },
        ...(['mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const).map(
          (planet) => ({
            path: `environment.planets.${planet}`,
            position: planetAltAz(planet, date, observer)
          })
        )
      ]
      const values = bodies.flatMap(({ path, position }) => [
        { path: `${path}.altitude`, value: degreesToRadians(position.altDeg) },
        { path: `${path}.azimuth`, value: degreesToRadians(position.azDeg) }
      ])
      if (!metadataSet) {
        metadataSet = true
        for (const { path } of values) {
          void app
            .setDefaultMetadata?.(path, {
              units: 'rad',
              description: path.endsWith('.azimuth')
                ? 'Azimuth clockwise from true north'
                : 'Apparent altitude above the horizontal plane, with standard refraction'
            })
            .catch((error: unknown) =>
              app.error(`Celestial metadata: ${error}`)
            )
        }
      }
      return values
    }
  }
}

module.exports = factory
