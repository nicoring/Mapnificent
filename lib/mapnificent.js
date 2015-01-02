var Quadtree = require('quadtree');
var _ = require('lodash');
var MapnificentPosition = require('./mapnificent-position');
var Geo = require('./geo');
var Events = require('backbone-events');

function Mapnificent(options) {
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
    autostart: true
  }, options);
}

Mapnificent.prototype.init = function() {

  var data = this.loadData();
  this.prepareData(data);

};

Mapnificent.prototype.loadData = function() {
  var dataUrl = this.settings.dataPath + this.settings.cityid + '-' + this.settings.version + '-1.json';
  return require(dataUrl);
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

/**
 * Add a MapnificentPosition instance to stack of positions.
 * 
 * @param {Position} latlng 
 * @param {Number}  time  time in seconds
 * @param {String} id     unique identifier of position
 * @return {MapnificentPosition} the created position
 */
Mapnificent.prototype.addPosition = function(latlng, time, id) {
  var self = this;
  this.positions[id] = new MapnificentPosition(this, latlng, time);

  return this.positions[id];
};

Mapnificent.prototype.removePosition = function(pos) {
  this.positions = this.positions.filter(function(p){
    return p !== pos;
  });
  pos.destroy();
};

module.exports = Mapnificent;
