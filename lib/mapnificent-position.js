var Geo = require('./geo');
var child_process = require('child_process');
var Events = require('backbone-events');
var _ = require('lodash');
var $ = require('jquery-deferred');

/* globals $, Quadtree, console, L */

function MapnificentPosition(mapnificent, latlng, time) {

  // enable backbone events
  _.extend(this, Events);

  this.mapnificent = mapnificent;
  this.latlng = latlng;
  this.stationMap = null;
  this.progress = 0;
  this.time = time === undefined ? 10 * 60 : 0;
  this.maxEstimatedCalls = this.mapnificent.settings.options.estimatedMaxCalculateCalls || 100000;
  this.done = false;

  this.startCalculation();
}

MapnificentPosition.prototype.destroy = function() {
  this.abortCalculation();
  this.worker = null;
  this.stationMap = null;
  this.done = false;
};

MapnificentPosition.prototype.updateProgress = function(count) {
  percent = count / this.maxEstimatedCalls * 100;

  // catch false-positive 100-percent completion
  // otherwise frontend could be confused
  if (percent > 99 && percent < 100){
    percent = 99;
  }

  this.trigger('progress', percent);
};

MapnificentPosition.prototype.setTime = function(time) {
  if (time !== this.time) {
    this.time = time;
  }
};

MapnificentPosition.prototype.createWorker = function(){
  // create once
  if (this.worker) {
    return;
  }

  this.worker = child_process.fork('./lib/mapnificentworker');
  this.worker.on('message', this.workerMessage());
  this.worker.on('error', this.workerError());
};

MapnificentPosition.prototype.workerMessage = function() {
  var self = this;

  return function(data) {
    if (data.status === 'working') {
      self.updateProgress(data.at);
    }

    else if (data.status === 'done') {
      console.log("done calculation");
      self.stationMap = data.stationMap;

      // notify the worker that he is done
      self.worker.kill("SIGHUP");
      self.worker = null;
      
      // make sure progress is set to 100% when finishing
      self.updateProgress(self.maxEstimatedCalls);

      self.done = true;
      self.trigger('done', self, data);
    }
  };
};

MapnificentPosition.prototype.workerError = function() {
  var self = this;

  return function(error){
    console.log('error', error);
    self.trigger('error', self, error);
  };
};

MapnificentPosition.prototype.startCalculation = function() {
  this.createWorker();

  // search for stations one can reach by walking
  // this is a good guess on the closest stations
  var nextStations = this.mapnificent.findNextStations(this.latlng.lat, this.latlng.lng, 1000);
  console.log("next stations", nextStations);

  this.worker.send({
      fromStations: nextStations.map(function(m){ return m[0].id; }),
      stations: this.mapnificent.stations,
      lines: this.mapnificent.lines,
      distances: nextStations.map(function(m){ return m[1] / 1000; }), // #### guess: get distances per kilometer
      reportInterval: 5000,
      intervalKey: this.mapnificent.settings.intervalKey,
      maxWalkTime: this.mapnificent.settings.maxWalkTime,
      secondsPerKm: this.mapnificent.settings.secondsPerKm,
  });
};

MapnificentPosition.prototype.abortCalculation = function() {
  this.worker.kill("SIGABRT");
  this.trigger('abort', { mapnificentPosition: this });
};

/**
 * Filters calculated station times by the users time constraint.
 * @param  {[type]} stationsAround [description]
 * @param  {[type]} start          [description]
 * @param  {[type]} tileSize       [description]
 * @return {[type]}                [description]
 */
MapnificentPosition.prototype.getReachableStations = function(stationsAround) {
  var self = this;
  var maxWalkTime = this.mapnificent.settings.maxWalkTime;
  var secondsPerKm = this.mapnificent.settings.secondsPerKm;
  var stations = [];

  /**
   * Add radius to station object.
   * 
   * @param  {LatLng} station     current station object (latlng, name)
   * @param  {Number} reachableIn seconds it takes to reach the `station`
   * @return {Station}            station object (latlng, name, radius)
   */
  var addRadiusToStation = function(station, reachableIn) {
    var seconds = Math.min((self.time - reachableIn), maxWalkTime);
    var radiusInMeters = seconds * (1 / secondsPerKm) * 1000;
    var lngRadius = Geo.getLngRadius(station.lat, radiusInMeters);

    return {
      lat: station.lat,
      lng: station.lng,
      radius: lngRadius
    };
  };

  // no valid calculation? then there will be no results
  if (this.stationMap === null) {
    return stations;
  }

  // you start walking from your position
  var station = addRadiusToStation(this.latlng, 0);
  stations.push(station);

  for (var i = 0; i < stationsAround.length; i++) {
    var stationTime = this.stationMap[stationsAround[i].id];

    // skip stations which are not reachable in time
    if (stationTime === undefined || stationTime >= this.time) {
      continue;
    }

    station = addRadiusToStation(stationsAround[i], stationTime);
    stations.push(station);
  }

  return stations;
};

/**
 * Get all stations available in relative sorting to the current position.
 * 
 * @return {$.Deferred} `done`-handler receives `stationMap` as first argument
 */
MapnificentPosition.prototype.getAllStationsByDistanceAndTime = function() {
  var self = this;

  function getStationsByDistanceAndTime() {
    var stations = self.mapnificent.quadtree.searchArea(self.mapnificent.quadtree.boundary);
    var stationsByDistanceAndTime = self.getReachableStations(stations);

    return stationsByDistanceAndTime;
  }

  // there will only be valid results when calculation is done
  // so lets wait until calculation is done...
  return $.Deferred(function(deferred) {

    // already done
    if (self.done) {
      deferred.resolve( getStationsByDistanceAndTime() );
    // listen for completion
    } else {
      self.listenTo(self, 'done', function() { 
        deferred.resolve( getStationsByDistanceAndTime() ); 
      });
    }

    // catch errors and cancelling
    self.listenTo(self, 'error', function(pos, error) { deferred.reject(error); });
    self.listenTo(self, 'abort', function() { deferred.reject(); });
  });
};

module.exports = MapnificentPosition;
