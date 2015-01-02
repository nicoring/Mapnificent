var Quadtree = require('quadtree');
var _ = require('lodash');
var MapnificentPosition = require('./mapnificent-position');
var Geo = require('./geo');
var Events = require('backbone-events');

function Mapnificent(options) { /*map, */ 
  // this.map = map;
  // 
  _.extend(this, Events);

  if (!options || !options.cityid)  {
    throw new Error("provide options.cityid, e.g. \"berlin\"");
  }

  if (!options.version) {
    throw new Error("provide options.version, e.g \"3\"");
  }

  this.positions = [];
  this.time = 60 * 10;
  this.settings = _.extend({
    intervalKey: 'm2',
    baseurl: '/',
    dataPath: '../data/' + options.cityid + '/',
    maxWalkTime: 15 * 60,
    secondsPerKm: 13 * 60,
    maxWalkTravelTime: 60 * 60,
    redrawOnTimeDrag: false,
    autostart: true
  }, options);
}

Mapnificent.prototype.init = function() {
  // var self = this; // , t0;
  // self.tilesLoading = false;

  var data = this.loadData();
  this.prepareData(data);

    // self.canvasTileLayer = L.tileLayer.canvas();
    // self.canvasTileLayer.on('loading', function(){
      // console.log('loading');
      // self.tilesLoading = true;
      // t0 = new Date().getTime();
    // });
    // self.canvasTileLayer.on('load', function(){
      // self.tilesLoading = false;
      // if (self.needsRedraw) {
        // self.redraw();
      // }
      // self.redrawTime = (new Date().getTime()) - t0;
      // console.log('load', self.redrawTime);
    // });
    // self.canvasTileLayer.drawTile = self.drawTile();
    // self.map.addLayer(self.canvasTileLayer);
    // self.map.on('click', function(e) {
        // self.addPosition(e.latlng);
    // });

};

Mapnificent.prototype.loadData = function() {
  var dataUrl = this.settings.dataPath + this.settings.cityid + '-' + this.settings.version + '-1.json';
  return require(dataUrl); //$.getJSON(dataUrl);
};


// process huge JSON into computable data
/** 
 * Load json data into an array.
 * Data is structured as followed:
 *
 * [
 *   ...
 *   {
 *     station_id: {
 *       "a": latitude,
 *       "r": [ // reachable stations
 *         {
 *           "s": station_id,
 *           "t": time_in_seconds_to_get_to_station,
 *           "l": line_to_take_to_station,
 *           
 *           
 *         }
 *       ]
 *     }
 *   }
 * ]
 */
Mapnificent.prototype.prepareData = function(data) {
  var stations = this.stations = data[0];
  this.lines = data[1];
  this.stationList = [];
  for (var key in stations){
    stations[key].id = key;
    stations[key].lat = stations[key].a;
    stations[key].lng = stations[key].n;
    delete stations[key].a;
    delete stations[key].n;
    this.stationList.push(stations[key]);
  }
  this.quadtree = Quadtree.create(
    this.settings.southeast.lat, this.settings.northwest.lat,
    this.settings.northwest.lng, this.settings.southeast.lng
  );
  this.quadtree.insertAll(this.stationList);
};

/* ### MOVED TO geo.js

Mapnificent.prototype.distanceBetweenCoordinates = function(lat, lng, slat, slng) {
  var EARTH_RADIUS = 6371000.0; // in m
  var toRad = Math.PI / 180.0;
  return Math.acos(Math.sin(slat * toRad) * Math.sin(lat * toRad) +
      Math.cos(slat * toRad) * Math.cos(lat * toRad) *
      Math.cos((lng - slng) * toRad)) * EARTH_RADIUS;

};*/

Mapnificent.prototype.findNextStations = function(lat, lng, radius) {
  var stops = this.quadtree.searchInRadius(lat, lng, radius);
  var results = [];
  for (var i = 0; i < stops.length; i += 1) {
    results.push([stops[i], Geo.distanceBetweenCoordinates(
      lat, lng, stops[i].lat, stops[i].lng)]);
  }

  // sort by distance
  results.sort(function(a, b){
    if (a[1] > b[1]) {
      return 1;
    } else if (a[1] < b[1]) {
      return -1;
    }
    return 0;
  });
  return results;
};

// Mapnificent.prototype.redraw = function(){
  // var self = this;
  // this.needsRedraw = true;
  // if (this.canvasTileLayer) {
    // if (this.tilesLoading) {
      // return;
    // }
    // L.Util.requestAnimFrame(function(){
      // self.needsRedraw = false;
      // self.canvasTileLayer.redraw();
    // });
  // }
// };

/**
 * Add a MapnificentPosition instance to stack of positions.
 * 
 * @param {Position} latlng 
 * @param {String} id     unique identifier of position
 * @return {MapnificentPosition} the created position
 */
Mapnificent.prototype.addPosition = function(latlng, id) {
  var self = this;
  this.positions[id] = new MapnificentPosition(this, latlng);
  // this.positions[id].on('done', function() {
    // delete self.positions[id];
  // });

  return this.positions[id];
};

Mapnificent.prototype.removePosition = function(pos) {
  this.positions = this.positions.filter(function(p){
    return p !== pos;
  });
  pos.destroy();
  // this.redraw();
};

// Mapnificent.prototype.drawTile = function() {
//   var self = this;

//   var maxWalkTime = this.settings.maxWalkTime;
//   var secondsPerKm = this.settings.secondsPerKm;

//   return function(canvas, tilePoint) {
//     if (!self.stationList || !self.positions.length) {
//       return;
//     }
//     var ctx = canvas.getContext('2d');
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     /* Figure out how many stations we have to look at around
//        this tile.
//     */

//     var tileSize = this.options.tileSize;
//     var start = tilePoint.multiplyBy(tileSize);
//     var end = start.add([tileSize, 0]);
//     var startLatLng = this._map.unproject(start);
//     var endLatLng = this._map.unproject(end);
//     var spanInMeters = startLatLng.distanceTo(endLatLng);
//     var maxWalkDistance = maxWalkTime * (1 / secondsPerKm) * 1000;
//     var middle = start.add([tileSize / 2, tileSize / 2]);
//     var latlng = this._map.unproject(middle);

//     var searchRadius = Math.sqrt(spanInMeters * spanInMeters + spanInMeters * spanInMeters);
//     searchRadius += maxWalkDistance;

//     var stationsAround = self.quadtree.searchInRadius(latlng.lat, latlng.lng, searchRadius);

//     ctx.globalCompositeOperation = 'source-over';
//     ctx.fillStyle = 'rgba(50,50,50,0.4)';
//     ctx.fillRect(0, 0, canvas.width, canvas.height);

//     ctx.globalCompositeOperation = 'destination-out';
//     ctx.fillStyle = 'rgba(0,0,0,1)';

//     for (var i = 0; i < self.positions.length; i += 1) {
//       var drawStations = self.positions[i].getReachableStations(stationsAround, start, tileSize);
//       for (var j = 0; j < drawStations.length; j += 1) {
//         ctx.beginPath();
//         ctx.arc(drawStations[j].x, drawStations[j].y,
//                 drawStations[j].r, 0, 2 * Math.PI, false);
//         ctx.fill();
//       }
//     }
//   };
// };

module.exports = Mapnificent;
