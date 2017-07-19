# signalk-derived-data
Generates deltas for values derived from  signalk values

It currently calculates:

* True Wind
* Ground Wind
* Depth Below Surface
* Depth Below Keel
* Propeller Slip calculation (requires defaults.json to include propulsion.\*.drive.propeller.pitch and propulsion.\*.transmission.gearRatio)
* VMG
* Wind Shift (experimental)

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
