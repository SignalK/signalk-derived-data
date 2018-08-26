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


module.exports = function(app, plugin) {
  return {
    group: 'traffic',
    optionKey: 'collision',
    title: "Calculates closest point of approach distance and time. (based on navigation.position for vessels)",
    derivedFrom: [ "navigation.position" , "navigation.courseOverGroundTrue",  "navigation.speedOverGround"],
    properties: {
      range: {
        type: "number",
        title: "calculate for all vessels within this range (m), negative to disable filter",
        default: 1852
      },
      timmeout: {
        type: "number",
        title: "Discard other vessel data if older than this (in seconds), negative to disable filter",
        default: 30
      }
    },
    defaults: [undefined, undefined, undefined],
    debounceDelay: 60*1000,
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
          if(distance >= plugin.properties.range && plugin.properties.range >= 0){
            continue
          }//if distance outside range, don't calculate

          var vesselTimestamp = app.getPath('vessels.' + vessel + '.navigation.position.timestamp')
          var currentTime = (new Date()).toISOString()
          var secondsSinceVesselUpdate = Math.floor((currentTime - vesselTimestamp) / 1e3)
          if (secondsSinceVesselUpdate > plugin.properties.timeout){
            continue
          }//old data from vessel, not calculating

          var vesselCourse = app.getPath('vessels.' + vessel + '.navigation.courseOverGroundTrue.value')
          var vesselSpeed = app.getPath('vessels.' + vessel + '.navigation.speedOverGround.value')

          var vesselPositionArray = [vesselPos.latitude, vesselPos.longitude, 0]
          var vesselSpeedArray = generateSpeedVector(vesselPos, vesselSpeed, vesselCourse)

          var tcpa = motionpredict.calcCPATime(selfPositionArray,selfSpeedArray,vesselPositionArray,vesselSpeedArray)
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

          app.debug('TCPA: ' + tcpa + ' CPA: '  + cpa)


          deltas.push({
            "context": "vessels." + vessel,
            "updates": [
              {
                "timestamp": (new Date()).toISOString(),
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
    "value": {
      "distance": cpa,
      "timeTo": tcpa
    },
    "timestamp": (new Date()).toISOString()
  };
}


function generateSpeedVector(position, speed, course){
  var northSpeed = speed * Math.cos(course) / 1.94384 / 60 / 3600//to degrees per second (knots/60 angle minutes /3600 s/h)
  var eastSpeed = speed * Math.sin(course) / 1.94384 / 60 /3600 * Math.abs(Math.sin(position.latitude))//to degrees per second
  return [northSpeed, eastSpeed, 0]
}
