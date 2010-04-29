/* 
    (c) Copyright 2010 Stefan Wehrmeyer.
    Released under Creative Commons By-NC-SA: http://creativecommons.org/licenses/by-nc-sa/3.0
    By: Stefan Wehrmeyer http://stefanwehrmeyer.com
    If you want to use this software commercially, contact the author.
    
    This may be published as really Free Software in the future.
*/

function Mapnificent(useroptions){
    var options = useroptions || {};
    var defaults = {};
    defaults.mapStartZoom = 10;
    defaults.setStartAtPosition = {"lat": 52.51622086393074, "lng": 13.37911605834961};
    defaults.mapStartCenter = {"lat": 52.51037058766109, "lng": 13.333282470703125};
    defaults.northwest = {"lat":52.754364, "lng":12.882953};
    defaults.southeast = {"lat":52.29693, "lng":13.908883};
    defaults.heightCacheFactor = 5;
    defaults.widthCacheFactor = 3;
    defaults.getGMapOptions = function(){
        return {"googleBarOptions": {"client": "pub-8009811934212849",
                "channel": "6817437931",
                "adsafe": "low",
                "language": "de"}};
    };
    defaults.blockSize = 0.5; // in km 500 * 500 meters per block
    
    this.env = {};
    for(var key in defaults){
        if(typeof(options[key]) !== "undefined"){
            this.env[key] = options[key];
        } else {
            this.env[key] = defaults[key];
        }
    }
    this.env.southwest = {"lat":this.env.southeast.lat, "lng":this.env.northwest.lng};
    this.env.northeast = {"lat":this.env.northwest.lat, "lng":this.env.southeast.lng};

    this.env.latLngDiffs = {"lat": Math.abs(this.env.northwest.lat-this.env.southeast.lat) , "lng": Math.abs(this.env.northwest.lng-this.env.southeast.lng)};
    this.circleRadians = (Math.PI/180)*360;
    this.customEvents = {};
    this.DegToRadFactor = Math.PI / 180;
    this.RadToDegFactor = 180 / Math.PI;
    this.formattedAddress = "You are here";
    this.currentPosition = null;
    this.userMarker = null;
    this.layers = {};
    this.tabs = [];
    this.offsetActive = false;
    var obj = this;
    jQuery(window).resize(function(){obj.resize.apply(obj,[]);});
    jQuery(".mapnificent-activate-control").live("change", function(e){obj.activateControlChanged.apply(obj,[this]);});
    jQuery(".mapnificent-activate-tab").live("change", function(e){obj.activateTabChanged.apply(obj,[this]);});
}

