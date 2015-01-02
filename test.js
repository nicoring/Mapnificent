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
var berlinZoo = {lat: 52.5074, lng: 13.3326};
var overallTime = Date.now();
var pos = m.addPosition(berlinZoo); // friedr str. { lat: 52.52026, lng: 13.38832 }

var globPercent = 0;
pos
	.on('progress', function(percent) {
		if (percent > globPercent + 5) {
			console.log('progress', Math.floor(percent) +"%");
			globPercent = percent;
		}
	});

var timeStations = Date.now();
console.log("\ncollecting reachable stations");
pos.getAllStationsByDistanceAndTime()
	.done(function(stations) { 
		var time = Date.now();
		console.log("reachable stations time:", time-timeStations +"ms\n");

		console.log("aabb\n", stations.aabb, "\n");

		console.log("reading POI file");
		var points = require('./places.json');//[{lat: 52.498274, lng: 13.406531}, {lat: 52.498574, lng: 13.406521}, {lat: 60, lng: 60}];
		console.log("reading time:", Date.now()-time +"ms\n");

		console.log("intersecting POIs with stationMap");
		time = Date.now();

		var remainingPoints = pos.intersectPointsWithStations(points);

		console.log("intersection time:", (Date.now()-time) +"ms\n");

		time = Date.now();
		console.log("writing results to file");

		var fs = require('fs');
		fs.writeFile("filtered.json", JSON.stringify(remainingPoints), function() { 
			console.log("writing time:", Date.now()-time +"ms\n");
			console.log("overall time:", Date.now()-overallTime +"ms");
		});
	});
