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
	}
};

module.exports = Geo;
