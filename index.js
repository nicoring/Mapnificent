var Mapnificent = require('./lib/mapnificent');

// TESTING

var m = new Mapnificent({
	active: true,
	added: '2010-10-03T12:05:26.240272',
	changed: '2014-05-23T12:15:48.620486',
	cityid: 'berlin',
	cityname: 'Berlin',
	description: '',
	hidden: false,
	lat: 52.525592,
	lng: 13.369545,
	northwest: {
	  lat: 52.755362,
	  lng: 12.901471,
	},
	options: {
	  estimatedMaxCalculateCalls: 2100000
	},
	southeast: {
	  lat: 52.295934,
	  lng: 13.909891
	},
	version: 3,
	zoom: 11
});

m.init();
var pos = m.addPosition({ lat: 52.52026, lng: 13.38832 });

pos
	.on('done', function(mapnificentPosition, data) {
		// console.log(data);
	})
	.on('progress', function(percent) {
		console.log('percent', percent);
	});

pos.getAllStationsByDistanceAndTime()
	.done(function(stations) { console.log("stations", stations); });
