import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app, _plugin): Calculation {
  return {
    group: 'air',
    optionKey: 'Wind Chill',
    title: 'Outside air wind chill',
    derivedFrom: [
      'environment.outside.temperature',
      'environment.wind.speedApparent'
    ],
    debounceDelay: 200,
    calculator: function (temp: number, windSpeed: number) {
      // standard Wind Chill formula for Environment Canada. Inputs are
      // SignalK: temperature in Kelvin, wind speed in m/s. The
      // regression expects wind speed in km/h.
      if (
        !Number.isFinite(temp) ||
        !Number.isFinite(windSpeed) ||
        temp <= 0 ||
        windSpeed < 0
      ) {
        return undefined
      }
      const tempC = temp - 273.15
      const windSpeedKmh = windSpeed * 3.6
      let windChill =
        13.12 +
        0.6215 * tempC -
        11.37 * Math.pow(windSpeedKmh, 0.16) +
        0.3965 * tempC * Math.pow(windSpeedKmh, 0.16) +
        273.15

      // Please Note: The calculator should not be used for outside air temperatures greater that 10 °C (50 °F ) and wind speeds less than 4.8 Km/hr
      windChill = windSpeedKmh <= 4.8 ? tempC + 273.15 : windChill
      windChill = tempC > 10 ? tempC + 273.15 : windChill

      return [
        {
          path: 'environment.outside.apparentWindChillTemperature',
          value: windChill
        }
      ]
    }
  }
}

module.exports = factory
