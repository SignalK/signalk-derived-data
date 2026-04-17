module.exports = function (app, plugin) {
  return {
    group: 'air',
    optionKey: 'Air density',
    title: 'Outside air density',
    derivedFrom: [
      'environment.outside.temperature',
      'environment.outside.humidity',
      'environment.outside.pressure'
    ],
    calculator: function (temp, hum, press) {
      // SignalK temperature is Kelvin; humidity is a ratio in [0, 1];
      // pressure is Pa. Saturation pressure via Tetens comes out in
      // hPa, so it is multiplied by 100 before being used alongside
      // the pressure input.
      var tempC = temp - 273.15
      var psat = 6.1078 * Math.pow(10, (7.5 * tempC) / (tempC + 237.3)) * 100
      var pv = hum * psat
      var pd = press - pv
      var airDensity = pd / (287.058 * temp) + pv / (461.495 * temp) // https://en.wikipedia.org/wiki/Density_of_air#cite_note-wahiduddin_01-15

      return [{ path: 'environment.outside.airDensity', value: airDensity }]
    }
  }
}
