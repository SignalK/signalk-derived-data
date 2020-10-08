const LatLon = module.require('@panaaj/sk-geodesy/latlon-spherical')
  .LatLonSpherical

module.exports = function (app) {
  return {
    group: 'xte',
    optionKey: 'xte',
    title:
      'Cross track Error (based on courseGreatCircle.nextPoint.position, courseGreatCircle.previousPoint.position)',
    derivedFrom: [
      'navigation.courseGreatCircle.nextPoint.position',
      'navigation.courseGreatCircle.previousPoint.position',
      'navigation.position'
    ],
    calculator: function (nextPointPosition, previousPosition, vesselPosition) {
      let xte
      if (!nextPointPosition || !previousPosition || !vesselPosition) {
        xte = null
      } else {
        let pos = new LatLon(vesselPosition.latitude, vesselPosition.longitude)
        xte = pos.crossTrackDistanceTo(
          new LatLon(previousPosition.latitude, previousPosition.longitude),
          new LatLon(nextPointPosition.latitude, nextPointPosition.longitude)
        )
      }

      return [
        {
          path: 'navigation.courseGreatCircle.crossTrackError',
          value: xte
        }
      ]
    }
  }
}
