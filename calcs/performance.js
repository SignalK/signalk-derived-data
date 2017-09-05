

const _ = require('lodash')

// for the moment, hard code the polar data.

module.exports = function(app) {

  /**
   * find the indexes a below and above the value of b.
   */
  function findIndexes (a, v) {
    var upper = _.findIndex(a,function(o) { return o  > v});
    if ( upper === 0 ) {
      return [ upper, upper];
    } else if ( upper === -1) {
      return [ a.length-1, a.length-1];
    } 
    return [ upper-1, upper];
  }

  /**
   * find y between yl and yh in the same ratio of x between xl, xh
   * simple straight line interpolation.
   */
  function interpolate(x, xl, xh, yl, yh) {
      var r = 0;
      if ( x >= xh ) {
        r = yh;
      } else if ( x <= xl ) {
        r =  yl;
      } else if ( (xh - xl) < 1.0E-8 ) {
        r =  yl+(yh-yl)*((x-xl)/1.0E-8);
      } else {
        r = yl+(yh-yl)*((x-xl)/(xh-xl));
      }
      return r;
  }

  function msToKnots(v) { 
    return v*3600/1852.0; 
  }

  function knotsToMs(v) {
    return v*1852.0/3600; 
  }
  function radToDeg(v) {
    return v*180.0/Math.PI
  }
  function degToRad(v) {
    return v*Math.PI/180.0;
  }
  function fixAngle(d) {
    if ( d > Math.PI ) d = d - Math.PI;
    if ( d < -Math.PI) d = d + Math.PI;
    return d;
  }

  /**
   * Returns polarPerf = {
      vmg : 0,
      polarVmg: 0;
      polarSpeed: 0,
      polarSpeedRatio:  1,
      polarVmgRatio: 1
    }
    Only calcuates polr Vmg ration is targets is defined.
   */
  function getPerformance(polarData, tws, twa, stw, targets) {
    var polarPerf = {
      vmg : 0,
      polarVmg: 0,
      polarSpeed: 0,
      polarSpeedRatio:  1,
      polarVmgRatio: 1
    }
    if ( !polarData.siunits ) {
      tws = msToKnots(tws);
      twa = radToDeg(twa);      
    }
    // after here in Deg and Kn
    if ( twa < 0) twa = -twa;
    var twsi = findIndexes(polarData.tws, tws);
    var twai = findIndexes(polarData.twa, twa);
    if ( polarData.lookup ) {
      // polar data has been pre-interpolated, so simply lookup on the uper end of the range.
      // the degree range will 
      polarPerf.polarSpeed = polarData.stw[twai[1]][twsi[1]];
    } else {
      // interpolate a stw low value for a given tws and range
      if ( twsi[0] >= polarData.stw[0].length || twsi[1] >= polarData.stw[0].length ) {
        console.log("ERROR TWSI===============================================================================")
      } 
       if ( twai[0] >= polarData.stw.length || twai[0] >= polarData.stw.length) {
        console.log("ERROR TWAI===============================================================================");
      }
      var stwl = interpolate(twa, polarData.twa[twai[0]], polarData.twa[twai[1]], polarData.stw[twai[0]][twsi[0]], polarData.stw[twai[1]][twsi[0]]);
      // interpolate a stw high value for a given tws and range
      var stwh = interpolate(twa, polarData.twa[twai[0]], polarData.twa[twai[1]], polarData.stw[twai[0]][twsi[1]], polarData.stw[twai[1]][twsi[1]]);
      // interpolate a stw final value for a given tws and range using the high an low values for twa.
      polarPerf.polarSpeed = interpolate(tws, polarData.tws[twsi[0]], polarData.tws[twsi[1]], stwl, stwh);      
    }
    // after here in SI units.
    if (!polarData.siunits) {
      twa = degToRad(twa);
      polarPerf.polarSpeed = knotsToMs(polarPerf.polarSpeed);      
    }
    if (polarPerf.polarSpeed !== 0) {
      polarPerf.polarSpeedRatio = stw/polarPerf.polarSpeed;
    }
    polarPerf.polarVmg = polarPerf.polarSpeed*Math.cos(twa);
    polarPerf.vmg = stw*Math.cos(twa);
    if ( targets !== undefined && Math.abs(targets.vmg) > 1.0E-8 ) {
       polarPerf.polarVmgRatio = polarPerf.vmg/targets.vmg;

    }
    return polarPerf;
  }

  function buildFinePolarTable(polar) {
    var finePolar = {
      lookup: true,
      siunits: true,
      twsstep : 0.1, // 600 0 - 60Kn
      twastep : 1,  //  180 0 - 180 deg
      tws : [],
      twa : [],
      stw : []  // 108000 elements
    }
    console.log("Starting fine polar build");
    for(var twa = 0; twa < polar.twa[polar.twa.length-1]; twa += 1) {
      finePolar.twa.push(degToRad(twa));
      finePolar.stw.push([]);
    }
    for(var tws = 0; tws < polar.tws[polar.tws.length-1]; tws += 0.1) {
      finePolar.tws.push(knotsToMs(tws));
    }
    for (var ia = 0; ia < finePolar.twa.length; ia++) {
      for (var is = 0; is < finePolar.tws.length; is++) {
        finePolar.stw[ia][is] = getPerformance(polar,finePolar.tws[is],finePolar.twa[ia],0).polarSpeed;
      }
    }
    //for (var is = 0; is < finePolar.tws.length; is++) {
    //  for (var ia = 0; ia < finePolar.twa.length; ia++) {
    //    console.log("FinePolar tws, twa, stw",msToKnots(finePolar.tws[is]),",",radToDeg(finePolar.twa[ia]),",",msToKnots(finePolar.stw[ia][is]));
    //  }
    //}

    console.log("Finished fine polar build, in SI units");
    return finePolar;
  }

  /**
   * for a given tws, what twa has the maximum vmg upwing or downwind.
   * returns targets for twa, stw, vmg. vmg will be -ve downwind.
   * var targets = {
      vmg: 0,
      twa: 0,
      stw: 0
    };
   */ 
  function calcTargetAngleSpeed(polarData,tws, twa) {
    // everything in SI here.
    var intwa = twa;
    if ( twa < 0) twa = -twa;
    var twal = 0; twah = Math.PI;
    if ( twa < Math.PI/2 ) {
      twah = Math.PI/2;
    } else {
      twal = Math.PI/2;
      // downwind scan from 90 - 180
    }
    var targets = {
      vmg: 0,
      twa: 0,
      stw: 0
    };
    for(var t = twal; t <= twah; t += Math.PI/180) {
      var polarPerf = getPerformance(polarData, tws, t, 0);
      var vmg = polarPerf.polarSpeed*Math.cos(t);
      if ( Math.abs(vmg) > Math.abs(targets.vmg) ) {
        targets.vmg = vmg;
        targets.twa = t;
        targets.stw = polarPerf.polarSpeed;
      }
    }
    if ( intwa < 0 ) {
      targets.twa = -targets.twa;
    }
    //console.log("Targets tws",msToKnots(tws),"twa:",radToDeg(targets.twa),"psp:",msToKnots(targets.stw),"vmg:",msToKnots(targets.vmg));
    return targets;
  }

  // calculates the other track
  function calcOtherTrack(polarPerformance, targets, tws, twa, stw, trueHeading, magneticVariation, leeway) {
    var otherTrack = {
      trackTrue: 0,
      trackMagnetic: 0,
      headingTrue: 0,
      headingMagnetic: 0

    }
    if ( leeway === undefined) {
      leeway = 0;
    }
    // new twa is the target twa, which is always +ve
    // We need track through water, not heading, so we must have leeway
    if ( twa > 0 ) {
      otherTrack.trackTrue = fixAngle(trueHeading-(twa+leeway)-(targets.twa+leeway));
      otherTrack.headingTrue = fixAngle(trueHeading-(twa)-(targets.twa));
    } else {
      otherTrack.trackTrue = fixAngle(trueHeading-(twa+leeway)+(targets.twa+leeway));
      otherTrack.headingTrue = fixAngle(trueHeading-(twa)-(targets.twa));
    }
    otherTrack.trackMagnetic = otherTrack.trackTrue + magneticVariation;
    otherTrack.headingMagnetic = otherTrack.headingTrue + magneticVariation;
    return otherTrack;
  }

    
  var polarPerf = {
    group: "performance",
    optionKey: 'polarPerformance',
    title: "Polar Performance using based on tws, twa, stw, hdt and variation",
    derivedFrom: [ "environment.wind.angleTrueWater", "environment.wind.speedTrue", "navigation.speedThroughWater", 
    'navigation.headingTrue', 'navigation.magneticVariation'
    ],
    init: function(options) {
      // need to find some way of loading a specif polar file
      var polar = require('../polar/pogo1250');

      if ( polar.twa.length !== polar.stw.length) {
        throw("Polar STW does not have enough rows for the TWA array. Expected:"+polar.twa.length+" Found:"+polar.stw.length);
      }
      for (var i = 0; i < polar.stw.length; i++) {
        if ( polar.tws.length !== polar.stw[i].length ) {
              throw("Polar STW row "+i+" does not ave enough columns Expected:"+polar.tws.length+" Found:"+polar.stw.length);
        }
      }
      for (var i = 1; i < polar.twa.length; i++) {
        if ( polar.twa[i] < polar.twa[i-1] ) {
          throw("Polar TWA must be in ascending order and match the columns of stw.");
        }
      };
      for (var i = 1; i < polar.tws.length; i++) {
        if ( polar.tws[i] < polar.tws[i-1] ) {
          throw("Polar TWA must be in ascending order and match the rows of stw.");
        }
      };
      // Optimisatin,
      polar = buildFinePolarTable(polar);
      polarPerf.polar = polar;
    },
    calculator: function(twa, tws, stw, trueHeading, magneticVariation){
      try {
      var targets = calcTargetAngleSpeed(polarPerf.polar, tws, twa, stw);
      var polarPerformance = getPerformance(polarPerf.polar, tws,twa, stw, targets);
      var track = calcOtherTrack(polarPerformance, targets, tws, twa, stw, trueHeading, magneticVariation);

      /*console.log("performance,",
        msToKnots(tws).toFixed(2),
        ",twa,",
        radToDeg(twa).toFixed(2),
        ",stw,",
        msToKnots(stw).toFixed(2),
        ",pstw,",
        msToKnots(polarPerformance.polarSpeed).toFixed(2),
        ",vmg,",
        msToKnots(polarPerformance.vmg).toFixed(2),
        ",pvmg,",
        msToKnots(polarPerformance.polarVmg).toFixed(2),
        ",pvmgr,",
        polarPerformance.polarVmgRatio.toFixed(2),
        ",tvmg,",
        msToKnots(targets.vmg).toFixed(2),
        ",ttwa,",
        radToDeg(targets.twa).toFixed(2),
        ",tstw,",
        msToKnots(targets.stw).toFixed(2),
        ",trt,",
        radToDeg(track.trackTrue).toFixed(2),
        ",trm,",
        radToDeg(track.trackMagnetic).toFixed(2),
        ",tht,",
        radToDeg(track.headingTrue).toFixed(2),
        ",thm,",
        radToDeg(track.headingMagnetic).toFixed(2)
        ); */
      return [
      { path: 'performance.polarSpeed', value: polarPerformance.polarSpeed},   // polar speed at this twa
      { path: 'performance.polarSpeedRatio', value: polarPerformance.polarSpeedRatio}, // polar speed ratio
      { path: 'performance.tackMagnetic', value: track.trackMagnetic}, // other track through water magnetic taking into account leeway 
      { path: 'performance.tackTrue', value: track.trackTrue}, // other track through water true taking into account leeway
      { path: 'performance.headingMagnetic', value: track.headingMagnetic}, // other track heading on boat compass
      { path: 'performance.headingTrue', value: track.headingTrue}, // other track heading true
      { path: 'performance.targetAngle', value: targets.twa}, // target twa on this track for best vmg
      { path: 'performance.targetSpeed', value: targets.stw}, // target speed on at best vmg and angle
      { path: 'performance.targetVelocityMadeGood', value: targets.vmg}, // target vmg -ve == downwind
      { path: 'performance.velocityMadeGood', value: polarPerformance.vmg}, // current vmg at polar speed
      { path: 'performance.polarVelocityMadeGoodRatio', value: polarPerformance.polarVmgRatio} // current vmg vs current polar vmg.
            ];
      } catch (e) {
        console.log(e);
      }
    }
  };

  return polarPerf;
}