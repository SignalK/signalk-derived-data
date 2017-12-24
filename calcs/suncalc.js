var debug = require('debug')('signalk-derived-data')
const suncalc = require('suncalc');
const _ = require('lodash')


module.exports = function(app, plugin) {
  return {
    group: 'sun',
    optionKey: 'Sun',
    title: "Sets environment.sun to dawn, sunrise, day, sunset, dusk or night",
    derivedFrom: [ "navigation.datetime", "navigation.position" ],
    calculator: function(datetime, position) {
      var value

      var times = suncalc.getTimes(new Date(datetime), position.latitude, position.longitude)
      var now = new Date().getTime()

      _.keys(times).forEach(key => {
        times[key] = new Date(times[key]).getTime()
      });

      if ( now >= times.sunrise ) {
        if ( now < times.sunriseEnd ) {
          value = 'sunrise'
        } else if ( now <= times.sunsetStart ) {
          value = 'day'
        } else if ( now >= times.sunsetStart && now < times.dusk ) {
          value = 'sunset'
        } else if ( now < times.night ) {
          value = 'dusk'
        } else {
          value = 'night'
        }
      } else {
        if ( now >= times.dawn ) {
          value = 'dawn'
        } else {
          value = 'night'
        }
      }
      
      return [{ path: "environment.sun", value: value}]
    }
  };
}
