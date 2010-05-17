/* 
    (c) Copyright 2010 Stefan Wehrmeyer.
    Released under Creative Commons By-NC-SA: http://creativecommons.org/licenses/by-nc-sa/3.0
    By: Stefan Wehrmeyer http://stefanwehrmeyer.com
    If you want to use this software commercially, contact the author.
    
    This may be published as really Free Software in the future.
*/

MAPNIFICENT_LAYER.urbanDistance = (function (mapnificent){
    var that = mapnificent.createLayer();
    that.tabid = "mobility";
    that.idname = "urbanDistance";
    var LOCK = false
        , minutesPerKm = 13
        , MAX_ACCEPTABLE_TIME = 60
        , maxWalkTime = 10
        , positionCounter = -1
        , startPositions = {}
        , active = false
        , stationList = []
        , stationMap = {}
        , blockGrid
        , stations
        , lines
        , defaultStartAtPosition = {"lat": 52.51622086393074, "lng": 13.37911605834961}
        , intersection = false
        , colored = false
        , colorCache = {};
        
    var updateGoby = function(e){
        var newMaxWalkTime, newMinutesPerKm;
        try{
            newMaxWalkTime = parseInt(jQuery('#'+that.idname+'-gotime').val());
        } catch(e){
            return;
        }
        var walking = jQuery("#"+that.idname+'-gobywalk').is(":checked");
        if (walking){
            newMinutesPerKm = 13;
        } else{
            newMinutesPerKm = 4; // ~15-16 km/h (traffic lights, no straigh line)
        }
        if(newMinutesPerKm != minutesPerKm || newMaxWalkTime != maxWalkTime){
            minutesPerKm = newMinutesPerKm;
            maxWalkTime = newMaxWalkTime;
            mapnificent.calculateLayer(that.idname);
            mapnificent.trigger("redraw");
        }
    };
    var updateSlider = function(index){
        return function(e, ui){
            if (startPositions[index].LOCK){return;}
            startPositions[index].LOCK = true;
            startPositions[index].minutes = ui.value;
            mapnificent.trigger("redraw");
            jQuery("#"+that.idname+'-'+index+'-timeSpan').text(startPositions[index].minutes);
            startPositions[index].LOCK = false;
        };
    };
    
    that.getTitle = function(){
        return "Urban Distance";
    };
    that.appendControlHtmlTo = function(container){
        container.html(''+
/*            '<div style="margin-right:15%;float:right;position:relative;top:-1.4em">'+
            '<input type="radio" class="'+that.idname+'-goby" id="'+that.idname+'-gobywalk" name="'+that.idname+'-goby" value="walk" checked="checked"/>'+
            '<label for="'+that.idname+'-gobywalk"> with Public Transport</label><br/>'+
            '<input type="radio" class="'+that.idname+'-goby" id="'+that.idname+'-gobybike" name="'+that.idname+'-goby" value="bike"/>'+
            '<label for="'+that.idname+'-gobybike"> with Public Transport and bike</label><br/>'+
            '<label for="'+that.idname+'-gotime">Max. time to walk/ride from/to stations: </label><input size="3" type="text" id="'+that.idname+'-gotime" value="'+maxWalkTime+'"/> minutes'+
            '</div>'+*/
            '<label for="'+that.idname+'-intersection">Intersect Areas: </label><input type="checkbox" id="'+that.idname+'-intersection"/>'+
            '<label for="'+that.idname+'-colored">Colored: </label><input type="checkbox" id="'+that.idname+'-colored"/>'+
                '<div id="'+that.idname+'-positionContainer"></div>'+
            '');
//            '<span>Area reachable in max. '+
//            '<strong id="'+that.idname+'-timeSpan"></strong> minutes <small>(no guarantee)</small> </span><span id="'+that.idname+'-hint" style="color:#0b0;">Click in the grey area to set a new position.</span>'+
//           '<div id="'+that.idname+'-slider" class="slider"></div>'+

/*        jQuery("#"+that.idname+'-slider').slider({ min: 0, max: 180,
               slide: updateSlider,
               stop: updateSlider, 
               value: minuteValue
            });
        jQuery("#"+that.idname+'-slider').slider("disable");
        jQuery("#"+that.idname+'-timeSpan').text(minuteValue);
        jQuery('.'+that.idname+'-goby').change(updateGoby);
        jQuery('#'+that.idname+'-gotime').change(updateGoby);*/
        jQuery('#'+that.idname+'-intersection').change(function(e){
            if(!mapnificent.hasCompositing){
                mapnificent.showMessage("Your browser does not support advanced canvas compositing!");
                $(this).attr("checked", null);
                return;
            }
            intersection = $(this).is(":checked");
            mapnificent.trigger("redraw");
        });
        jQuery('#'+that.idname+'-colored').change(function(e){
            colored = $(this).is(":checked");
            mapnificent.trigger("redraw");
        });
    };
    
    var openPositionWindow = function(index){
        return function(){
            startPositions[index].marker.openInfoWindowHtml('<span class="'+that.idname+'-'+index+'-address">'+startPositions[index].address+'</span>');
        };
    };
    
    var addPositionHtml = function(index){
        jQuery("#"+that.idname+'-positionContainer').append('<div id="'+that.idname+'-'+index+'">'+
                 '<span>Area reachable in max. '+
                 '<strong id="'+that.idname+'-'+index+'-timeSpan"></strong> minutes <small>(no guarantee)</small></span>'+
                 '<input type="button" value="Remove" id="'+that.idname+'-'+index+'-remove"/>'+
                '<div id="'+that.idname+'-'+index+'-slider" class="slider"></div>'+
                '<div class="'+that.idname+'-'+index+'-address"></div>'+
                '</div>');
        jQuery('#'+that.idname+'-'+index+'-slider').slider({ min: 0, max: 180,
                     slide: updateSlider(index),
                     stop: updateSlider(index), 
                     value: startPositions[index].minutes
                  });
        jQuery("#"+that.idname+'-'+index+'-timeSpan').text(startPositions[index].minutes);
        jQuery("#"+that.idname+'-'+index+'-remove').click(function(){
            removePosition(index);
        });
    };
    
    var highlightMarker = function(index){
        return function(){
            jQuery('#'+that.idname+'-'+index).css('outline', '1px #00BB0B solid');
            startPositions[index].marker.setImage("http://gmaps-samples.googlecode.com/svn/trunk/markers/green/blank.png");
        };
    };
    
    var unhighlightMarker = function(index){
        return function(){
            jQuery('#'+that.idname+'-'+index).css('outline', '0px');
            startPositions[index].marker.setImage("http://gmaps-samples.googlecode.com/svn/trunk/markers/orange/blank.png");
        };
    };
    
    var setAddressForIndex = function(index){
        return function(adr){
            startPositions[index].address = adr;
            jQuery('.'+that.idname+'-'+index+'-address').text(adr);
        }; 
    };
    
    var addPosition = function(latlng){
        if(LOCK){return;}
        if(!mapnificent.inRange({"lat":latlng.lat, "lng":latlng.lng})){
            mapnificent.showMessage("Out of area!");
            return;
        }
        LOCK = true;
        mapnificent.showMessage("Calculating...");
        positionCounter += 1;
        var index = positionCounter;
        window.setTimeout(function(){
            var marker = mapnificent.createMarker(latlng, {"draggable":true});
            marker.setImage("http://gmaps-samples.googlecode.com/svn/trunk/markers/orange/blank.png");
            startPositions[index] = {"marker": marker, "latlng": latlng, "minutes": 15, "address": "Loading...", "LOCK": false};
            mapnificent.getAddressForPoint(latlng, setAddressForIndex(index));
            mapnificent.addEventOnMarker("click", marker, openPositionWindow(index));
            mapnificent.addEventOnMarker("mouseover", marker, highlightMarker(index));
            mapnificent.addEventOnMarker("mouseout", marker, unhighlightMarker(index));
            mapnificent.addEventOnMarker("dragstart", marker, function(){setAddressForIndex(index)("");});
            mapnificent.addEventOnMarker("dragend", marker, function(ll){
                startPositions[index].latlng = {"lat": ll.lat(), "lng": ll.lng()};
                that.calculate(index, function(){mapnificent.trigger("redraw");});
                mapnificent.getAddressForPoint(startPositions[index].latlng, setAddressForIndex(index));
            });
            addPositionHtml(index);
            that.calculate(index, function(){mapnificent.hideMessage();mapnificent.trigger("redraw");LOCK=false;});
        }, 5);
    };
    
    var removePosition = function(index){
        jQuery("#"+that.idname+'-'+index).remove();
        mapnificent.removeMarker(startPositions[index].marker);
        delete startPositions[index];
        delete stationMap[index];
        mapnificent.trigger("redraw");
    };
    
    that.activate = function(){
        for(var index in startPositions){
            jQuery("#"+that.idname+'-'+index+'-slider').slider("enable");
            startPositions[index].marker.show();
        }
        mapnificent.bind("mapClick", addPosition);
    };
    that.deactivate = function(){
        for(var index in startPositions){
            jQuery("#"+that.idname+'-'+index+'-slider').slider("disable");
            startPositions[index].marker.hide();
        }
        mapnificent.unbind("mapClick", that.addPosition);
    };
    that.getDrawingLevel = function(){
        return 0;
    };
        
    /*
        jQuery("#loading").show();
        var obj = this;
        window.setTimeout(function(){
            obj.startCalculation();
            obj.trigger("redraw");
            jQuery("#loading").fadeOut(200);
        },0);
    };
    
        var obj = this;
        GEvent.addListener(marker, "click", function() {
            marker.openInfoWindowHtml(obj.getCurrentAddress());
            });
        this.map.addOverlay(marker);
        return marker;
        this.bind("setPosition", this.newPositionSet);
        if(this.env.setStartAtPosition !== null){
            this.setNewPosition(null,new google.maps.LatLng(this.env.setStartAtPosition.lat, this.env.setStartAtPosition.lng));
        }
    */
    
    that.setup = function(dataobjs){
        stations = dataobjs[0];
        lines = dataobjs[1];
        blockGrid = [];
        for(var i=0;i<mapnificent.env.blockCountX;i+=1){
            blockGrid.push([]);
            for(var j=0;j<mapnificent.env.blockCountX;j+=1){
                blockGrid[i].push([]);
            }
        }
        stationList = [];
        for(var stationId in stations){
            if (stations[stationId].pos != null){
                if(mapnificent.inRange(stations[stationId].pos)){
                    stationList.push(stationId);
                    var indizes = mapnificent.getBlockIndizesForPosition(stations[stationId].pos);
                    blockGrid[indizes[0]][indizes[1]].push(stationId);
                } else {
                    }
            }
        }
        addPosition(defaultStartAtPosition);
    };
    that.calculate = function(index, clb){
        stationMap[index] = {};
        var startPos = startPositions[index].latlng;
        var numberOfClosest = 3;
        var minDistances=[], minStations=[];
        var i = 0;
        var nextStations = [];
        while(i<=1 || nextStations.length == 0){
            var indizes = mapnificent.getBlockIndizesForPositionByRadius(startPos, i);
            for(var j=0;j<indizes.length;j+=1){
                if(blockGrid[indizes[j][0]][indizes[j][1]].length>0){
                    nextStations = jQuery.merge(nextStations, blockGrid[indizes[j][0]][indizes[j][1]]);
                }
            }
            i+=1;
        }
        for(var i=0;i<nextStations.length;i+=1){
            var distance = mapnificent.getDistanceInKm(startPos, stations[nextStations[i]].pos);
            var minutes = distance * minutesPerKm;
            if (minutes <= maxWalkTime){
                calculateTimes(index, nextStations[i], minutes, null);
            }
        }
        if(clb){
            clb();
        }
    };
    
    var calculateTimes = function(index, stationId, minutes, line, stay){
        if (typeof(stationMap[index][stationId]) !=="undefined" && stationMap[index][stationId].minutes <= minutes){
            return;
        }
        var station = stations[stationId];
        stationMap[index][stationId] = {"minutes": minutes};
        for(var i=0;i<station.reachableStations.length;i++){
            if (line == null){
                var nextMinutes = minutes + station.reachableStations[i].minutes;
            } else if(station.reachableStations[i].line == line){
                var nextMinutes = minutes + station.reachableStations[i].minutes + stay;
            } else {
                var nextMinutes = minutes + getWaitTime(stationId, line, station.reachableStations[i].stationId, station.reachableStations[i].line) + station.reachableStations[i].minutes;
            }
            calculateTimes(index, station.reachableStations[i].stationId, nextMinutes, station.reachableStations[i].line, station.reachableStations[i]["stay"]);
        }
        return true;
    };
    
    
    var getWaitTime = function(station1, line1, station2, line2){
        if(typeof lines[line2] !== "undefined"){
            return lines[line2].interval/2;
        }
        return 6; // Well, this is a hack
    };
    
    var getColorFor = function(min){
        if(min == 0){min = 1;}
        if(typeof(colorCache[min]) === "undefined"){
            colorCache[min] = "hsla("+(120 - Math.floor(min/MAX_ACCEPTABLE_TIME*120))+", 100%, 50%, 1)";
        }
        return colorCache[min];
    };

    var drawMinuteCircle = function(ctx, pos, minutes, minuteValue){
        var mins = Math.min((minuteValue - minutes),maxWalkTime);
        var radius = Math.max(mins * pixelPerMinute, 1);
        var nxy = mapnificent.getCanvasXY(pos);
        try {
            if(colored){
                var grad = ctx.createRadialGradient(nxy.x,nxy.y,0,nxy.x,nxy.y,radius);  
                grad.addColorStop(0, getColorFor(minutes));
                grad.addColorStop(0.5, getColorFor(Math.floor(minutes + (mins/2))));
                grad.addColorStop(1, getColorFor(minutes+mins));
                ctx.fillStyle = grad;
            } else {
                
            }
            ctx.moveTo(nxy.x,nxy.y);
            ctx.arc(nxy.x,nxy.y,radius, 0, mapnificent.circleRadians, true);
            // ctx.fillRect(xy.x-radius, xy.y-radius, radius*2, radius*2);
        }catch(e){
            console.log(e);
            console.log(pos.lat, pos.lng);
            console.log(nxy.x, nxy.y);
            console.log(radius);
            console.log(mapnificent.circleRadians);
        }
    };
    
    var fillGreyArea = function(ctx){
        if(intersection){
            ctx.globalCompositeOperation = "source-out";
        } else {
            ctx.globalCompositeOperation = "source-over";
        }
        ctx.fillStyle = "rgba(75,75,75,0.4)";
        var xy = mapnificent.getCanvasXY(mapnificent.env.northwest);
        ctx.fillRect(xy.x,xy.y,mapnificent.env.map_width,mapnificent.env.map_height);
    };
    
    redrawIndex = function(ctx, index){
        try {
            for (var i=0; i<stationList.length;i++){
                var stationId = stationList[i];
                var station = stations[stationId];
                if (typeof station.pos !== "object" || station.pos === null){continue;}
                if (typeof stationMap[index][stationId] === "undefined"){continue;}
                if (stationMap[index][stationId].minutes > startPositions[index].minutes){continue;}
                if(colored || (!jQuery.browser.opera  && !intersection)){
                    ctx.beginPath();
                }
                drawMinuteCircle(ctx, station.pos, stationMap[index][stationId].minutes, startPositions[index].minutes);
                if(colored || (!jQuery.browser.opera && !intersection)){
                     ctx.fill();
                }
            }
        }catch(e){
            console.log(e);
        }
    };
    
    that.redraw = function(ctx){
        pixelPerMinute = (1/minutesPerKm) * mapnificent.env.pixelPerKm;
        ctx.save();
        if(!intersection && !colored){
            fillGreyArea(ctx);
            ctx.globalCompositeOperation = "destination-out";
        } else if(colored){
            ctx.globalCompositeOperation = "destination-over";
        }
        var count = 0;
        ctx.fillStyle = "rgba(75,75,75,0.8)";
        for(var index in startPositions){
            if(count == 1 && intersection && !colored){
                ctx.globalCompositeOperation = "destination-in";
            }
            ctx.beginPath();
            drawMinuteCircle(ctx, startPositions[index].latlng, 0, startPositions[index].minutes);

            if(colored || (!jQuery.browser.opera && !intersection)){
                ctx.fill();
            }
            redrawIndex(ctx, index);
            if(jQuery.browser.opera || intersection){
               ctx.fill();
            }
            count += 1;
        }
        if(intersection && !colored){
            fillGreyArea(ctx);
        }
        if (colored){
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "rgba(255,255,255,1)";
            var xy = mapnificent.getCanvasXY(mapnificent.env.northwest);
            ctx.fillRect(xy.x,xy.y,mapnificent.env.map_width,mapnificent.env.map_height);
            ctx.restore();
        }
        ctx.restore();
    };
    
    return that;
}(mapnificent));