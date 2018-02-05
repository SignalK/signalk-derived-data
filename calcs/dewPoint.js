
module.exports = function(app, plugin) {
  return {
    group: 'air',
    optionKey: 'dewPoint',
    title: "Outside air dew point (based on humidity and temperature)",
    derivedFrom: [ "environment.outside.temperature", "environment.outside.humidity" ],
    calculator: function(temp, hum) {
      //Magnus formula:
      var tempC = temp + 273.16
      const b = 18.678
      const c = 257.14
      var magnus = Math.log(hum) + (b * tempC)/(c + tempC)
      var dewPoint = (c * magnus) / (b - magnus) - 273.16
      return [{ path: "environment.outside.dewPointTemperature", value: dewPoint}]
    }
  };
}
