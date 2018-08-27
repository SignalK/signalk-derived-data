module.exports = function (app, plugin) {
  return {
    group: 'air',
    optionKey: 'Wind Chill',
    title: 'Outside air wind chill (based on wind speed and temperature)',
    derivedFrom: [
      'environment.outside.temperature',
      'environment.wind.speedApparent'
    ],
    calculator: function (temp, windSpeed) {
      // standard Wind Chill formula for Environment Canada
      const tempC = temp - 273.16
      const windSpeedKt = windSpeed * 1.852
      var windChill =
        13.12 +
        0.6215 * tempC -
        11.37 * Math.pow(windSpeedKt, 0.16) +
        0.3965 * tempC * Math.pow(windSpeedKt, 0.16) +
        273.16

      // Please Note: The calculator should not be used for outside air temperatures greater that 10 °C (50 °F ) and wind speeds less than 4.8 Km/hr
      windChill = windSpeedKt <= 4.8 ? tempC + 273.16 : windChill
      windChill = tempC > 10 ? tempC + 273.16 : windChill

      return [
        {
          path: 'environment.outside.apparentWindChillTemperature',
          value: windChill
        }
      ]
    }
  }
}
