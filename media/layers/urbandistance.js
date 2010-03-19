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
    var LOCK = false,
        minuteValue = 15,
        minutesPerKm = 13,
        maxWalkTime = 10,
        startPos = null,
        active = false,
        stationList = [],
        stationMap = {},
        blockGrid,
        stations,
        lines;
    var updateGoby = function(e){
        try{
            maxWalkTime = parseInt(jQuery('#'+that.idname+'-gotime').val());
        } catch(e){
            return;
        }
        var means = jQuery("input[name="+that.idname+"-goby']:checked").val();
        if (means == "walk"){
            minutesPerKm = 13;
        } else if (means == "bike"){
            minutesPerKm = 4; // ~15-16 km/h (traffic lights, no straigh line)
        }
        mapnificent.trigger("redraw");
    };
    var updateSlider = function(e, ui){
        if (LOCK){return;}
        LOCK = true;
        startPos = mapnificent.getCurrentPosition();
        if (startPos === null){return;}
        minuteValue = ui.value;
        mapnificent.trigger("redraw");
        LOCK = false;
    };
    var drawMinuteCircle = function(ctx, pos, minutes){
        var mins = Math.min((minuteValue - minutes),maxWalkTime);
        var radius = Math.max(mins * pixelPerMinute, 1);
        var nxy = mapnificent.getCanvasXY(pos);
        try {
            ctx.moveTo(nxy.x,nxy.y);
            ctx.arc(nxy.x,nxy.y,radius, 0, mapnificent.circleRadians, true);
        }catch(e){
            console.log(e);
            console.log(pos.lat, pos.lng);
            console.log(nxy.x, nxy.y);
            console.log(radius);
            console.log(mapnificent.circleRadians);
        }
    };
    var calculateTimes = function(stationId, minutes, line, stay){
        if (typeof(stationMap[stationId]) !=="undefined" && stationMap[stationId]["minutes"]<=minutes){
            return;
        }
        var station = stations[stationId];
        stationMap[stationId] = {"minutes": minutes};
        for(var i=0;i<station.reachableStations.length;i++){
            if (line == null){
                var nextMinutes = minutes + station.reachableStations[i].minutes;
            } else if(station.reachableStations[i].line == line){
                var nextMinutes = minutes + station.reachableStations[i].minutes + stay;
            } else {
                var nextMinutes = minutes + getWaitTime(stationId, line, station.reachableStations[i].stationId, station.reachableStations[i].line) + station.reachableStations[i].minutes;
            }
            calculateTimes(station.reachableStations[i].stationId, nextMinutes, station.reachableStations[i].line, station.reachableStations[i]["stay"]);
        }
        return true;
    };
    var getWaitTime = function(station1, line1, station2, line2){
        if(typeof lines[line2] !== "undefined"){
            return lines[line2].interval/2;
        }
        return 6; // Well, this is a hack
    };
    that.getTitle = function(){
        return "Urban Distance";
    };
    that.appendControlHtmlTo = function(container){
        container.html(''+
            '<div style="margin-right:15%;float:right;position:relative;top:-1.4em">'+
            '<input type="radio" class="'+that.idname+'-goby" id="'+that.idname+'-gobywalk" name="'+that.idname+'-goby" value="walk" checked="checked"/>'+
            '<label for="'+that.idname+'-gobywalk"> with Public Transport</label><br/>'+
            '<input type="radio" class="'+that.idname+'-goby" id="'+that.idname+'-gobybike" name="'+that.idname+'-goby" value="bike"/>'+
            '<label for="'+that.idname+'-gobybike"> with Public Transport and bike</label><br/>'+
            '<label for="'+that.idname+'-gotime">Max. time to walk/ride from/to stations: </label><input size="3" type="text" id="'+that.idname+'-gotime" value="'+maxWalkTime+'"/> minutes'+
            '</div>'+
            '<span>Area reachable in max. '+
            '<strong id="'+that.idname+'-timeSpan"></strong> minutes <small>(no guarantee)</small> </span><span id="'+that.idname+'-hint" style="color:#0b0;">Click in the grey area to set a new position.</span>'+
            '<div id="'+that.idname+'-slider" class="slider"></div>'+
            '');

        jQuery("#"+that.idname+'-slider').slider({ min: 0, max: 180,
               slide: updateSlider,
               stop: updateSlider, 
               value: minuteValue
            });
        jQuery("#"+that.idname+'-slider').slider("disable");
        jQuery("#"+that.idname+'-timeSpan').text(minuteValue);
        jQuery('.'+that.idname+'-goby').change(updateGoby);
        jQuery('#'+that.idname+'-gotime').change(updateGoby);
    };
    that.activate = function(){
        if(startPos !=null){
            jQuery("#"+that.idname+'-slider').slider("enable");
        }
    };
    that.deactivate = function(){
        jQuery("#"+that.idname+'-slider').slider("disable");
    };
    that.getDrawingLevel = function(){
        return 0;
    };
    
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
    };
    that.calculate = function(pos){
        if(!active){
            jQuery('#'+that.idname+'-noMarker').hide();
            jQuery("#"+that.idname+'-slider').slider("enable");
            active = true;
        }
        startPos = pos;
        stationMap = {};
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
                calculateTimes(nextStations[i], minutes, null);
            }
        }
    };
    that.redraw = function(ctx){
        if (startPos === null){return;}
        pixelPerMinute = (1/minutesPerKm) * mapnificent.env.pixelPerKm;
        jQuery("#"+that.idname+'-timeSpan').text(minuteValue);
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(75,75,75,0.75)";
        var xy = mapnificent.getCanvasXY(mapnificent.env.northwest);
        ctx.fillRect(xy.x,xy.y,mapnificent.env.map_width,mapnificent.env.map_height);
        ctx.globalCompositeOperation = "destination-out";
        
        ctx.beginPath();
        drawMinuteCircle(ctx, startPos, 0);
        if(!jQuery.browser.opera){
            /* This is crazy: opera is way faster if everything is on one path */
            /* Chrome and Firefox are way slower */
            ctx.fill();
        }
        try {
            for (var i=0; i<stationList.length;i++){
                var stationId = stationList[i];
                var station = stations[stationId];
                if (typeof station.pos !== "object" || station.pos === null){continue;}
                if (typeof stationMap[stationId] === "undefined"){continue;}
                if (stationMap[stationId].minutes > minuteValue){continue;}
                if(!jQuery.browser.opera){
                    ctx.beginPath();
                }
                drawMinuteCircle(ctx, station.pos, stationMap[stationId].minutes);
                if(!jQuery.browser.opera){
                    ctx.fill();
                }
            }
        }catch(e){
            console.log(e);
        }
        if(jQuery.browser.opera){
            ctx.fill();
        }
        ctx.restore();
    };
    return that;
}(mapnificent));