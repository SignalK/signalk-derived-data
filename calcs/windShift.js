const _ = require('lodash')

var windAvg
var alarmSent = false

module.exports = function (app, plugin) {
  return {
    group: 'wind',
    optionKey: 'windShift',
    title: 'Wind Shift (experimental)',
    derivedFrom: ['environment.wind.angleApparent'],
    stop: function () {
      windAvg = undefined
      if (alarmSent) {
        alarmSent = false
        app.handleMessage(plugin.id, {
          context: 'vessels.' + app.selfId,
          updates: [
            {
              source: {
                // "src": key
              },
              timestamp: new Date().toISOString(),
              values: [normalAlarmDelta()]
            }
          ]
        })
      }
    },
    calculator: function (angleApparent) {
      var alarm = app.getSelfPath('environment.wind.directionChangeAlarm.value')
      if (typeof alarm === 'undefined') {
        console.log('signall-Derived-data: no directionChangeAlarm value')
        return undefined
      }

      var values
      app.debug('angleApparent: ' + angleApparent)
      if (angleApparent < 0) angleApparent = angleApparent + Math.PI / 2
      app.debug('angleApparent2: ' + angleApparent)
      app.debug('alarm: ' + alarm)
      if (typeof windAvg === 'undefined') {
        windAvg = angleApparent
      } else {
        var diff = Math.abs(windAvg - angleApparent)
        app.debug('' + windAvg + ', ' + angleApparent + ', ' + diff)
        if (diff > alarm) {
          values = [
            {
              path: 'notifications.windShift',
              value: {
                state: 'alert',
                method: ['visual', 'sound'],
                message:
                  'Wind has shifted by ' +
                  Math.round(radsToDeg(diff)) +
                  ' degrees',
                timestamp: new Date().toISOString()
              }
            }
          ]
          alarmSent = true
        } else {
          if (alarmSent) {
            values = [normalAlarmDelta()]
            alarmSent = false
          }
          windAvg = (windAvg + angleApparent) / 2
        }
      }
      return values
    }
  }
}

function normalAlarmDelta () {
  return {
    path: 'notifications.windShift',
    value: {
      state: 'normal',
      timestamp: new Date().toISOString()
    }
  }
}

function radsToDeg (radians) {
  return radians * 180 / Math.PI
}
