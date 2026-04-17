module.exports = function (app, plugin) {
  return {
    group: 'air',
    optionKey: 'Wind Chill',
    title: 'Outside air wind chill',
    derivedFrom: [
      'environment.outside.temperature',
      'environment.wind.speedApparent'
    ],
    calculator: function (temp, windSpeed) {
      // standard Wind Chill formula for Environment Canada. Inputs are
      // SignalK: temperature in Kelvin, wind speed in m/s. The
      // regression expects wind speed in km/h.
      const tempC = temp - 273.15
      const windSpeedKmh = windSpeed * 3.6
      var windChill =
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
