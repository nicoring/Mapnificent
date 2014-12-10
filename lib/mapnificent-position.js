var Geo = require('./geo');
var child_process = require('child_process');
var Events = require('backbone-events');
var _ = require('lodash');

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

  this.startCalculation();
}

MapnificentPosition.prototype.abortCalculation = function() {
  this.worker.kill("SIGABRT");
  this.trigger('abort', { mapnificentPosition: this });
};

/*MapnificentPosition.prototype.init = function(){
  var self = this;

  this.marker = new L.Marker(this.latlng, {
    draggable: true,
    opacity: 0.5
  });
  this.popup = new L.Popup({
    minWidth: 200
  });
  this.marker
    .bindPopup(this.popup)
    .addTo(this.mapnificent.map);
  this.marker.on('dragend', function(){
    self.updatePosition(self.marker.getLatLng());
  });
  this.startCalculation();
};*/

// MapnificentPosition.prototype.updatePosition = function(latlng) {
  // this.latlng = latlng;
  // this.stationMap = null;
  // this.progress = 0;
  // this.startCalculation();
  // this.marker.openPopup();
  // this.mapnificent.redraw();
// };

MapnificentPosition.prototype.updateProgress = function(count) {
  percent = count / this.maxEstimatedCalls * 100;
  // if (percent > 99){
  //   percent = 99;
  // }

  this.trigger('progress', percent);
};


/*MapnificentPosition.prototype.renderProgress = function() {
  var div = $('<div class="position-control">'), self = this;
  var percent = 0;
  var progressBar = $('<div class="progress">' +
    '<div class="progress-bar progress-bar-mapnificent"  role="progressbar" aria-valuenow="' + percent + '" aria-valuemin="0" aria-valuemax="100" style="width: ' + percent + '%">' +
    '<span class="sr-only">' + percent + '% Complete</span>' +
  '</div></div>');
  div.append(progressBar);
  var removeSpan = $('<span class="position-remove glyphicon glyphicon-trash pull-right">').on('click', function(){
    self.mapnificent.removePosition(self);
  });

  div.append(removeSpan);
  this.popup.setContent(div[0]);
};*/

MapnificentPosition.prototype.setTime = function(time) {
  if (time !== this.time) {
    this.time = time;
    // this.mapnificent.redraw();
  }
};

/*MapnificentPosition.prototype.updateControls = function(){
  var self = this;

  var div = $('<div class="position-control">');

  var minutesTime = Math.round(this.time / 60);

  var input = $('<input type="range">').attr({
    max: Math.round(this.mapnificent.settings.maxWalkTravelTime / 60),
    min: 0,
    value: minutesTime
  }).on('change', function(){
    self.setTime(parseInt($(this).val()) * 60);
  }).on('mousemove keyup', function(){
    $(self.popup.getContent()).find('.time-display').text($(this).val() + ' min');
    if (self.mapnificent.settings.redrawOnTimeDrag) {
      self.setTime(parseInt($(this).val()) * 60);
    }
  });

  div.append(input);

  var timeSpan = $('<div class="pull-left">' +
    '<span class="glyphicon glyphicon-time"></span> ' +
     '<span class="time-display">' + minutesTime + ' min</span></div>');
  div.append(timeSpan);

  var removeSpan = $('<span class="position-remove glyphicon glyphicon-trash pull-right">').on('click', function(){
    self.mapnificent.removePosition(self);
  });

  div.append(removeSpan);

  this.popup.setContent(div[0]);
};*/

MapnificentPosition.prototype.createWorker = function(){
  
  // create once
  if (this.worker) {
    return;
  }

  this.worker = child_process.fork('./lib/mapnificentworker');
  this.worker.on('message', this.workerMessage());
  this.worker.on('error', this.workerError());

  // this.worker = new window.Worker(this.mapnificent.settings.baseurl + 'static/js/mapnificentworker.js');
  // this.worker.onmessage = this.workerMessage();
  // this.worker.onerror = this.workerError;
};

MapnificentPosition.prototype.workerMessage = function() {
  var self = this;

  return function(data) {
    if (data.status === 'working') {
      self.updateProgress(data.at);
    }

    else if (data.status === 'done') {
      console.log("done calculation");
      // self.updateProgress(100);
      // self.updateControls();
      self.stationMap = data.stationMap;

      // notify the worker that he is done
      self.worker.kill("SIGHUP");
      self.worker = null;
      
      // make sure progress is set to 100% when finishing
      self.updateProgress(self.maxEstimatedCalls);

      // self.mapnificent.redraw();
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
  // this.renderProgress();
  // this.marker.openPopup();
  this.createWorker();
  var nextStations = this.mapnificent.findNextStations(this.latlng.lat, this.latlng.lng, 1000);
  console.log(nextStations);
  // ##### this could be posted to server

  console.log("sending data...");
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

/**** TODO: replace leaflet dependencies ******/

MapnificentPosition.prototype.getReachableStations = function(stationsAround, start, tileSize) {
  var self = this;

  /* ### MOVED TO geo.js
  var getLngRadius = function(lat, mradius){
    var equatorLength = 40075017,
      hLength = equatorLength * Math.cos(L.LatLng.DEG_TO_RAD * lat);

    return (mradius / hLength) * 360;
  };*/

  var maxWalkTime = this.mapnificent.settings.maxWalkTime;
  var secondsPerKm = this.mapnificent.settings.secondsPerKm;


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

  var stations = [];

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

MapnificentPosition.prototype.destroy = function() {
  // this.mapnificent.map.closePopup(this.popup);
  // this.mapnificent.map.removeLayer(this.popup);
  // this.mapnificent.map.removeLayer(this.marker);
  this.abortCalculation();
  this.worker = null;
  this.stationMap = null;
  // this.marker = null;
  // this.popup = null;
  // this.redrawTime = 0;
};

module.exports = MapnificentPosition;
