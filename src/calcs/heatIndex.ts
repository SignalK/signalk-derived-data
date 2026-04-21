import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app, _plugin): Calculation {
  return {
    group: 'air',
    optionKey: 'Heat Index',
    title: 'Outside heat index',
    derivedFrom: [
      'environment.outside.temperature',
      'environment.outside.humidity'
    ],
    calculator: function (temp: number, humidity: number) {
      // NWS Heat Index Equation https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
      // test against the chart https://www.weather.gov/safety/heat-index
      if (!Number.isFinite(temp) || !Number.isFinite(humidity) || temp <= 0) {
        return undefined
      }
      const tempF = ((temp - 273.15) * 9) / 5 + 32
      const h = humidity * 100

      // Canonical NWS decision rule: compute the simpler Steadman
      // expression first, and only apply Rothfusz when the average of
      // that value and the raw temperature is >= 80 F. This covers
      // the narrow sliver where T < 80 F but humidity is high enough
      // that the "feels like" temperature already exceeds 80 F.
      const simpleHI = 0.5 * (tempF + 61 + (tempF - 68) * 1.2 + h * 0.094)

      let heatIndexF: number
      if ((simpleHI + tempF) / 2 >= 80) {
        // regression equation of Rothfusz
        heatIndexF =
          -42.379 +
          2.04901523 * tempF +
          10.14333127 * h -
          0.22475541 * tempF * h -
          0.00683783 * tempF * tempF -
          0.05481717 * h * h +
          0.00122874 * tempF * tempF * h +
          0.00085282 * tempF * h * h -
          0.00000199 * tempF * tempF * h * h

        // If the humidity is less than 13% and the temperature is between 80 and 112 degrees F, then the following adjustment is subtracted from HI:
        if (h < 13 && tempF >= 80 && tempF <= 112) {
          const adjustment =
            ((13 - h) / 4) * Math.sqrt((17 - Math.abs(tempF - 95)) / 17)
          heatIndexF -= adjustment
        }

        // if the humidity is greater than 85% and the temperature is between 80 and 87 degrees F, then the following adjustment is added to HI:
        if (h > 85 && tempF >= 80 && tempF <= 87) {
          const adjustment = ((h - 85) / 10) * ((87 - tempF) / 5)
          heatIndexF += adjustment
        }
      } else {
        heatIndexF = simpleHI
      }

      // convert back to kelvin
      const heatIndex = (heatIndexF - 32) / 1.8 + 273.15
      return [
        {
          path: 'environment.outside.heatIndexTemperature',
          value: heatIndex
        }
      ]
    }
  }
}

module.exports = factory
