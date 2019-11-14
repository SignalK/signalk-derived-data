module.exports = function (app, plugin) {
  return {
    group: 'air',
    optionKey: 'Heat Index',
    title: 'Outside heat index (based on temperature and humidity)',
    derivedFrom: [
      'environment.outside.temperature',
      'environment.outside.humidity'
    ],
    calculator: function (temp, humidity) {
      //NWS Heat Index Equation https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml
      //test agsinst the chart https://www.weather.gov/safety/heat-index
      const tempF = (temp - 273.15) * 9/5 + 32
      const h = humidity * 100
      
      if((tempF >= 80 && h >= 40) && (tempF <= 110 && h <= 40)){
        //regression equation of Rothfusz
        heatIndex = -42.379 + 2.04901523*tempF + 10.14333127*h - 0.22475541*tempF*h - 0.00683783*tempF*tempF - 0.05481717*h*h + 
            0.00122874*tempF*tempF*h + 0.00085282*tempF*h*h-0.00000199*tempF*tempF*h*h

        //If the humidity is less than 13% and the temperature is between 80 and 112 degrees F, then the following adjustment is subtracted from HI:
        if(h < 13 && tempF >=80 && tempF <= 112){
            adjustment = (13 - h) / 4 * Math.sqrt((17 - Math.abs(tempF - 95)) / 17)
            heatIndex -= adjustment   
        }

        //if the humidity is greater than 85% and the temperature is between 80 and 87 degrees F, then the following adjustment is added to HI:
        if(h > 85 && tempF >= 80 && tempF <= 87){
           adjustment = ((h - 85) / 10) * ((87 - tempF) / 5)
           heatIndex += adjustment
        }
       
        //The Rothfusz regression is not appropriate when conditions of temperature and humidity warrant a heat index value below about 80 degrees F. In those cases, a simpler formula is applied to calculate values consistent with Steadman's results:
        if(heatIndex < 80){
            heatIndex = 0.5 * (tempF + 61 + (tempF - 68) * 1.2 + h * 0.094)
        }
       
        //convert back to kelvin
        heatIndex = ((heatIndex-32)/1.8)+273.15
    } else{
        heatIndex = temp   
    }
      return [
        {
          path: 'environment.outside.heatIndexTemperature',
          value: heatIndex
        }
      ]
    }
  }
}
