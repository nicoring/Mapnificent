var Geo = {
	distanceBetweenCoordinates: function(lat, lng, slat, slng) {
		var EARTH_RADIUS = 6371000.0; // in meters
		var toRad = Math.PI / 180.0;

		return Math.acos(
			Math.sin(slat * toRad) * Math.sin(lat * toRad) +
			Math.cos(slat * toRad) * Math.cos(lat * toRad) *
			Math.cos((lng - slng) * toRad)) * EARTH_RADIUS;

	},

	/**
	 * Determine radius in meters depending on latitude.
	 */
	getLngRadius: function(lat, mradius) {
		var equatorLength = 40075017;
		var DEG_TO_RAD = Math.PI / 180;
	    var hLength = equatorLength * Math.cos(DEG_TO_RAD * lat);

	    return (mradius / hLength) * 360;
	},

	/**
	 * Test radial intersection of a point and a circle, given by center
	 * and radius in longitudes.
	 * Based on pythagoras and squares only.
	 *
	 * @param {Number} x
	 * @param {Number} y
	 * @param {Number} circle_x
	 * @param {Number} circle_y
	 * @param {Number} radius
	 * @return {Boolean} true, if point is in circle
	 */
	isPointInCircle: function(x, y, circle_x, circle_y, radius) {
		return Math.pow(circle_x - x, 2) + Math.pow(circle_y - y, 2) < Math.pow(radius, 2);
	},

	/**
	 * Test if a point is inside an axis-aligned bounding box.
	 * 
	 * @param  {Number}  x     
	 * @param  {Number}  y     
	 * @param  {Number}  north 
	 * @param  {Number}  east  
	 * @param  {Number}  south 
	 * @param  {Number}  west  
	 * @return {Boolean} true, if point is inside aabb     
	 */
	isPointInAabb: function(x, y, north, east, south, west) {
		return west < x && x < east && south < y && y < north;
	}

 };

module.exports = Geo;
