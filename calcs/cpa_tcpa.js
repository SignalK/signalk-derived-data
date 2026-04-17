const _ = require('lodash')
const geolib = require('geolib')
const geoutils = require('geolocation-utils')

var alarmSent = {}
var notificationLevels = ['normal', 'alert', 'warn', 'alarm', 'emergency']

module.exports = function (app, plugin) {
  // Parses a SignalK timestamp (ISO string on the node, or undefined) and
  // returns true when older than `timelimitSec`. Missing/unparseable
  // timestamps are treated as stale so misconfigured feeders don't produce
  // phantom "fresh" data.
  function isStale(currentMs, timestampRaw, timelimitSec) {
    if (!timestampRaw) return true
    const t = new Date(timestampRaw).getTime()
    if (!Number.isFinite(t)) return false // non-parsing node (object) -> not stale
    return Math.floor((currentMs - t) / 1000) > timelimitSec
  }

  // Resolve the per-tick reference clock once, using the self vessel's
  // reported navigation.datetime when present (lets the plugin stay honest
  // when the host clock drifts vs. GPS time) and falling back to Date.now().
  function currentTimeMs() {
    const s = app.getSelfPath('navigation.datetime.value')
    return s ? new Date(s).getTime() : Date.now()
  }

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
      distanceToSelf: {
        type: 'boolean',
        title: 'Calculate distance to self for all vessels',
        default: true
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
      app.debug('stopped')
    },
    calculator: function (selfPosition, selfCourse, selfSpeed) {
      const traffic = plugin.properties.traffic
      const range = traffic.range
      const rangeActive = range >= 0
      const timelimit = traffic.timelimit
      const distanceToSelfEnabled = traffic.distanceToSelf
      const sendNotifications =
        _.isUndefined(traffic.sendNotifications) || traffic.sendNotifications
      const notificationZones = traffic.notificationZones
      const selfId = app.selfId
      const selfLat = selfPosition.latitude
      const selfLon = selfPosition.longitude
      const selfCourseDeg = geoutils.radToDeg(selfCourse)
      const selfVessel = {
        location: { lon: selfLon, lat: selfLat },
        speed: selfSpeed, // meters/second
        heading: selfCourseDeg // degrees
      }
      const vesselList = app.getPath('vessels')
      const deltas = []
      const currentlyActiveNotifications = {}
      const currentMs = currentTimeMs()

      for (var vessel in vesselList) {
        var cpa, tcpa
        if (vessel == selfId) {
          continue
        }

        const vesselData = vesselList[vessel]
        if (!vesselData) {
          continue
        }
        const nav = vesselData.navigation
        if (!nav) {
          continue
        }
        const posNode = nav.position
        const posTimestamp = posNode && posNode.timestamp

        if (isStale(currentMs, posTimestamp, timelimit)) {
          app.debug('old position of vessel, not calculating')
          const currentDistanceToSelf =
            nav.distanceToSelf && nav.distanceToSelf.value
          if (currentDistanceToSelf !== null) {
            deltas.push({
              context: 'vessels.' + vessel,
              updates: [
                {
                  values: [
                    CPA_TCPA(null, null),
                    {
                      path: 'navigation.distanceToSelf',
                      value: null
                    }
                  ]
                }
              ]
            })
          }
          continue
        } // old data from vessel, not calculating

        const vesselPos = posNode && posNode.value
        if (typeof vesselPos !== 'undefined') {
          var distance = geolib.getDistance(
            {
              latitude: selfLat,
              longitude: selfLon
            },
            { latitude: vesselPos.latitude, longitude: vesselPos.longitude }
          )

          if (distanceToSelfEnabled) {
            app.debug('distance of ' + vessel + ' to self: ' + distance)
            app.handleMessage(plugin.id, {
              context: 'vessels.' + vessel,
              updates: [
                {
                  values: [
                    {
                      path: 'navigation.distanceToSelf',
                      value: distance
                    }
                  ]
                }
              ]
            })
          }

          if (distance >= range && rangeActive) {
            app.debug('distance outside range, dont calculate')
            continue
          } // if distance outside range, don't calculate

          // NB: these stale-check reads target the parent node (not
          // `.timestamp`) to match the pre-refactor behaviour — the companion
          // bug fix is tracked separately in PR #223 so it doesn't bundle
          // with this perf change.
          if (
            isStale(currentMs, nav.courseOverGroundTrue, timelimit) ||
            isStale(currentMs, nav.speedOverGround, timelimit)
          ) {
            app.debug('old course data from vessel, not calculating CPA')
            const vCourseVal = app.getPath(
              'vessels.' + vessel + '.navigation.courseOverGroundTrue.value'
            )
            const vSpeedVal = app.getPath(
              'vessels.' + vessel + '.navigation.speedOverGround.value'
            )
            if (vCourseVal !== null || vSpeedVal !== null) {
              deltas.push({
                context: 'vessels.' + vessel,
                updates: [
                  {
                    values: [CPA_TCPA(null, null)]
                  }
                ]
              })
            }
            continue
          }
          const vesselCourse =
            nav.courseOverGroundTrue && nav.courseOverGroundTrue.value
          const vesselSpeed = nav.speedOverGround && nav.speedOverGround.value
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

            if (sendNotifications) {
              let alarmDelta
              let notificationLevelIndex = 0
              if (cpa != null && tcpa != null && tcpa > 0) {
                notificationZones
                  .filter(
                    (notificationZone) => notificationZone.active === true
                  )
                  .forEach((notificationZone) => {
                    if (
                      cpa <= notificationZone.range &&
                      tcpa <= notificationZone.timeLimit
                    ) {
                      var newNotificationLevelIndex =
                        notificationLevels.indexOf(notificationZone.level)
                      notificationLevelIndex =
                        newNotificationLevelIndex > notificationLevelIndex
                          ? newNotificationLevelIndex
                          : notificationLevelIndex
                    }
                  })
              }
              if (notificationLevelIndex > 0) {
                var mmsi = vesselData.mmsi
                app.debug('sending CPA alarm for ' + vessel)
                let vesselName = vesselData.name
                if (!vesselName) {
                  vesselName = mmsi || '(unknown)'
                }
                const cpaPositions = getCpaPositions(
                  selfVessel,
                  otherVessel,
                  tcpa
                )
                alarmDelta = {
                  context: 'vessels.' + selfId,
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
                            other: `vessels.${vessel}`,
                            cpaPositions,
                            timestamp: new Date().toISOString()
                          }
                        }
                      ]
                    }
                  ]
                }

                alarmSent[vessel] = true
                currentlyActiveNotifications[vessel] = true
              } else {
                if (alarmSent[vessel]) {
                  app.debug(`Clearing alarm for ${vessel}`)
                  alarmDelta = normalAlarmDelta(selfId, vessel)
                  delete alarmSent[vessel]
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

      Object.keys(alarmSent)
        .filter((vessel) => !currentlyActiveNotifications[vessel])
        .forEach((vessel) => {
          app.debug(`Clearing alarm for ${vessel}`)
          deltas.push(normalAlarmDelta(selfId, vessel))
          delete alarmSent[vessel]
        })

      return deltas
    }
  }
}

function CPA_TCPA(cpa, tcpa) {
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

function normalAlarmDelta(selfId, vessel) {
  return {
    context: 'vessels.' + selfId,
    updates: [
      {
        values: [
          {
            path: 'notifications.navigation.closestApproach.' + vessel,
            value: {
              state: 'normal',
              timestamp: new Date().toISOString(),
              other: `vessels.${vessel}`
            }
          }
        ]
      }
    ]
  }
}

function getCpaPositions(selfVessel, otherVessel, seconds) {
  return {
    self: geoutils.moveTo(selfVessel.location, {
      distance: selfVessel.speed * seconds,
      heading: selfVessel.heading
    }),
    other: geoutils.moveTo(otherVessel.location, {
      distance: otherVessel.speed * seconds,
      heading: otherVessel.heading
    })
  }
}
