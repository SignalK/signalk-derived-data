# signalk-derived-data

[![Greenkeeper badge](https://badges.greenkeeper.io/sbender9/signalk-derived-data.svg)](https://greenkeeper.io/)


Generates deltas for values derived from  signalk values

It currently calculates:

* Outside air density (based on humidity, temperature and pressure)
* Battery Power
* Depth Below Keel (based on depth.belowSurface and design.draft.maximum)
* Depth Below Keel (based on depth.belowTransducer and depth.transducerToKeel)
* Depth Below Surface (based on depth.belowKeel and design.draft.maximum)
* Outside air dew point (based on humidity and temperature)
* Fuel economy (based on speed over ground, fuel rate)
* Ground Wind Angle and Speed (based on SOG, AWA and AWS)
* Prop slip (based on RPM, propulsion.*.transmission.gearRatio and propulsion.*.drive.propeller.pitch)
* Sets environment.sun to dawn, sunrise, day, sunset, dusk or night (based on navigation.datetime or system time and navigation.position)
* Tank Volume (based on currentLevel (requires calibration pairs (>2 for parallell sides, >3 for straight wedge and >4 for more complex shapes))
* True Wind Angle, Direction and Speed (based on speed through water, AWA and AWS)
* Velocity Made Good to Course (based on courseGreatCircle.nextPoint.bearingTrue heading true and speedOverGround)
* Velocity Made Good to wind (based on wind.directionTrue and speedOverGround)
* Outside air wind chill (based on wind speed and temperature)
* Magnetic Wind Direction (based on wind.directionTrue and magneticVarition)

To add new calculations, just create a new file under the `./calcs` directory.

For example. This is the VMG calculator.

```
module.exports = function(app) {
  return {
    group: 'vmg',
    optionKey: 'vmg',
    title: "Velocity Made Goog (based on courseGreatCircle.nextPoint.bearingTrue heading true and speedOverGround)",
    derivedFrom: [ "navigation.courseGreatCircle.nextPoint.bearingTrue",
                   "navigation.headingTrue",
                   "navigation.speedOverGround" ],
    calculator: function (bearingTrue, headingTrue, speedOverGround)
    {
      var angle = Math.abs(bearingTrue-headingTrue)
      return [{ path: "navigation.courseGreatCircle.nextPoint.velocityMadeGood",
                value: Math.cos(bearingTrue-headingTrue) * speedOverGround}]
    }
  };
}
```