Mapnificent.prototype = {
    createLayer : function(){
        return {
            getTitle :           function(){return "";},
            appendControlHtmlTo :  function(container){},
            activate :             function(){},
            deactivate :           function(){},
            getDrawingLevel :      function(){return 20;},
            redraw :               function(ctx){},
            setup :                function(dataobjs){},
            calculate :            function(startPos){}
        };
    },
    initMap : function(mapID) {
        this.mapID = mapID;
        this.env.ie = false;
        this.env.Gnorthwest = new google.maps.LatLng(this.env.northwest.lat, this.env.northwest.lng);
        this.env.Gsoutheast = new google.maps.LatLng(this.env.southeast.lat, this.env.southeast.lng);
        this.env.Gsouthwest = new google.maps.LatLng(this.env.southwest.lat, this.env.southwest.lng);
        this.env.Gnortheast = new google.maps.LatLng(this.env.northeast.lat, this.env.northeast.lng);
        this.env.widthInKm = this.getDistanceInKm(this.env.northwest, this.env.northeast);
        this.env.heightInKm = this.getDistanceInKm(this.env.northwest, this.env.southwest);
        this.env.blockCountX = Math.ceil(this.env.widthInKm / this.env.blockSize);
        this.env.blockCountY = Math.ceil(this.env.heightInKm / this.env.blockSize);
        jQuery("#"+this.mapID).height(jQuery(window).height()-jQuery("#controls").height());
        this.map = new google.maps.Map2(document.getElementById(this.mapID), this.env.getGMapOptions());
        this.map.setCenter(new google.maps.LatLng(this.env.mapStartCenter.lat, this.env.mapStartCenter.lng), this.env.mapStartZoom);
        //this.map.enableScrollWheelZoom();
        this.map.addControl(new GLargeMapControl());
        this.map.addControl(new GMapTypeControl());
        if(this.env.getGMapOptions()["googleBarOptions"] !== "undefined"){
            this.map.enableGoogleBar();            
        }
        this.mapSize = this.map.getSize();
        this.heightCacheOffset = (this.mapSize.height*(this.env.heightCacheFactor - 1))/2;
        this.widthCacheOffset = (this.mapSize.width*(this.env.widthCacheFactor - 1))/2;
        this.mapBounds = this.map.getBounds();
        this.mapBoundsXY = this.map.fromLatLngToDivPixel(this.mapBounds.getSouthWest());
        this.geocoder = new google.maps.ClientGeocoder();
        this.canvas_id = "mapnificent-canvas";
        while(document.getElementById(this.canvas_id) !== null){
            this.canvas_id += "0"; // Desperate move here
        }
        var cnvs = document.createElement("canvas");
        cnvs.id = this.canvas_id;
        cnvs.width=20;
        cnvs.height=20;
        this.elabel = new ELabel(this.env.Gsouthwest, cnvs);
        this.map.addOverlay(this.elabel);
        this.canvas = document.getElementById(this.canvas_id);
        if(typeof(G_vmlCanvasManager) !== "undefined"){
            this.env.ie = true;
            alert("Your browser might or might not work. Rather use a better one.");
            G_vmlCanvasManager.initElement(this.canvas);
        }
        if(typeof(this.canvas.getContext) === "undefined"){
            /* Uh, oh, no canvas ahead!! Crash! */
          this.ctx = null;
          return;
        }
        this.ctx = this.canvas.getContext("2d");
        this.checkCompositing();
        var obj = this;
        GEvent.addListener(this.map, "zoomend", function(oldLevel, newLevel){
            obj.setScale.apply(obj,[]);
            obj.trigger.apply(obj,["redraw"]);
        });
        GEvent.addListener(this.map, "moveend", function(){
            if(obj.moveMapPosition.apply(obj,[])){
                obj.trigger.apply(obj,["redraw"]);
            }
        });
        this.setScale();
    },
    
    checkCompositing : function(){
        if(typeof(this.ctx.getImageData) === "undefined"){
            this.hasCompositing = false;
            return;
        }
        this.hasCompositing = true;
        this.ctx.save();
        this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = "rgba(255,255,255,1)";
        this.ctx.fillRect(0,0,3,3);
        this.ctx.globalCompositeOperation = "destination-in";
        this.ctx.fillRect(2,2,3,3);
        this.ctx.globalCompositeOperation = "source-out";
        this.ctx.fillStyle = "rgba(75,75,75,0.75)";
        this.ctx.fillRect(0,0,5,5);
        var pix = this.ctx.getImageData(1, 1, 1, 1).data;
        if(pix[3] === 0){ // Compositing fails, there is full transparency here
            /* This currently affects webkit browsers: safari, chromium, chrome */
//            this.showMessage("Your browser fails some drawing tests. Your Mapnificent will not look optimal!");
            this.hasCompositing = false;
        }
        this.ctx.restore();
        this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    },
    
    setScale : function(){
        this.env.southeastxy = this.map.fromLatLngToDivPixel(this.env.Gsoutheast);
        this.env.northwestxy = this.map.fromLatLngToDivPixel(this.env.Gnorthwest);
        this.env.southwestxy = this.map.fromLatLngToDivPixel(this.env.Gsouthwest);
        this.env.northeastxy = this.map.fromLatLngToDivPixel(this.env.Gnortheast);
        this.elabelxy = this.map.fromLatLngToDivPixel(this.elabel.getPoint());
        this.env.map_width = Math.abs(this.env.southwestxy.x - this.env.northeastxy.x);
        this.env.map_height = Math.abs(this.env.southwestxy.y - this.env.northeastxy.y);
        this.env.pixelPerKm = this.env.map_width/this.env.widthInKm;
        this.mapBounds = this.map.getBounds();
        this.mapBoundsXY = this.map.fromLatLngToDivPixel(this.mapBounds.getSouthWest());
        
        var needPositionSet = false;
        var oldOffsetActive = this.offsetActive;
        if (this.env.map_width <= this.mapSize.width*this.env.widthCacheFactor) {
          this.canvas.width = this.env.map_width;
          this.offsetActive = false;
        } else {
            this.canvas.width = this.mapSize.width*this.env.widthCacheFactor;
            needPositionSet = true;
        }
        if (this.env.map_height <= this.mapSize.height*this.env.heightCacheFactor) {
          this.canvas.height = this.env.map_height;
          this.offsetActive = false;
        } else {
          this.canvas.height = this.mapSize.height*this.env.heightCacheFactor;
          needPositionSet = true;
        }
        if(needPositionSet){
            this.offsetActive = true;
            this.setMapPosition();
        } 
        if(oldOffsetActive && !this.offsetActive){
            this.elabel.setPoint(this.env.Gsouthwest);
            this.elabelxy = this.map.fromLatLngToDivPixel(this.elabel.getPoint());
        }
        this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
        this.elabel.redraw(true);
    },
    
    moveMapPosition : function(){
        if(!this.offsetActive){return false;}
        this.mapBounds = this.map.getBounds();
        this.mapBoundsXY = this.map.fromLatLngToDivPixel(this.mapBounds.getSouthWest());
        var boundnexy = this.map.fromLatLngToDivPixel(this.mapBounds.getNorthEast());
        var need = false;
        if((this.mapBoundsXY.x-this.widthCacheOffset*(1/3)) < this.elabelxy.x){
            need = true;
        } else if((boundnexy.x+this.widthCacheOffset*(1/3)) > this.elabelxy.x+this.canvas.width){
            need = true;
        } else if((this.mapBoundsXY.y+this.heightCacheOffset*(1/3)) > this.elabelxy.y){
            need = true;
        } else if((boundnexy.y - this.heightCacheOffset*(1/3)) < this.elabelxy.y - this.canvas.height){
            need = true;
        }
        if(need){
            this.setMapPosition();
            return true;
        }
        return false;
    },
    
    /* Repositions the map around the current view port */
    setMapPosition : function(){
        if(!this.offsetActive){return;}
        var p = this.elabel.getPoint();
        var pxnpm = new google.maps.Point(this.mapBoundsXY.x, this.mapBoundsXY.y+this.heightCacheOffset);
        var geopxnpm = this.map.fromDivPixelToLatLng(pxnpm);
        var nlat = geopxnpm.lat();
        nlat = Math.min(nlat, this.env.northwest.lat);
        nlat = Math.max(nlat, this.env.southeast.lat);
        var p = new google.maps.LatLng(nlat, p.lng());
        this.elabel.setPoint(p);        
        var pxnpm = new google.maps.Point(this.mapBoundsXY.x-this.widthCacheOffset, this.mapBoundsXY.y);
        var geopxnpm = this.map.fromDivPixelToLatLng(pxnpm);
        var nlng = geopxnpm.lng();
        nlng = Math.max(nlng, this.env.southwest.lng);
        nlng = Math.min(nlng, this.env.southeast.lng);
        var mapbottomleftgeo = new google.maps.LatLng(p.lat(), nlng);
        this.elabel.setPoint(mapbottomleftgeo);
        this.elabelxy = this.map.fromLatLngToDivPixel(this.elabel.getPoint());
    },
    
    trigger : function(ev, ob){
        if (typeof(this.customEvents[ev]) !== "undefined"){
            var obj = ob || this;
            for(var i=0;i<this.customEvents[ev].length;i++){
                try {
                    this.customEvents[ev][i].apply(obj,[]);
                } catch(e){
                    //console.log(e);
                }
            }
        }
    },
    bind : function(ev,fn){
        if (typeof(this.customEvents[ev]) === "undefined"){
            this.customEvents[ev] = [];
        }
        this.customEvents[ev].push(fn);
    },
    resize : function(){
        jQuery("#"+this.mapID).height(jQuery(window).height()-(jQuery("#controls").outerHeight()));
        if(this.map){
            this.map.checkResize();
            this.mapSize = this.map.getSize();
            this.heightCacheOffset = (this.mapSize.height*(this.env.heightCacheFactor - 1))/2;
            this.widthCacheOffset = (this.mapSize.width*(this.env.widthCacheFactor - 1))/2;
            this.moveMapPosition();
        }
    },
    refreshControls : function(idname){
        var chk = ' checked="checked"';
        if (!this.isTabActive(idname)){chk = "";}
        jQuery('#controls-'+this.layers[idname].tabid).append(jQuery('<div id="control-'+idname+'" class="control">'+
        '<h3 class="layer-title"><input class="mapnificent-activate-control" type="checkbox" id="control-'+idname+'-checkbox"'+chk+'/>'+
        '<label for="control-'+idname+'-checkbox">'+this.layers[idname].layerObject.getTitle()+'</label></h3>'+
        '<div id="control-'+idname+'-container"></div></div>'));
        this.layers[idname].layerObject.appendControlHtmlTo(jQuery("#control-"+idname+"-container"));
        if(!this.isLayerActive(idname)){
            this.layers[idname].layerObject.deactivate();
        } else {
            jQuery('#control-'+idname).addClass("activeLayer");
        }
    },
    
    activateControlChanged : function(control){
        var idname = jQuery(control).attr("id").split("-")[1];
        if(this.isLayerControlActive(idname)){
            jQuery('#control-'+idname).addClass("activeLayer");
            if(!this.isTabActive(idname)){
                jQuery("#activatetab-"+this.layers[idname].tabid).attr("checked", "checked");
            }
            this.layers[idname].layerObject.activate();
        } else {
            jQuery('#control-'+idname).removeClass("activeLayer");
            this.layers[idname].layerObject.deactivate();
        }
        this.trigger("redraw");
    },
    
    activateTabChanged : function(tab){
        var tabid = jQuery(tab).attr("id").split("-")[1];
        for(var idname in this.layers){
            if (this.layers[idname].tabid == tabid){
                if(this.isTabActive(idname)){
                    jQuery('#control-'+idname+'-checkbox').attr("checked", "checked");
                    this.layers[idname].layerObject.activate();
                } else {
                    jQuery('#control-'+idname+'-checkbox').removeAttr("checked");
                    this.layers[idname].layerObject.deactivate();
                }
            }
        }
        this.trigger("redraw");
    },
    
    isTabActive : function(idname){
        return jQuery("#activatetab-"+this.layers[idname].tabid).is(":checked");
    },
    
    isLayerControlActive : function(idname){
        return jQuery('#control-'+idname+'-checkbox').is(":checked");
    },
    
    isLayerActive : function(idname){
        return (this.isTabActive(idname) && this.isLayerControlActive(idname));
    },
    
    getDrawingContext : function(){
        return this.ctx;
    },
    
    inRange : function(pos){
        if (pos.lat>this.env.northwest.lat || pos.lat<this.env.southeast.lat || 
            pos.lng<this.env.northwest.lng || pos.lng>this.env.southeast.lng) {return false;}
        return true;
    },
    getBlockIndizesForPosition : function(pos){
        /* This is somewhat less correct, but should be faster than alternative */
        if(!this.inRange(pos)){return [0,0];}
        var indexX = Math.floor((this.env.widthInKm / this.env.latLngDiffs.lng * (pos.lng - this.env.northwest.lng)) / this.env.blockSize);
        var indexY = Math.floor((this.env.heightInKm / this.env.latLngDiffs.lat * (this.env.northwest.lat - pos.lat)) / this.env.blockSize);
        return [indexX, indexY];
    },
    getAlternativeBlockIndizesForPosition : function(pos){
        if(!this.inRange(pos)){return [0,0];}
        var indexX = Math.floor(this.getDistanceInKm(pos,{"lat": pos.lat, "lng": this.env.northwest.lng}) / this.env.blockSize);
        var indexY = Math.floor(this.getDistanceInKm(pos,{"lat": this.env.northwest.lat, "lng":pos.lng}) / this.env.blockSize);
        return [indexX, indexY];
    },
    getCanvasXY : function(pos){
        var xy = this.map.fromLatLngToDivPixel(new google.maps.LatLng(pos.lat, pos.lng));
        var x = xy.x - (this.elabelxy.x);
        var y = xy.y - (this.elabelxy.y-this.canvas.height);
        return {"x" : x, "y": y};
    },
    redraw : function(){
        this.hasCompositing = false; // let's do the same show for every supported browser
        this.ctx.globalCompositeOperation = "source-over";
        this.ctx.globalAlpha = 1;
        this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
        var layers = [];
        for(var idname in this.layers){
            layers.push(this.layers[idname]);
        }
        layers.sort(function(a,b){return a.layerObject.getDrawingLevel() - b.layerObject.getDrawingLevel();});
        var actuallyDrawn = 0;
        for(var i=0;i<layers.length;i++){
            if(this.isLayerActive(layers[i].idname)){
                layers[i].layerObject.redraw(this.ctx);
                actuallyDrawn++;
            }
        }
        if(!this.hasCompositing){
            /* overlays everything with alpha */
            this.ctx.save();
            this.ctx.globalAlpha = 0.5;
            this.ctx.globalCompositeOperation = "destination-out";
            this.ctx.fillStyle = "rgba(255,255,255,1)";
            this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
            this.ctx.restore();
        }
    },
    
    getCurrentPosition : function(){
        return this.currentPosition;
    },
        
    getDistanceInKm : function(pos1, pos2){
        var R = 6371; // in kilometers
        return Math.acos(Math.sin(pos1.lat*this.DegToRadFactor)*Math.sin(pos2.lat*this.DegToRadFactor) + 
                          Math.cos(pos1.lat*this.DegToRadFactor)*Math.cos(pos2.lat*this.DegToRadFactor) *
                          Math.cos((pos2.lng-pos1.lng)*this.DegToRadFactor)) * R;
    },
    
    setup : function(layerlogic, layerdata){
        for(var idname in layerlogic){
            this.setupLayer(idname, layerlogic[idname], layerdata[idname]);
        }
        this.resize();
        this.bind("redraw", this.redraw);
        var clicktimeout = null, obj=this, lastclick = null;
        this.setPositionListener = GEvent.bind(this.map, "click", this, function(overlay, latlng){
            if(lastclick != null && lastclick+250 >= new Date().getTime() && clicktimeout !== null){
                window.clearTimeout(clicktimeout);
                return;
            }
            clicktimeout = window.setTimeout(function(){
                obj.setNewPosition.apply(obj,[overlay, latlng]);
                clicktimeout = null;
            }, 250);
            lastclick = new Date().getTime();
        });
        this.bind("setPosition", this.newPositionSet);
        if(this.env.setStartAtPosition !== null){
            this.setNewPosition(null,new google.maps.LatLng(this.env.setStartAtPosition.lat, this.env.setStartAtPosition.lng));
        }
    },
    
    setupLayer : function(idname, layer, data){
        this.layers[idname] = {};
        if(typeof(data) === "undefined"){
            this.layers[idname].data = [];
        } else {
            this.layers[idname].data = data;
        }
        this.layers[idname].idname = idname;
        this.layers[idname].layerObject = layer;
        var tabid = this.layers[idname].layerObject.tabid;
        if(typeof(tabid) === "undefined"){
            tabid = "other";
        }
        this.layers[idname].tabid = tabid;
        this.layers[idname].layerObject.setup(this.layers[idname].data);
        this.refreshControls(idname);
    },
    
    setNewPosition : function(overlay, latlng) {
       if (latlng) {
           if(!this.inRange({"lat":latlng.lat(), "lng":latlng.lng()})){
               this.showMessage("Out of area!");
               return;
           }
           if(this.userMarker){
              this.map.removeOverlay(this.userMarker);
              this.userMarker = null;
           }
           this.userMarker = this.createMarker({"lat":latlng.lat(), "lng":latlng.lng()});
           this.trigger("setPosition");
       }
   },
    
    createMarker : function(pos) {
        var customIcon = new google.maps.Icon(G_DEFAULT_ICON); 
        customIcon.image = 
        "http://gmaps-samples.googlecode.com/svn/trunk/markers/green/blank.png"; 
        var marker = new google.maps.Marker(new google.maps.LatLng(pos.lat, pos.lng), {icon: customIcon});
        var obj = this;
        GEvent.addListener(marker, "click", function() {
            marker.openInfoWindowHtml(obj.getCurrentAddress());
            });
        this.map.addOverlay(marker);
        return marker;
    },
    
    newPositionSet : function(){
        this.currentPosition = {"lat":this.userMarker.getLatLng().lat(), "lng": this.userMarker.getLatLng().lng()};
        this.getAddressForPoint(this.userMarker.getLatLng());
//        this.userMarker.openInfoWindow('You have set your position.<br/><a href="#" onclick="mapnificent.startCalculation();">Start Calculation now</a><br><small>This may take a moment. Or two.</small>');
        jQuery("#loading").show();
        var obj = this;
        window.setTimeout(function(){
            obj.startCalculation();
            obj.trigger("redraw");
            jQuery("#loading").fadeOut(200);
        },0);
    },
    
    
    getCurrentAddress : function(){
        return this.formattedAddress;
    },
    
    getAddressForPoint : function(latlng) {
        var obj = this;
        var callback = function(response) {
            if (response && response.Status.code == 200) {
                obj.formattedAddress = response.Placemark[0].address;
            }
        };
        this.geocoder.getLocations(latlng, callback);
    },
    
    calculateLayer : function(idname){
        jQuery("#loading").show();
        var obj = this;
        window.setTimeout(function(){
            obj.layers[idname].layerObject.calculate(obj.currentPosition);
            obj.trigger("redraw");
            jQuery("#loading").fadeOut(200);
        },0);
    },
    
    startCalculation : function(){
        for(var idname in this.layers){
            this.layers[idname].layerObject.calculate(this.currentPosition);
        }
    },
    
    closestObjects : function(pos, key, lookup){
        var nearestObjects = this.getNearestObjectsForPosition(pos, key);
        var result = [];
        for (var i=0;i<nearestObjects.length;i++){
            result.push([nearestObjects[i], this.getDistanceInKm(pos, lookup[nearestObjects[i]].pos)]);
        }
        return result;
    },
    getBlockIndizesForPositionByRadius : function(pos, rad){
        var indizes = this.getBlockIndizesForPosition(pos);
        if(rad == 0){
            return [indizes];
        }
        var results = [];
        var maxDistanceToEdge = Math.max(Math.abs(this.env.blockCountX-indizes[0]), Math.abs(indizes[1]-this.env.blockCountY));
        var nearestObjects = [];
        for(var i=rad;i<maxDistanceToEdge;i++){
            for (var j=-i;j<(i+1);j++){
                var nx = indizes[0]-i;
                var ny = indizes[1]+j;
                if(nx>=0 && ny < this.env.blockCountY && ny > 0){
                    results.push([nx,ny]);
                }
                var nx = indizes[0]+i;
                var ny = indizes[1]+j;
                if(nx < this.env.blockCountX && ny < this.env.blockCountY && ny > 0){
                    results.push([nx,ny]);
                }
                if(j>-i && j<i){
                    var nx = indizes[0]+j;
                    var ny = indizes[1]-i;
                    if(nx < this.env.blockCountX && nx > 0 && ny >= 0){
                        results.push([nx,ny]);
                    }
                    var nx = indizes[0]+j;
                    var ny = indizes[1]-i;
                    if(nx < this.env.blockCountX && nx > 0 && ny >= 0){
                        results.push([nx,ny]);
                    }
                }
            }
            break; // algorithm change: break here, wait for next round. I miss iterators.
        }
        return results;
    },
    
    addTab : function(idname, title, active){
        this.tabs.push(idname);
        jQuery("#controls").tabs("add", "#controls-"+idname, title);
        var li = jQuery("#controls-tabnavigation li:last");
        li.attr("id",'activatetabitem-'+idname);
        if(typeof(active) === "undefined" || active){
            var chk = ' checked="checked"';
        } else { var chk = ''; }
        li.prepend('<input type="checkbox" class="mapnificent-activate-tab" id="activatetab-'+idname+'"'+chk+'/>');
    },
    
    addLiveLoader : function(){
        var script="", jsonp="", idname="", func="";
        var already = jQuery.cookie("mapnificentCustom");
        var enable = false;
        if(already != null){
            var alreadyparts = already.split("|");
            script = decodeURI(alreadyparts[0]);
            jsonp = decodeURI(alreadyparts[1]);
            enable = true;
        }
        this.addTab("custom", "Load your own!", enable);
        jQuery("#controls-custom").append(''+
            '<h2>Load your own Layer</h2>'+
            '<p><a href="docs/">Find the necessary information in the documentation of Mapnificent</a></p>'+
            '<span style="padding:2px 5px;">URL of Script: <input type="text" value="'+script+'" name="liveloader-script" id="liveloader-script"/></span>'+
            '<span style="padding:2px 5px;">URL of JSONP (optional): <input type="text" value="'+jsonp+'" name="liveloader-json" id="liveloader-jsonp"/></span><br/>'+
            '<input type="button" value="Add Layer" id="liveloader-addlayer"/>'+
        '');
        if (already != null){
            this.showMessage("Added your own layer: "+ escape(idname));
            this.addCustomLayer();
        }
        var that = this;
        jQuery("#liveloader-addlayer").click(function(e){
            that.addCustomLayer.apply(that, [e]);
        });
    },
    
    addCustomLayer : function(e){
        if (e) {e.preventDefault();}
        var script = jQuery("#liveloader-script").val();
        if(script == ""){
            jQuery.cookie('mapnificentCustom', null, { path: '/', expires: 14 });
            this.showMessage("You gave me no script!");
            return;
        }
        var jsonp = jQuery("#liveloader-jsonp").val();
        var cookieValue = encodeURI(script) + "|" + encodeURI(jsonp);
        jQuery.cookie('mapnificentCustom', cookieValue, { path: '/', expires: 14 });
        var that = this;
        var loadingDone = function(){
            for(var idname in MAPNIFICENT_LAYER){
                if (typeof(that.layers[idname]) === "undefined"){
                    MAPNIFICENT_LAYER[idname].tabid="custom";
                    that.setupLayer.apply(that, [idname, MAPNIFICENT_LAYER[idname], MAPNIFICENT_LAYERDATA[idname] || []]);
                    if(that.currentPosition != null){
                        that.layers[idname].layerObject.calculate(that.currentPosition);
                    }
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
    },
    
    showMessage : function(message){
        jQuery("#message").html(message);
        jQuery("#message").fadeIn(200);
        window.setTimeout(function(){
            jQuery("#message").fadeOut(400);
        },5000);
    }
};