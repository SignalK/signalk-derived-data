module.exports = function (app, plugin) {
  return {
    group: 'air',
    optionKey: 'Air density',
    title: 'Outside air density (based on humidity, temperature and pressure)',
    derivedFrom: [
      'environment.outside.temperature',
      'environment.outside.humidity',
      'environment.outside.pressure'
    ],
    calculator: function (temp, hum, press) {
      var tempC = temp + 273.16
      var psat = (6.1078 * 10) ^ (7.5 * tempC / (tempC + 237.3)) // hPa
      var pv = hum * psat / 100 // vapour pressure of water
      var pd = press - pv // dry air pressure
      var airDensity = pd / (287.058 * temp) + pv / (461.495 * temp) // https://en.wikipedia.org/wiki/Density_of_air#cite_note-wahiduddin_01-15

      return [{ path: 'environment.outside.airDensity', value: airDensity }]
    }
  }
}
