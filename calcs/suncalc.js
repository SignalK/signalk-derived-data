var debug = require('debug')('signalk-derived-data:sun')
const suncalc = require('suncalc');
const _ = require('lodash')


module.exports = function(app, plugin) {
  return {
    group: 'sun',
    optionKey: 'Sun',
    title: "Sets environment.sun to dawn, sunrise, day, sunset, dusk or night (based on navigation.datetime or system time and navigation.position)",
    derivedFrom: [ "navigation.datetime", "navigation.position" ],
    defaults: [ '', undefined ],
    debounceDelay: 60*1000,
    calculator: function(datetime, position) {
      var value
      var date

      if ( datetime && datetime.length > 0 ) {
        date = new Date(datetime)
      } else {
        date = new Date()
      }
        

      var times = suncalc.getTimes(date, position.latitude, position.longitude)
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

      debug(`Setting sun to ${value}`)
      
      return [{ path: "environment.sun", value: value}]
    }
  };
}
