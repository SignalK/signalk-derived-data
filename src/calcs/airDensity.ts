import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app, _plugin): Calculation {
  return {
    group: 'air',
    optionKey: 'Air density',
    title: 'Outside air density',
    derivedFrom: [
      'environment.outside.temperature',
      'environment.outside.humidity',
      'environment.outside.pressure'
    ],
    calculator: function (temp: number, hum: number, press: number) {
      // SignalK temperature is Kelvin; humidity is a ratio in [0, 1];
      // pressure is Pa. Saturation pressure via Tetens comes out in
      // hPa, so it is multiplied by 100 before being used alongside
      // the pressure input.
      if (
        !Number.isFinite(temp) ||
        !Number.isFinite(hum) ||
        !Number.isFinite(press) ||
        temp <= 0
      ) {
        return undefined
      }
      const tempC = temp - 273.15
      const psat = 6.1078 * Math.pow(10, (7.5 * tempC) / (tempC + 237.3)) * 100
      const pv = hum * psat
      const pd = press - pv
      const airDensity = pd / (287.058 * temp) + pv / (461.495 * temp) // https://en.wikipedia.org/wiki/Density_of_air#cite_note-wahiduddin_01-15

      return [{ path: 'environment.outside.airDensity', value: airDensity }]
    }
  }
}

module.exports = factory
