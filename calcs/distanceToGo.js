module.exports = function(app) {
    return {
        group: 'dtg',
        optionKey: 'dtg',
        title: "Distance To Go (based on courseGreatCircle.nextPoint.position)",
        derivedFrom: [ "navigation.courseGreatCircle.nextPoint.position",
                        "navigation.position" ],
        calculator: function (nextPointPosition, vesselPosition) {
            let distance= (!nextPointPosition || !vesselPosition) ?
                null : calcDistance(vesselPosition, nextPointPosition)

            //** Calculate the great circle distance between two points in metres
            function calcDistance(srcpt, destpt) {
                let Rk= 6373 // mean radius of the earth (km) at 39 degrees from the equator
                let lat1= degreesToRadians(srcpt.latitude)
                let lon1= degreesToRadians(srcpt.longitude)
                let lat2= degreesToRadians(destpt.latitude)
                let lon2= degreesToRadians(destpt.longitude)
                let dlat= lat2 - lat1
                let dlon= lon2 - lon1
                let a= Math.pow(Math.sin(dlat/2),2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dlon/2),2)
                let c= 2 * Math.atan2(Math.sqrt(a),Math.sqrt(1-a)) // great circle distance in radians
                return (c * Rk) * 1000 // great circle distance in m
            }

            function degreesToRadians(val) {  return val * Math.PI/180 }

            return [{ 
                path: "navigation.courseGreatCircle.nextPoint.distance",
                value: distance
            }]
        }
    };
}