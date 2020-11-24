const _ = require('lodash')
const geolib = require('geolib')
const geoutils = require('geolocation-utils')

var alarmSent = []
var notificationLevels = ['normal', 'alert', 'warn', 'alarm', 'emergency']

module.exports = function (app, plugin) {
  return {
    group: 'traffic',
    optionKey: 'CPA',
    title:
      'Calculates closest point of approach distance and time. (based on navigation.position for vessels)',
    derivedFrom: [
      'navigation.position',
      'navigation.courseOverGroundTrue',
      'navigation.speedOverGround'
    ],
    properties: {
      range: {
        type: 'number',
        title:
          'Calculate for all vessels within this range (m), negative to disable filter',
        default: 1852
      },
      timelimit: {
        type: 'number',
        title:
          'Discard other vessel data if older than this (in seconds), negative to disable filter',
        default: 30
      },
      sendNotifications: {
        type: 'boolean',
        title:
          'Global send dangerous targets notifications. You must also enable "Calculates closest point of approach distance and time..."',
        default: true
      },
      notificationZones: {
        type: 'array',
        title:
          'Dangerous targets notification zone (CPA limit / TCPA limit => Notification level)',
        items: {
          type: 'object',
          required: ['range', 'timeLimit', 'level'],
          properties: {
            range: {
              type: 'number',
              title: 'Dangerous targets notification CPA limit (m)',
              description: ' ',
              default: 1852
            },
            timeLimit: {
              type: 'number',
              title: 'Dangerous targets notification TCPA limit (s)',
              description: ' ',
              default: 600
            },
            level: {
              type: 'string',
              title: 'Notification level of notification for this zone',
              enum: notificationLevels,
              default: 'alert'
            },
            active: {
              type: 'boolean',
              title:
                'Send notification for this zone. You must also enable "Global send dangerous targets notifications..."',
              default: true
            }
          }
        }
      }
    },
    debounceDelay: 5 * 1000,
    stop: function () {
      app.debug('stopped')
      if (alarmSent.length < 1) {
        _.keys(alarmSent).forEach(function (vessel) {
          var mmsi = app.getPath('vessels.' + vessel + '.mmsi')
          app.handleMessage(plugin.id, {
            context: 'vessels.' + app.selfId,
            updates: [
              {
                values: [
                  {
                    path: 'notifications.navigation.closestApproach.' + vessel,
                    value: {
                      state: 'normal',
                      timestamp: new Date().toISOString()
                    }
                  }
                ]
              }
            ]
          })
        })
      }
    },
    calculator: function (selfPosition, selfCourse, selfSpeed) {
      var selfCourseDeg = geoutils.radToDeg(selfCourse)
      var selfVessel = {
        location: { lon: selfPosition.longitude, lat: selfPosition.latitude },
        speed: selfSpeed, // meters/second
        heading: selfCourseDeg // degrees
      }
      var vesselList = app.getPath('vessels')
      var deltas = []
      for (var vessel in vesselList) {
        var cpa, tcpa
        if (typeof vessel === 'undefined' || vessel == app.selfId) {
          continue
        }
        var vesselPos = app.getPath(
          'vessels.' + vessel + '.navigation.position.value'
        )
        if (typeof vesselPos !== 'undefined') {
          var distance = geolib.getDistanceSimple(
            {
              latitude: selfPosition.latitude,
              longitude: selfPosition.longitude
            },
            { latitude: vesselPos.latitude, longitude: vesselPos.longitude }
          )
          if (
            distance >= plugin.properties.traffic.range &&
            plugin.properties.traffic.range >= 0
          ) {
            app.debug('distance outside range, dont calculate')
            continue
          } // if distance outside range, don't calculate

          var vesselTimestamp = app.getPath(
            'vessels.' + vessel + '.navigation.position.timestamp'
          )
          vesselTimestamp = new Date(vesselTimestamp).getTime()

          var currentTime
          var currentTimeString = app.getSelfPath('navigation.datetime.value')
          if (currentTimeString) {
            currentTime = new Date(currentTimeString).getTime()
          } else {
            currentTime = Date.now()
          }

          var secondsSinceVesselUpdate = Math.floor(
            (currentTime - vesselTimestamp) / 1e3
          )
          if (secondsSinceVesselUpdate > plugin.properties.traffic.timelimit) {
            app.debug('old data from vessel, not calculating')
            continue
          } // old data from vessel, not calculating

          var vesselCourse = app.getPath(
            'vessels.' + vessel + '.navigation.courseOverGroundTrue.value'
          )
          var vesselSpeed = app.getPath(
            'vessels.' + vessel + '.navigation.speedOverGround.value'
          )

          if (!_.isUndefined(vesselCourse) && !_.isUndefined(vesselSpeed)) {
            var vesselCourseDeg = geoutils.radToDeg(vesselCourse)
            var otherVessel = {
              location: {
                lon: vesselPos.longitude,
                lat: vesselPos.latitude
              },
              speed: vesselSpeed, // meters/second
              heading: vesselCourseDeg // degrees
            }

            const obj = geoutils.cpa(selfVessel, otherVessel)
            tcpa = obj.time
            cpa = obj.distance

            if (
              _.isUndefined(plugin.properties.traffic.sendNotifications) ||
              plugin.properties.traffic.sendNotifications
            ) {
              let alarmDelta
              let notificationLevelIndex = 0
              if (cpa != null && tcpa != null && tcpa > 0) {
                plugin.properties.traffic.notificationZones
                  .filter(notificationZone => notificationZone.active === true)
                  .forEach(notificationZone => {
                    if (
                      cpa <= notificationZone.range &&
                      tcpa <= notificationZone.timeLimit
                    ) {
                      var newNotificationLevelIndex = notificationLevels.indexOf(
                        notificationZone.level
                      )
                      notificationLevelIndex =
                        newNotificationLevelIndex > notificationLevelIndex
                          ? newNotificationLevelIndex
                          : notificationLevelIndex
                    }
                  })
              }
              if (notificationLevelIndex > 0) {
                var mmsi = app.getPath('vessels.' + vessel + '.mmsi')
                app.debug('sending CPA alarm for ' + vessel)
                let vesselName = app.getPath('vessels.' + vessel + '.name')
                if (!vesselName) {
                  vesselName = mmsi || '(unknown)'
                }
                alarmDelta = {
                  context: 'vessels.' + app.selfId,
                  updates: [
                    {
                      values: [
                        {
                          path:
                            'notifications.navigation.closestApproach.' +
                            vessel,
                          value: {
                            state: notificationLevels[notificationLevelIndex],
                            method: ['visual', 'sound'],
                            message: `Crossing vessel ${vesselName} ${cpa.toFixed(
                              2
                            )} m away in ${(tcpa / 60).toFixed(2)}  minutes`,
                            timestamp: new Date().toISOString()
                          }
                        }
                      ]
                    }
                  ]
                }

                alarmSent[vessel] = true
              } else {
                if (
                  alarmSent[vessel] &&
                  typeof alarmSent[vessel] !== 'undefined'
                ) {
                  app.debug(`Clearing alarm for ${vessel}`)
                  alarmDelta = normalAlarmDelta(vessel, mmsi)
                  alarmSent[vessel] = false
                }
              }
              if (alarmDelta) {
                deltas.push(alarmDelta) // send notification
              }
            }
          }
          app.debug(vessel + ' TCPA: ' + tcpa + ' CPA: ' + cpa)

          deltas.push({
            context: 'vessels.' + vessel,
            updates: [
              {
                values: [CPA_TCPA(cpa, tcpa)]
              }
            ]
          })
        }
      }

      return deltas
    }
  }
}

function CPA_TCPA (cpa, tcpa) {
  return {
    path: 'navigation.closestApproach',
    value:
      cpa != null
        ? {
          distance: cpa,
          timeTo: tcpa
        }
        : null,
    timestamp: new Date().toISOString()
  }
}

function normalAlarmDelta (vessel, mmsi) {
  return {
    context: 'vessels.' + vessel,
    updates: [
      {
        values: [
          {
            path: 'notifications.navigation.closestApproach.' + vessel,
            value: {
              state: 'normal',
              timestamp: new Date().toISOString()
            }
          }
        ]
      }
    ]
  }
}
