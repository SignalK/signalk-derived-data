const debug = require('debug')('signalk-derived-data')

module.exports = function(app, plugin) {
  return {
    group: 'air',
    optionKey: 'Wind Chill',
    title: "Outside air wind chill (based on wind speed and temperature)",
    derivedFrom: [ "environment.outside.temperature", "environment.wind.speedApparent" ],
    calculator: function(temp, windSpeed) {
      //standard Wind Chill formula for Environment Canada
      const tempC = temp + 273.16
      const windSpeedKmh = windSpeed * 3600 / 1000

      var windChill = (13.12 + (0.6215 * tempC) - (11.37 * windSpeedKmh^0.16) + (0.3965 * tempC * windSpeedKmh^0.16)) - 273.16
      //Please Note: The calculator should not be used for outside air temperatures greater that 10 °C (50 °F ) and wind speeds less than 4.8 Km/hr
      if(tempC < 10 && windSpeedKmh > 4.8){
        return [{ path: "environment.outside.apparentWindChillTemperature", value: windChill}]
      } else return
    }
  };
}
