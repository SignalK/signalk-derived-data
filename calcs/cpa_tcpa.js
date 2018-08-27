var MathFunc = {
  add: function(a, b) {
    return [
      a[0] + b[0],
      a[1] + b[1],
      a[2] + b[2]
    ];
  },
  sub: function(a, b) {
    return [
      a[0] - b[0],
      a[1] - b[1],
      a[2] - b[2]
    ];
  },
  mulScalar: function(a, s) {
    return [
      a[0] * s,
      a[1] * s,
      a[2] * s
    ];
  },
  dot: function(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  },
  lengthSquared: function(a) {
    return a[0]*a[0] + a[1]*a[1] + a[2]*a[2];
  }
}


const geolib = require('geolib')
var motionpredict = require("lethexa-motionpredict").withMathFunc(MathFunc)
const _ = require('lodash')
var alarmSent = []

module.exports = function(app, plugin) {
  return {
    group: 'traffic',
    optionKey: 'CPA',
    title: "Calculates closest point of approach distance and time. (based on navigation.position for vessels)",
    derivedFrom: [ "navigation.position" , "navigation.courseOverGroundTrue",  "navigation.speedOverGround"],
    properties: {
      range: {
        type: "number",
        title: "Calculate for all vessels within this range (m), negative to disable filter",
        default: 1852
      },
      timelimit: {
        type: "number",
        title: "Discard other vessel data if older than this (in seconds), negative to disable filter",
        default: 30
      },
      notificationRange: {
        type: "number",
        title: "Dangerous targets notification CPA limit (m)",
        default: 1852
      },
      notificationTimeLimit: {
        type: "number",
        title: "Dangerous targets notification TCPA limit (s)",
        default: 600
      }
    },
    debounceDelay: 5*1000,
    stop: function() {
      if ( alarmSent.length < 1 ) {
        alarmSent.forEach(function(vessel) {
          alarmSent(vessel) = false;
        }
      )
      app.handleMessage(plugin.id, {
        "context": "vessels." + app.selfId,
        "updates": [
          {
            "source": {
              //"src": key
            },
            "path": 'notifications.navigation.closestApproach',
            "value": null
          }
        ]
      });
    }
  },
  calculator: function(selfPosition, selfCourse, selfSpeed) {

    var selfPositionArray = [selfPosition.latitude, selfPosition.longitude, 0]
    var selfSpeedArray = generateSpeedVector(selfPosition, selfSpeed, selfCourse)
    var vesselList = app.getPath('vessels')
    var deltas = []
    for(var vessel in vesselList){
      if(typeof vessel === 'undefined' || vessel == app.selfId){
        continue
      }
      var vesselPos = app.getPath('vessels.' + vessel + '.navigation.position.value')
      if(typeof vesselPos !== 'undefined'){

        var distance = geolib.getDistanceSimple({latitude: selfPosition.latitude, longitude: selfPosition.longitude}, {latitude: vesselPos.latitude, longitude: vesselPos.longitude})
        if(distance >= plugin.properties.traffic.range && plugin.properties.traffic.range >= 0){
          app.debug('distance outside range, dont calculate')
          continue
        }//if distance outside range, don't calculate

        var vesselTimestamp = app.getPath('vessels.' + vessel + '.navigation.position.timestamp')
        var currentTime = new Date(app.getSelfPath('navigation.datetime'))
        if ( ! currentTime ) {
          currentTime = (new Date()).toISOString()
        }
        var secondsSinceVesselUpdate = Math.floor((currentTime - vesselTimestamp) / 1e3)
        if (secondsSinceVesselUpdate > plugin.properties.traffic.timelimit){
          app.debug('old data from vessel, not calculating')
          continue
        }//old data from vessel, not calculating

        var vesselCourse = app.getPath('vessels.' + vessel + '.navigation.courseOverGroundTrue.value')
        var vesselSpeed = app.getPath('vessels.' + vessel + '.navigation.speedOverGround.value')

        var vesselPositionArray = [vesselPos.latitude, vesselPos.longitude, 0]
        var vesselSpeedArray = generateSpeedVector(vesselPos, vesselSpeed, vesselCourse)

        var tcpa = motionpredict.calcCPATime(selfPositionArray, selfSpeedArray, vesselPositionArray, vesselSpeedArray)
        var selfCpaPosition = motionpredict.getPositionByVeloAndTime(selfPositionArray, selfSpeedArray, tcpa)
        var vesselCpaPosition = motionpredict.getPositionByVeloAndTime(vesselPositionArray, vesselSpeedArray, tcpa)

        var cpa
        if(selfCpaPosition && vesselCpaPosition){
          cpa =  geolib.getDistanceSimple({latitude: selfCpaPosition[0], longitude: selfCpaPosition[1]}, {latitude: vesselCpaPosition[0], longitude:vesselCpaPosition[1]})
        }

        if(tcpa <= 0){
          cpa = null
          tcpa = null
        }

        let alarmDelta
        if(cpa != null && tcpa != null && cpa <= plugin.properties.traffic.notificationRange && tcpa <= plugin.properties.traffic.notificationTimeLimit){

          var mmsi = app.getPath('vessels.' + vessel + '.mmsi')
          app.debug('sending CPA alarm for ' + mmsi)
          let vesselName = app.getPath('vessels.' + vessel + '.name')
          if ( !vesselName ) {
            vesselName = vessel
          }
          alarmDelta = {
            "context": "vessels." + app.selfId,
            "updates": [
              {
                "values": [{
                  "path": 'notifications.navigation.closestApproach.' + mmsi,
                  "value": {
                    "state": "alert",
                    "method": [ "visual", "sound" ],
                    "message": `Crossing vessel ${vesselName} ${cpa} m away in ${(tcpa/60).toFixed(2)}  minutes`,
                    "timestamp": (new Date()).toISOString()
                  }
                }]
              }
            ]
          }

          alarmSent[vessel] = true
        } else {
          if ( alarmSent[vessel] && typeof alarmSent[vessel] !== 'undefined') {
            debug(`Clearing alarm for ${vessel}`)
            alarmDelta = normalAlarmDelta(mmsi)
            alarmSent[vessel] = false
          }
        }
        if ( alarmDelta ) {
          deltas.push(alarmDelta)//send notification
        }

        app.debug(vessel + ' TCPA: ' + tcpa + ' CPA: '  + cpa)


        deltas.push({
          "context": "vessels." + vessel,
          "updates": [
            {
              "values": [ CPA_TCPA(cpa, tcpa) ]
            }
          ]
        })
      }
    }

    return deltas
  }
};
}

function CPA_TCPA(cpa, tcpa)
{
  return {
    "path": 'navigation.closestApproach',
    "value": cpa != null ? {
      "distance": cpa,
      "timeTo": tcpa
    } : null,
    "timestamp": (new Date()).toISOString()
  };
}


function generateSpeedVector(position, speed, course){
  var northSpeed = speed * Math.cos(course) / 1.94384 / 60 / 3600//to degrees per second (knots/60 angle minutes /3600 s/h)
  var eastSpeed = speed * Math.sin(course) / 1.94384 / 60 /3600 * Math.abs(Math.sin(position.latitude))//to degrees per second
  return [northSpeed, eastSpeed, 0]
}

function normalAlarmDelta(mmsi)
{
  return {
    "context": "vessels." + mmsi,
    "updates": [
      {
        "values": [{
          "path": 'notifications.navigation.closestApproach.' + mmsi,
          "value": {
            "state": "normal",
            "timestamp": (new Date()).toISOString()
          }
        }]
      }
    ]
  }
}
