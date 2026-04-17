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
        app.debug('no directionChangeAlarm value')
        return undefined
      }

      var values
      app.debug('angleApparent: ' + angleApparent)
      // Normalise to [0, 2*PI) so the circular-mean math below has a
      // consistent range to work with.
      if (angleApparent < 0) angleApparent = angleApparent + 2 * Math.PI
      app.debug('angleApparent2: ' + angleApparent)
      app.debug('alarm: ' + alarm)
      if (typeof windAvg === 'undefined') {
        windAvg = angleApparent
      } else {
        // Smallest signed angle between the two bearings, in [0, PI].
        var rawDiff = windAvg - angleApparent
        var diff = Math.abs(Math.atan2(Math.sin(rawDiff), Math.cos(rawDiff)))
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
          // Circular mean of the previous average and the new sample.
          windAvg = Math.atan2(
            Math.sin(windAvg) + Math.sin(angleApparent),
            Math.cos(windAvg) + Math.cos(angleApparent)
          )
          if (windAvg < 0) windAvg = windAvg + 2 * Math.PI
        }
      }
      return values
    }
  }
}

function normalAlarmDelta() {
  return {
    path: 'notifications.windShift',
    value: {
      state: 'normal',
      timestamp: new Date().toISOString()
    }
  }
}

function radsToDeg(radians) {
  return (radians * 180) / Math.PI
}
