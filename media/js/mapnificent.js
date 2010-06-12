/* 
    (c) Copyright 2010 Stefan Wehrmeyer.
    Released under Creative Commons By-NC-SA: http://creativecommons.org/licenses/by-nc-sa/3.0
    By: Stefan Wehrmeyer http://stefanwehrmeyer.com
    If you want to use this software commercially, contact the author.
    
*/

var Mapnificent = (function(){
    var CanvasOverlay = (function() {
        /* Most of this is from:
        http://code.google.com/apis/maps/documentation/javascript/overlays.html#CustomOverlays
        some of it is from: http://econym.org.uk/gmap/elabel.htm
        */
        function CanvasOverlay(point, canvasID, clb, map) {
            this.point = point;
            this.addclb = clb;
            this.canvasID = canvasID;
            // Optional parameters
            this.hidden = false;

            // Now initialize all properties.
            this.map_ = map;

            // We define a property to hold the image's
            // div. We'll actually create this div
            // upon receipt of the add() method so we'll
            // leave it null for now.
            this.div_ = null;

            // Explicitly call setMap() on this overlay
            this.setMap(map);
        }

        CanvasOverlay.prototype = new google.maps.OverlayView();
        CanvasOverlay.prototype.onAdd = function() {

          // Note: an overlay's receipt of onAdd() indicates that
          // the map's panes are now available for attaching
          // the overlay to the map via the DOM.

          // Create the DIV and set some basic attributes.
          var div = document.createElement('DIV');
          div.style.border = "none";
          div.style.borderWidth = "0px";
          div.style.position = "absolute";
          var cnvs = document.createElement("canvas");
          cnvs.id = this.canvasID;
          cnvs.width=20;
          cnvs.height=20;

          div.appendChild(cnvs);

          // Set the overlay's div_ property to this DIV
          this.div_ = div;

          // We add an overlay to a map via one of the map's panes.
          // We'll add this overlay to the overlayImage pane.
          var panes = this.getPanes();
          panes.mapPane.appendChild(div);
          
          this.projection = this.getProjection();
          this.addclb();
        };
        CanvasOverlay.prototype.draw = function() {
            var p = this.projection.fromLatLngToDivPixel(this.point);
            var h = parseInt(this.div_.clientHeight);
            this.div_.style.left = (p.x) + "px";
            this.div_.style.top = (p.y - h) + "px";
        };
        
        CanvasOverlay.prototype.fromLatLngToDivPixel = function(point){
            return this.projection.fromLatLngToDivPixel(point);
        };
        
        CanvasOverlay.prototype.fromDivPixelToLatLng = function(point){
            return this.projection.fromDivPixelToLatLng(point);
        };
        
        CanvasOverlay.prototype.setPoint = function(point) {
          this.point = point;
          this.draw();
        };
        CanvasOverlay.prototype.getPoint = function() {
          return this.point;
        };
        CanvasOverlay.prototype.onRemove = function() {
          this.div_.parentNode.removeChild(this.div_);
          this.div_ = null;
        };
        CanvasOverlay.prototype.hide = function() {
          if (this.div_) {
            this.div_.style.visibility = "hidden";
          }
        };

        CanvasOverlay.prototype.show = function() {
          if (this.div_) {
            this.div_.style.visibility = "visible";
          }
        };

        CanvasOverlay.prototype.toggle = function() {
          if (this.div_) {
            if (this.div_.style.visibility == "hidden") {
              this.show();
            } else {
              this.hide();
            }
          }
        };

        CanvasOverlay.prototype.toggleDOM = function() {
          if (this.getMap()) {
            this.setMap(null);
          } else {
            this.setMap(this.map_);
          }
        };
        return CanvasOverlay;
    }());
    
    return function(useroptions){
        var that = {};
        var options = useroptions || {};
        var defaults = {};
        defaults.mapStartZoom = 11;
        defaults.mapStartCenter = {"lat": 52.51037058766109, "lng": 13.333282470703125};
        defaults.northwest = {"lat":52.754364, "lng":12.882953};
        defaults.southeast = {"lat":52.29693, "lng":13.908883};
        defaults.mapStyles = {};
        defaults.mapTypeIds = [google.maps.MapTypeId.ROADMAP];
        defaults.heightCacheFactor = 3;
        defaults.widthCacheFactor = 5;
        defaults.getGMapOptions = function(){
            return {"googleBarOptions": {"client": "pub-8009811934212849",
                    "channel": "6817437931",
                    "adsafe": "low",
                    "language": "de"}};
        };
        defaults.blockSize = 0.5; // in km 500 * 500 meters per block
    
        that.env = {};
        for(var key in defaults){
            if(typeof(options[key]) !== "undefined"){
                that.env[key] = options[key];
            } else {
                that.env[key] = defaults[key];
            }
        }
        if(typeof(options.layerSettings) !== "undefined"){
            that.env.layerSettings = options.layerSettings;
        }
        that.env.southwest = {"lat":that.env.southeast.lat, "lng":that.env.northwest.lng};
        that.env.northeast = {"lat":that.env.northwest.lat, "lng":that.env.southeast.lng};

        that.env.latLngDiffs = {"lat": Math.abs(that.env.northwest.lat-that.env.southeast.lat) , "lng": Math.abs(that.env.northwest.lng-that.env.southeast.lng)};
        that.circleRadians = (Math.PI/180)*360;
        var customEvents = {};
        that.DegToRadFactor = Math.PI / 180;
        that.RadToDegFactor = 180 / Math.PI;
        that.layers = {};
        that.tabs = [];
        that.offsetActive = false;
        jQuery(window).resize(function(){that.resize();});
        jQuery(".mapnificent-activate-control").live("change", function(e){that.activateControlChanged.apply(that,[this]);});
        jQuery(".mapnificent-activate-tab").live("change", function(e){that.activateTabChanged.apply(that,[this]);});

        that.createLayer = function(){
            return {
                getTitle :          function(){return "";},
                activate :          function(){},
                deactivate :        function(){},
                getDrawingLevel :   function(){return 20;},
                redraw :            function(ctx){},
                setup :             function(dataobjs, container){}
            };
        };
    
        that.initMap = function(mapID) {
            that.mapID = mapID;
            that.env.ie = false;
            that.env.Gnorthwest = new google.maps.LatLng(that.env.northwest.lat, that.env.northwest.lng);
            that.env.Gsoutheast = new google.maps.LatLng(that.env.southeast.lat, that.env.southeast.lng);
            that.env.Gsouthwest = new google.maps.LatLng(that.env.southwest.lat, that.env.southwest.lng);
            that.env.Gnortheast = new google.maps.LatLng(that.env.northeast.lat, that.env.northeast.lng);
            that.env.widthInKm = that.getDistanceInKm(that.env.northwest, that.env.northeast);
            that.env.heightInKm = that.getDistanceInKm(that.env.northwest, that.env.southwest);
            that.env.blockCountX = Math.ceil(that.env.widthInKm / that.env.blockSize);
            that.env.blockCountY = Math.ceil(that.env.heightInKm / that.env.blockSize);
            jQuery("#"+that.mapID).height(jQuery(window).height());
            that.env.getGMapOptions();
            var lastStyle = google.maps.MapTypeId.ROADMAP;
            for(var style in that.env.mapStyles){
                that.env.mapTypeIds.push(style);
                lastStyle = style;
            }
            
            var mapOptions = {
              "zoom": that.env.mapStartZoom
              , "center": new google.maps.LatLng(that.env.mapStartCenter.lat, that.env.mapStartCenter.lng)
              , "mapTypeId": lastStyle
              , "mapTypeControlOptions": {
                  "mapTypeIds": that.env.mapTypeIds
              },
            };
            that.map = new google.maps.Map(document.getElementById(that.mapID), mapOptions);
            for(var style in that.env.mapStyles){
                var styledMapType = new google.maps.StyledMapType(that.env.mapStyles[style], {name: style});
                that.map.mapTypes.set(style, styledMapType);
            }
            // that.map.setCenter(new google.maps.LatLng(that.env.mapStartCenter.lat, that.env.mapStartCenter.lng), that.env.mapStartZoom);
            //that.map.enableScrollWheelZoom();
            // that.map.addControl(new GLargeMapControl());
            // that.map.addControl(new GMapTypeControl());
            if(that.env.getGMapOptions()["googleBarOptions"] !== "undefined"){
                // that.map.enableGoogleBar();            
            }
            that.mapSize = {"width": jQuery(that.map.getDiv()).width(), "height": jQuery(that.map.getDiv()).height()};
            that.heightCacheOffset = (that.mapSize.height*(that.env.heightCacheFactor - 1))/2;
            that.widthCacheOffset = (that.mapSize.width*(that.env.widthCacheFactor - 1))/2;
            that.geocoder = new google.maps.Geocoder();
            that.canvas_id = "mapnificent-canvas";
            while(document.getElementById(that.canvas_id) !== null){
                that.canvas_id += "0"; // Desperate move here
            }
            var onaddcallback = function(){
                that.canvas = document.getElementById(that.canvas_id);
                if(typeof(G_vmlCanvasManager) !== "undefined"){
                    that.env.ie = true;
                    alert("Your browser might or might not work. Rather use a better one.");
                    G_vmlCanvasManager.initElement(that.canvas);
                }
                if(typeof(that.canvas.getContext) === "undefined"){
                    /* Uh, oh, no canvas ahead!! Crash! */
                    mapnificent.showMessage("Your browser seems to suck, no canvas support! I can't work that way...");
                    return;
                }
                that.ctx = that.canvas.getContext("2d");
                that.checkCompositing();
                that.setScale();
                that.mapBounds = that.map.getBounds();
                that.mapBoundsXY = that.canvasoverlay.fromLatLngToDivPixel(that.mapBounds.getSouthWest());
                that.setup(MAPNIFICENT_LAYER, MAPNIFICENT_LAYERDATA);
            };
            that.canvasoverlay = new CanvasOverlay(that.env.Gsouthwest, that.canvas_id, onaddcallback, that.map);
            google.maps.event.addListener(that.map, "zoom_changed", function(oldLevel, newLevel){
                that.ctx.clearRect(0,0,that.canvas.width, that.canvas.height);
                window.setTimeout(function(){
                    that.setScale();
                    that.trigger("redraw");
                },500);
            });
            google.maps.event.addListener(that.map, "dragend", function(){
                if(that.moveMapPosition()){
                    that.trigger("redraw");
                }
            });
        };
    
        that.checkCompositing = function(){
            if(typeof(that.ctx.getImageData) === "undefined"){
                that.hasCompositing = false;
                return;
            }
            that.hasCompositing = true;
            that.ctx.save();
            that.ctx.clearRect(0,0,that.canvas.width, that.canvas.height);
            that.ctx.fillStyle = "rgba(255,255,255,1)";
            that.ctx.fillRect(0,0,3,3);
            that.ctx.globalCompositeOperation = "destination-in";
            that.ctx.fillRect(2,2,3,3);
            that.ctx.globalCompositeOperation = "source-out";
            that.ctx.fillStyle = "rgba(75,75,75,0.75)";
            that.ctx.fillRect(0,0,5,5);
            var pix = that.ctx.getImageData(1, 1, 1, 1).data;
            if(pix[3] === 0){ // Compositing fails, there is full transparency here
                /* This currently affects webkit browsers: safari, chromium, chrome */
    //            that.showMessage("Your browser fails some drawing tests. Your Mapnificent will not look optimal!");
                that.hasCompositing = false;
            }
            that.ctx.restore();
            that.ctx.clearRect(0,0,that.canvas.width, that.canvas.height);
        };
    
        that.setScale = function(){
            that.env.southeastxy = that.canvasoverlay.fromLatLngToDivPixel(that.env.Gsoutheast);
            that.env.northwestxy = that.canvasoverlay.fromLatLngToDivPixel(that.env.Gnorthwest);
            that.env.southwestxy = that.canvasoverlay.fromLatLngToDivPixel(that.env.Gsouthwest);
            that.env.northeastxy = that.canvasoverlay.fromLatLngToDivPixel(that.env.Gnortheast);
            that.canvasoverlayxy = that.canvasoverlay.fromLatLngToDivPixel(that.canvasoverlay.getPoint());
            that.env.map_width = Math.abs(that.env.southwestxy.x - that.env.northeastxy.x);
            that.env.map_height = Math.abs(that.env.southwestxy.y - that.env.northeastxy.y);
            that.env.pixelPerKm = that.env.map_width/that.env.widthInKm;
            that.mapBounds = that.map.getBounds();
            that.mapBoundsXY = that.canvasoverlay.fromLatLngToDivPixel(that.mapBounds.getSouthWest());
        
            var needPositionSet = false;
            var oldOffsetActive = that.offsetActive;
            if (that.env.map_width <= that.mapSize.width*that.env.widthCacheFactor) {
              that.canvas.width = that.env.map_width;
              that.offsetActive = false;
            } else {
                that.canvas.width = that.mapSize.width*that.env.widthCacheFactor;
                needPositionSet = true;
            }
            if (that.env.map_height <= that.mapSize.height*that.env.heightCacheFactor) {
              that.canvas.height = that.env.map_height;
              that.offsetActive = false;
            } else {
              that.canvas.height = that.mapSize.height*that.env.heightCacheFactor;
              needPositionSet = true;
            }
            if(needPositionSet){
                that.offsetActive = true;
                that.setMapPosition();
            } 
            if(oldOffsetActive && !that.offsetActive){
                that.canvasoverlay.setPoint(that.env.Gsouthwest);
                that.canvasoverlayxy = that.canvasoverlay.fromLatLngToDivPixel(that.canvasoverlay.getPoint());
            }
            that.ctx.clearRect(0,0,that.canvas.width, that.canvas.height);
        };
    
        that.moveMapPosition = function(){
            if(!that.offsetActive){return false;}
            that.mapBounds = that.map.getBounds();
            that.mapBoundsXY = that.canvasoverlay.fromLatLngToDivPixel(that.mapBounds.getSouthWest());
            var boundnexy = that.canvasoverlay.fromLatLngToDivPixel(that.mapBounds.getNorthEast());
            var need = false;
            if((that.mapBoundsXY.x-that.widthCacheOffset*(1/3)) < that.canvasoverlayxy.x){
                need = true;
            } else if((boundnexy.x+that.widthCacheOffset*(1/3)) > that.canvasoverlayxy.x+that.canvas.width){
                need = true;
            } else if((that.mapBoundsXY.y+that.heightCacheOffset*(1/3)) > that.canvasoverlayxy.y){
                need = true;
            } else if((boundnexy.y - that.heightCacheOffset*(1/3)) < that.canvasoverlayxy.y - that.canvas.height){
                need = true;
            }
            if(need){
                that.setMapPosition();
                return true;
            }
            return false;
        };
    
        /* Repositions the map around the current view port */
        that.setMapPosition = function(){
            if(!that.offsetActive){return;}
            var p = that.canvasoverlay.getPoint();
            var pxnpm = new google.maps.Point(that.mapBoundsXY.x, that.mapBoundsXY.y+that.heightCacheOffset);
            var geopxnpm = that.canvasoverlay.fromDivPixelToLatLng(pxnpm);
            var nlat = geopxnpm.lat();
            nlat = Math.min(nlat, that.env.northwest.lat);
            nlat = Math.max(nlat, that.env.southeast.lat);
            var p = new google.maps.LatLng(nlat, p.lng());
            that.canvasoverlay.setPoint(p);        
            var pxnpm = new google.maps.Point(that.mapBoundsXY.x-that.widthCacheOffset, that.mapBoundsXY.y);
            var geopxnpm = that.canvasoverlay.fromDivPixelToLatLng(pxnpm);
            var nlng = geopxnpm.lng();
            nlng = Math.max(nlng, that.env.southwest.lng);
            nlng = Math.min(nlng, that.env.southeast.lng);
            var mapbottomleftgeo = new google.maps.LatLng(p.lat(), nlng);
            that.canvasoverlay.setPoint(mapbottomleftgeo);
            that.canvasoverlayxy = that.canvasoverlay.fromLatLngToDivPixel(that.canvasoverlay.getPoint());
        };
    
        that.trigger = function(ev, paramObj) {
            if (typeof(customEvents[ev]) !== "undefined"){
                for(var i=0;i<customEvents[ev].length;i++){
//                    try {
                        customEvents[ev][i](paramObj);
//                    } catch(e){
//                        console.log(e);
//                    }
                }
            }
        };
        that.bind = function(ev,fn) {
            if (typeof(customEvents[ev]) === "undefined"){
                customEvents[ev] = [];
            }
            customEvents[ev].push(fn);
        };
        
        that.unbind = function(ev, fn) {
            if (typeof(customEvents[ev]) !== "undefined"){
                var nCustomEvents = [];
                for(var i=0;i<customEvents[ev].length;i++){
                    if(customEvents[ev][i] != fn){
                        nCustomEvents.push(customEvents[ev][i]);
                    }
                }
                customEvents[ev] = nCustomEvents;
            }
        };
        
        that.resize = function(){
            jQuery("#"+that.mapID).height(jQuery(window).height());
            if(that.map){
                google.maps.event.trigger(that.map, "resize");
                that.mapSize = {"width": jQuery(that.map.getDiv()).width(), "height": jQuery(that.map.getDiv()).height()};
                that.heightCacheOffset = (that.mapSize.height*(that.env.heightCacheFactor - 1))/2;
                that.widthCacheOffset = (that.mapSize.width*(that.env.widthCacheFactor - 1))/2;
                that.moveMapPosition();
            }
        };
        that.refreshControls = function(idname) {
            return jQuery("#controls");
            
            var chk = ' checked="checked"';
            if (!that.isTabActive(idname)){chk = "";}
            jQuery('#controls-'+that.layers[idname].tabid).append(jQuery('<div id="control-'+idname+'" class="control">'+
            '<h3 class="layer-title"><input class="mapnificent-activate-control" type="checkbox" id="control-'+idname+'-checkbox"'+chk+'/>'+
            '<label for="control-'+idname+'-checkbox">'+that.layers[idname].layerObject.getTitle()+'</label></h3>'+
            '<div id="control-'+idname+'-container"></div></div>'));
            return jQuery("#control-"+idname+"-container");
        };
    
        that.activateControlChanged = function(control) {
            var idname = jQuery(control).attr("id").split("-")[1];
            if(that.isLayerControlActive(idname)){
                jQuery('#control-'+idname).addClass("activeLayer");
                if(!that.isTabActive(idname)){
                    jQuery("#activatetab-"+that.layers[idname].tabid).attr("checked", "checked");
                }
                that.layers[idname].layerObject.activate();
            } else {
                jQuery('#control-'+idname).removeClass("activeLayer");
                that.layers[idname].layerObject.deactivate();
            }
            that.trigger("redraw");
        };
    
        that.activateTabChanged = function(tab) {
            var tabid = jQuery(tab).attr("id").split("-")[1];
            for(var idname in that.layers){
                if (that.layers[idname].tabid == tabid){
                    if(that.isTabActive(idname)){
                        jQuery('#control-'+idname+'-checkbox').attr("checked", "checked");
                        that.layers[idname].layerObject.activate();
                    } else {
                        jQuery('#control-'+idname+'-checkbox').removeAttr("checked");
                        that.layers[idname].layerObject.deactivate();
                    }
                }
            }
            that.trigger("redraw");
        };
    
        that.isTabActive = function(idname) {
            return true;
            return jQuery("#activatetab-"+that.layers[idname].tabid).is(":checked");
        };
    
        that.isLayerControlActive = function(idname) {
            return true;
            return jQuery('#control-'+idname+'-checkbox').is(":checked");
        };
    
        that.isLayerActive = function(idname) {
            return (that.isTabActive(idname) && that.isLayerControlActive(idname));
        };
    
        that.getDrawingContext = function(){
            return that.ctx;
        };
    
        that.inRange = function(pos) {
            if (pos.lat>that.env.northwest.lat || pos.lat<that.env.southeast.lat || 
                pos.lng<that.env.northwest.lng || pos.lng>that.env.southeast.lng) {return false;}
            return true;
        };
        that.getBlockIndizesForPosition = function(pos) {
            /* This is somewhat less correct, but should be faster than alternative */
            if(!that.inRange(pos)){return [0,0];}
            var indexX = Math.floor((that.env.widthInKm / that.env.latLngDiffs.lng * (pos.lng - that.env.northwest.lng)) / that.env.blockSize);
            var indexY = Math.floor((that.env.heightInKm / that.env.latLngDiffs.lat * (that.env.northwest.lat - pos.lat)) / that.env.blockSize);
            return [indexX, indexY];
        };
        that.getAlternativeBlockIndizesForPosition = function(pos) {
            if(!that.inRange(pos)){return [0,0];}
            var indexX = Math.floor(that.getDistanceInKm(pos,{"lat": pos.lat, "lng": that.env.northwest.lng}) / that.env.blockSize);
            var indexY = Math.floor(that.getDistanceInKm(pos,{"lat": that.env.northwest.lat, "lng":pos.lng}) / that.env.blockSize);
            return [indexX, indexY];
        };
        that.getCanvasXY = function(pos) {
            var xy = that.canvasoverlay.fromLatLngToDivPixel(new google.maps.LatLng(pos.lat, pos.lng));
            var x = xy.x - (that.canvasoverlayxy.x);
            var y = xy.y - (that.canvasoverlayxy.y-that.canvas.height);
            return {"x" : x, "y": y};
        };
        that.redraw = function(){
            that.ctx.globalCompositeOperation = "source-over";
            that.ctx.globalAlpha = 1;
            that.ctx.clearRect(0,0,that.canvas.width, that.canvas.height);
            var layers = [];
            for(var idname in that.layers){
                layers.push(that.layers[idname]);
            }
            layers.sort(function(a,b){return a.layerObject.getDrawingLevel() - b.layerObject.getDrawingLevel();});
            var actuallyDrawn = 0;
            for(var i=0;i<layers.length;i++){
                if(that.isLayerActive(layers[i].idname)){
                    layers[i].layerObject.redraw(that.ctx);
                    actuallyDrawn++;
                }
            }
            that.canvasoverlay.draw();
        };
            
        that.getDistanceInKm = function(pos1, pos2) {
            var R = 6371; // in kilometers
            return Math.acos(Math.sin(pos1.lat*that.DegToRadFactor)*Math.sin(pos2.lat*that.DegToRadFactor) + 
                              Math.cos(pos1.lat*that.DegToRadFactor)*Math.cos(pos2.lat*that.DegToRadFactor) *
                              Math.cos((pos2.lng-pos1.lng)*that.DegToRadFactor)) * R;
        };
    
        that.setup = function(layerlogic, layerdata) {
            for(var idname in layerlogic){
                that.setupLayer(idname, layerlogic[idname], layerdata[idname]);
            }
            that.resize();
            that.bind("redraw", that.redraw);
            var clicktimeout = null, lastclick = null;
            google.maps.event.addListener(that.map, "click", function(mev){
                if(lastclick != null && lastclick+250 >= new Date().getTime() && clicktimeout !== null){
                    window.clearTimeout(clicktimeout);
                    return;
                }
                clicktimeout = window.setTimeout(function(){
                    that.mapClick(mev);
                    clicktimeout = null;
                }, 250);
                lastclick = new Date().getTime();
            });
        };
    
        that.setupLayer = function(idname, layer, data) {
            that.layers[idname] = {};
            if(typeof(data) === "undefined"){
                that.layers[idname].data = [];
            } else {
                that.layers[idname].data = data;
            }
            that.layers[idname].idname = idname;
            that.layers[idname].layerObject = layer;
            var tabid = that.layers[idname].layerObject.tabid;
            if(typeof(tabid) === "undefined"){
                tabid = "other";
            }
            that.layers[idname].tabid = tabid;
            var container = that.refreshControls(idname);
            that.layers[idname].layerObject.setup(that.layers[idname].data, container, that.env.layerSettings[idname]);
            if(!that.isLayerActive(idname)){
                that.layers[idname].layerObject.deactivate();
            } else {
                that.layers[idname].layerObject.activate();
                jQuery('#control-'+idname).addClass("activeLayer");
            }
        };
    
        that.mapClick = function(mev) {
           if (mev.latLng) {
               that.trigger("mapClick",{"lat": mev.latLng.lat(), "lng": mev.latLng.lng()});
           }
       };
    
        that.createMarker = function(pos, options) {
            options = options || {};
            options.position = new google.maps.LatLng(pos.lat, pos.lng);
            options.map = that.map;
            options.title = "";
            var marker = new google.maps.Marker(options);
            return marker;
        };
        
        that.addEventOnMarker = function(ev, marker, func) {
            google.maps.event.addListener(marker, ev, func);
        };
        
        that.removeMarker = function(marker){
            marker.setMap(null);
        };
    
        that.getAddressForPoint = function(latlng, userCallback) {
            var callback = function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    userCallback(results[0].formatted_address);
                }
            };
            that.geocoder.geocode({'latLng': new google.maps.LatLng(latlng.lat, latlng.lng)}, callback);
        };
    
        that.calculateLayer = function(idname) {
            jQuery("#loading").show();
            window.setTimeout(function(){
                that.layers[idname].layerObject.calculate(that.currentPosition);
                that.trigger("redraw");
                jQuery("#loading").fadeOut(200);
            },0);
            if(that.currentPosition != null){
                that.layers[idname].layerObject.calculate(that.currentPosition);
            }
        };
    
        that.closestObjects = function(pos, key, lookup) {
            var nearestObjects = that.getNearestObjectsForPosition(pos, key);
            var result = [];
            for (var i=0;i<nearestObjects.length;i++){
                result.push([nearestObjects[i], that.getDistanceInKm(pos, lookup[nearestObjects[i]].pos)]);
            }
            return result;
        };
        that.getBlockIndizesForPositionByRadius = function(pos, rad) {
            var indizes = that.getBlockIndizesForPosition(pos);
            if(rad == 0){
                return [indizes];
            }
            var results = [];
            var maxDistanceToEdge = Math.max(Math.abs(that.env.blockCountX-indizes[0]), Math.abs(indizes[1]-that.env.blockCountY));
            var nearestObjects = [];
            for(var i=rad;i<maxDistanceToEdge;i++){
                for (var j=-i;j<(i+1);j++){
                    var nx = indizes[0]-i;
                    var ny = indizes[1]+j;
                    if(nx>=0 && ny < that.env.blockCountY && ny > 0){
                        results.push([nx,ny]);
                    }
                    var nx = indizes[0]+i;
                    var ny = indizes[1]+j;
                    if(nx < that.env.blockCountX && ny < that.env.blockCountY && ny > 0){
                        results.push([nx,ny]);
                    }
                    if(j>-i && j<i){
                        var nx = indizes[0]+j;
                        var ny = indizes[1]-i;
                        if(nx < that.env.blockCountX && nx > 0 && ny >= 0){
                            results.push([nx,ny]);
                        }
                        var nx = indizes[0]+j;
                        var ny = indizes[1]-i;
                        if(nx < that.env.blockCountX && nx > 0 && ny >= 0){
                            results.push([nx,ny]);
                        }
                    }
                }
                break; // algorithm change: break here, wait for next round. I miss iterators.
            }
            return results;
        };
    
        that.addTab = function(idname, title, active) {
            that.tabs.push(idname);
            jQuery("#controls").tabs("add", "#controls-"+idname, title);
            var li = jQuery("#controls-tabnavigation li:last");
            li.attr("id",'activatetabitem-'+idname);
            if(typeof(active) === "undefined" || active){
                var chk = ' checked="checked"';
            } else { var chk = ''; }
            li.prepend('<input type="checkbox" class="mapnificent-activate-tab" id="activatetab-'+idname+'"'+chk+'/>');
        };
    
        that.addLiveLoader = function(){
            var script="", jsonp="", idname="", func="";
            var already = jQuery.cookie("mapnificentCustom");
            var enable = false;
            if(already != null){
                var alreadyparts = already.split("|");
                script = decodeURI(alreadyparts[0]);
                jsonp = decodeURI(alreadyparts[1]);
                enable = true;
            }
            that.addTab("custom", "Load your own!", enable);
            jQuery("#controls-custom").append(''+
                '<h2>Load your own Layer</h2>'+
                '<p><a href="docs/">Find the necessary information in the documentation of Mapnificent</a></p>'+
                '<span style="padding:2px 5px;">URL of Script: <input type="text" value="'+script+'" name="liveloader-script" id="liveloader-script"/></span>'+
                '<span style="padding:2px 5px;">URL of JSONP (optional): <input type="text" value="'+jsonp+'" name="liveloader-json" id="liveloader-jsonp"/></span><br/>'+
                '<input type="button" value="Add Layer" id="liveloader-addlayer"/>'+
            '');
            if (already != null){
                that.showMessage("Added your own layer: "+ escape(idname));
                that.addCustomLayer();
            }
            jQuery("#liveloader-addlayer").click(function(e){
                that.addCustomLayer(e);
            });
        };
    
        that.addCustomLayer = function(e) {
            if (e) {e.preventDefault();}
            var script = jQuery("#liveloader-script").val();
            if(script == ""){
                jQuery.cookie('mapnificentCustom', null, { path: '/', expires: 14 });
                that.showMessage("You gave me no script!");
                return;
            }
            var jsonp = jQuery("#liveloader-jsonp").val();
            var cookieValue = encodeURI(script) + "|" + encodeURI(jsonp);
            jQuery.cookie('mapnificentCustom', cookieValue, { path: '/', expires: 14 });
            var loadingDone = function(){
                for(var idname in MAPNIFICENT_LAYER){
                    if (typeof(that.layers[idname]) === "undefined"){
                        MAPNIFICENT_LAYER[idname].tabid="custom";
                        that.setupLayer(idname, MAPNIFICENT_LAYER[idname], MAPNIFICENT_LAYERDATA[idname] || []);
                    }
                }
                that.trigger("redraw");
            };
            if(jsonp == ""){
                jQuery.getScript(script, loadingDone);
            } else {
                jQuery.getScript(jsonp, function() {
                  jQuery.getScript(script, loadingDone);
                });
            }
        };
    
        that.showMessage = function(message) {
            jQuery("#message").html(message);
            jQuery("#message").fadeIn(200);
            window.setTimeout(function(){
                if(jQuery("#message").css("display") !== "none"){
                    jQuery("#message").fadeOut(400);
                }
            },5000);
        };
        
        that.hideMessage = function() {
            jQuery("#message").fadeOut(200);
        };
    
        return that;
    };
}());