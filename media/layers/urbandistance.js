/* 
    (c) Copyright 2010 Stefan Wehrmeyer.
    Released under Creative Commons By-NC-SA: http://creativecommons.org/licenses/by-nc-sa/3.0
    By: Stefan Wehrmeyer http://stefanwehrmeyer.com
    If you want to use this software commercially, contact the author.
    
    This may be published as really Free Software in the future.
*/
var iCanHasFastBrowser = function(){
    return false;
    if(navigator.userAgent.indexOf("Chrome")!=-1){
        return true;
    }
    return false;
};

var WorkerFacade;
if(!!window.Worker && !iCanHasFastBrowser()){
    WorkerFacade = (function(){
        return function(path){
            return new window.Worker(path);
        };
    }());
} else {
    WorkerFacade = (function(){
        var workers = {}, clb = false, loaded = false, masters = {};
        var that = function(path){
            var theworker = {};
            theworker.postMessage = function(param){
                try{
                    workers[path]({"data": param});
                }catch(err){
//                    theworker.onerror(err);
                    throw err;
                }
            };
            masters[path] = theworker;
            return theworker;
        };
        that.fake = true;
        that.add = function(pth, worker){
            workers[pth] = worker;
        };
        that.toString = function(){
            return "FakeWorker('"+path+"')";
        };
        that.callback = function(c){
            if(loaded){
                console.log("immediate execution of callback");
                c();
            } else {
                clb = c;
            }
        };
        that.callCallback = function(){
            loaded = true;
            if(!!clb){
                console.log("executing callback");
                clb();
            }
            
        };
        // This is a global function!
        postMessage = function(param){
            for (var path in workers){
                masters[path].onmessage({"data": param});
            }
        };
        return that;
    }());
    var scr = document.createElement("SCRIPT");
    scr.src = "media/layers/urbandistanceworker.js";
    scr.type = "text/javascript";
    scr.charset = "utf-8";
    scr.onload = function(){
        WorkerFacade.callCallback();
    };
    document.body.appendChild(scr);
}

MAPNIFICENT_LAYER.urbanDistance = (function (mapnificent){
    var that = mapnificent.createLayer();
    that.tabid = "mobility";
    that.idname = "urbanDistance";
    var LOCK = false
        , callbacksForIndex = {}
        , minutesPerKm = 13
        , estimatedMinuteLimit = 600 // 10 hours travel in a city, really?
        , colorMaxAcceptableTime = 60
        , colorBaseGradientColor = 120
        , colorMaxGradientColor = 0
        , maxWalkTime = 10
        , positionCounter = -1
        , startPositions = {}
        , startPositionsCount = 0
        , stationList = []
        , stationMap = {}
        , blockGrid
        , stations
        , lines
        , defaultStartAtPosition = {"lat":52.525849,"lng":13.368919}
        , intersection = false
        , colored = false
        , colorCache = {}
        , minuteSorted = false;
        
        
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
//            startPositions[index].minutes = parseInt(jQuery(this).val()); // HTML5 Future
            startPositions[index].minutes = ui.value;
            mapnificent.trigger("redraw");
            jQuery("#"+that.idname+'-'+index+'-timeSpan').text(startPositions[index].minutes);
            startPositions[index].LOCK = false;
        };
    };
    
    that.getTitle = function(){
        return "Urban Distance";
    };
    var appendControlHtmlTo = function(container){
        container.html(''+
/*            '<div style="margin-right:15%;float:right;position:relative;top:-1.4em">'+
            '<input type="radio" class="'+that.idname+'-goby" id="'+that.idname+'-gobywalk" name="'+that.idname+'-goby" value="walk" checked="checked"/>'+
            '<label for="'+that.idname+'-gobywalk"> with Public Transport</label><br/>'+
            '<input type="radio" class="'+that.idname+'-goby" id="'+that.idname+'-gobybike" name="'+that.idname+'-goby" value="bike"/>'+
            '<label for="'+that.idname+'-gobybike"> with Public Transport and bike</label><br/>'+
            '<label for="'+that.idname+'-gotime">Max. time to walk/ride from/to stations: </label><input size="3" type="text" id="'+that.idname+'-gotime" value="'+maxWalkTime+'"/> minutes'+
            '</div>'+
            ''+*/
                '<div id="'+that.idname+'-positionContainer"></div>'+
            '');
        var inter = "";
        if(mapnificent.hasCompositing){
            inter = '<label for="'+that.idname+'-intersection">Intersect: </label><input type="checkbox" id="'+that.idname+'-intersection"/>';
        }
        container.after(''+
            '<div class="controlsoverlay" style="right:inherit;width:100px;left:0px !important;bottom:50px;border-left: 0px;border-bottom: 5px solid rgb(213,213,213);border-right: 5px solid rgb(213,213,213);">'+
            '<label for="'+that.idname+'-colored">Colored: </label><input type="checkbox" id="'+that.idname+'-colored"/>'+
            inter+
            '</div>'+
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
                mapnificent.showMessage("Your browser does not support intersections, try Firefox or Opera!");
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
            startPositions[index].infowindow.setContent('<div style="margin:10px auto" class="'+that.idname+'-'+index+'-address">'+startPositions[index].address+'</span>');
            startPositions[index].infowindow.open(mapnificent.map, startPositions[index].marker);
        };
    };
    
    var addPositionHtml = function(index){
        jQuery("#"+that.idname+'-positionContainer').append('<div id="'+that.idname+'-'+index+'" style="padding:5px;margin:5px 0px;border-bottom:1px solid #bbb;">'+
                 '<span id="'+that.idname+'-'+index+'-info" style="visibility:hidden">You need at most <strong id="'+that.idname+'-'+index+'-timeSpan"></strong> minutes '+
                 'to any point in the highlighted area <small>(no guarantee)</small></span>'+
                 '<div style=""><input type="button" value="X" id="'+that.idname+'-'+index+'-remove" style="margin:2px 10px;float:right;color:#600;"/>'+
                '<div style="display:none" id="'+that.idname+'-'+index+'-slider"></div>'+ // Use HTML5 range some day here
                '<div id="'+that.idname+'-'+index+'-progressbar"></div>'+ // Use HTML5 progress some day here
                '</div>'+
                '<div style="font-size:9px" class="'+that.idname+'-'+index+'-address"></div>'+
                '</div>');
        jQuery('#'+that.idname+'-'+index).mouseover(highlightMarker(index));
        jQuery('#'+that.idname+'-'+index).mouseout(unhighlightMarker(index));
        jQuery('#'+that.idname+'-'+index+'-slider').slider({ min: 0, max: 180,
                     slide: updateSlider(index),
                     stop: updateSlider(index), 
                     value: startPositions[index].minutes,
                     animate: true
                  });
        jQuery('#'+that.idname+'-'+index+'-progressbar').progressbar({
            value: 0
        });
        jQuery("#"+that.idname+'-'+index+'-timeSpan').text(startPositions[index].minutes);
        jQuery("#"+that.idname+'-'+index+'-remove').click(function(){
            removePosition(index);
        });
    };
    
    var highlightMarker = function(index){
        return function(){
            jQuery('#'+that.idname+'-'+index+'').css('outline', '1px rgb(0,187,11) solid');
            startPositions[index].marker.setIcon("http://gmaps-samples.googlecode.com/svn/trunk/markers/green/blank.png");
        };
    };
    
    var unhighlightMarker = function(index){
        return function(){
            jQuery('#'+that.idname+'-'+index).css('outline', 'inherit');
            startPositions[index].marker.setIcon("http://gmaps-samples.googlecode.com/svn/trunk/markers/orange/blank.png");
        };
    };
    
    var setAddressForIndex = function(index){
        return function(adr){
            startPositions[index].address = adr;
            jQuery('.'+that.idname+'-'+index+'-address').text(adr);
        }; 
    };
    
    var paddZeros = function(number, zerocount){
        number = number.toString();
        var n = number.length;
        for (var k=0; k<(zerocount-n);k++){
            number = "0"+number;
        }
        return number;
    };
    
    var updateCalculationProcess = function(index, count){
        var estimatedMaxCalculateCalls = 2000000, percent = 0;
        if (count>estimatedMaxCalculateCalls){
            percent = 99;
        } else {
            percent = count / estimatedMaxCalculateCalls * 100;
        }
        jQuery('#'+that.idname+'-'+index+'-progressbar').progressbar( "value" , percent);
    };
    
    var beforeCalculate = function(index){
        jQuery('#'+that.idname+'-'+index+'-progressbar').show();
        jQuery('#'+that.idname+'-'+index+'-info').css("visibility", "hidden");
        jQuery('#'+that.idname+'-'+index+'-slider').hide();
    };
    
    var afterCalculate = function(index){
        return function(){
            jQuery('#'+that.idname+'-'+index+'-progressbar').hide();
            jQuery('#'+that.idname+'-'+index+'-info').css("visibility","visible");
            jQuery('#'+that.idname+'-'+index+'-slider').show();
            startPositions[index].ready = true;
            minuteSorted = false;
            window.setTimeout(function(){
                mapnificent.trigger("redraw");
            }, 500);
            var o = "{";
            var i=0;
            var maxminute = 0;
            for(var key in stationMap[index]){
                if (stations[key].pos.lat == startPositions[index].latlng.lat && startPositions[index].latlng.lng == stations[key].pos.lng){
                    continue;
                }
                if(stationMap[index][key].minutes > maxminute){
                    maxminute = stationMap[index][key].minutes;
                }
                // o += "#RN "+paddZeros(i, 6)+" #SN "+key+" #DN 9003201 #RD 07.06.10 #RT 0900 #FW #RP 11111111111001 #RO NNNN\n";
                o += '"'+key+'": ['+stationMap[index][key].minutes+', '+mapnificent.getDistanceInKm(startPositions[index].latlng, stations[key].pos)+'],\n';
                i += 1;
            }
            o += "}";
            // console.log(o);
        };
    };
    
    var addPosition = function(latlng){
        if(!mapnificent.inRange({"lat":latlng.lat, "lng":latlng.lng})){
            mapnificent.showMessage("Out of area!");
            return;
        }
        positionCounter += 1;
        if(startPositionsCount == 0){
            jQuery("#"+that.idname+'-positionContainer').html("");
        }
        startPositionsCount  += 1;
        var index = positionCounter;
        var marker = mapnificent.createMarker(latlng, {"draggable":true});
        marker.setIcon("http://gmaps-samples.googlecode.com/svn/trunk/markers/orange/blank.png");
        startPositions[index] = {"marker": marker, "latlng": latlng, "minutes": 15, 
            "address": "Loading...", "LOCK": false, "ready": false,
            "infowindow": new google.maps.InfoWindow({content: ""}),
            "webworker": WorkerFacade("media/layers/urbandistanceworker.js")};
        console.log("setting for onmessage ", startPositions[index].webworker);
        startPositions[index].webworker.onmessage = workerMessage(index);
        startPositions[index].webworker.onerror = workerError(index);
        mapnificent.getAddressForPoint(latlng, setAddressForIndex(index));
        mapnificent.addEventOnMarker("click", marker, openPositionWindow(index));
        mapnificent.addEventOnMarker("mouseover", marker, highlightMarker(index));
        mapnificent.addEventOnMarker("mouseout", marker, unhighlightMarker(index));
        mapnificent.addEventOnMarker("dragstart", marker, function(){setAddressForIndex(index)(" ");});
        mapnificent.addEventOnMarker("dragend", marker, function(mev){
            startPositions[index].ready = false;
            startPositions[index].latlng = {"lat": mev.latLng.lat(), "lng": mev.latLng.lng()};
            beforeCalculate(index);
            that.calculate(index, afterCalculate(index));
            mapnificent.getAddressForPoint(startPositions[index].latlng, setAddressForIndex(index));
        });
        addPositionHtml(index);
        that.calculate(index, afterCalculate(index));
    };
    
    var removePosition = function(index){
        if(startPositions[index].ready === false){
            startPositions[index].webworker.terminate();
        }
        minuteSorted = false;
        startPositionsCount -= 1;
        if(startPositionsCount == 0){
            jQuery("#"+that.idname+'-positionContainer').text("Click on the map to set a point!");
        }
        jQuery("#"+that.idname+'-'+index).remove();
        mapnificent.removeMarker(startPositions[index].marker);
        delete startPositions[index];
        delete stationMap[index];
        mapnificent.trigger("redraw");
    };
    
    that.activate = function(){
        for(var index in startPositions){
            jQuery("#"+that.idname+'-'+index+'-slider').slider("enable");
            startPositions[index].marker.setVisible(true);
        }
        mapnificent.bind("mapClick", addPosition);
    };
    that.deactivate = function(){
        for(var index in startPositions){
            jQuery("#"+that.idname+'-'+index+'-slider').slider("disable");
            startPositions[index].marker.setVisible(false);
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
    
    that.setup = function(dataobjs, controlcontainer){
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
                }
            }
        }
        appendControlHtmlTo(controlcontainer);
        if(!!WorkerFacade.fake){
            WorkerFacade.callback(function(){addPosition(defaultStartAtPosition);});
        } else {
            addPosition(defaultStartAtPosition);
        }
    };
    
    that.calculate = function(index, clb){
        callbacksForIndex[index] = clb;
        stationMap[index] = {};
        var startPos = startPositions[index].latlng
            , numberOfClosest = 3
            , minDistances=[]
            , minStations=[]
            , i = 0
            , nextStations = []
            , distances = [];
        while(i<=1 || nextStations.length == 0){
            var indizes = mapnificent.getBlockIndizesForPositionByRadius(startPos, i);
            for(var j=0;j<indizes.length;j+=1){
                if(blockGrid[indizes[j][0]][indizes[j][1]].length>0){
                    nextStations = jQuery.merge(nextStations, blockGrid[indizes[j][0]][indizes[j][1]]);
                }
            }
            i += 1;
            if(nextStations.length>10){
                i += 1;
            }
        }
        for(var k=0;k<nextStations.length;k++){
            distances.push(mapnificent.getDistanceInKm(startPos, stations[nextStations[k]].pos));
        }
        console.log("calculate");
        startPositions[index].webworker.postMessage({"fromStations": nextStations, "blockGrid": blockGrid, "position": startPos, 
            "stations": stations, "lines": lines, "distances": distances,
            "maxWalkTime": maxWalkTime, "minutesPerKm": minutesPerKm, "estimatedMinuteLimit": estimatedMinuteLimit});
    };
    
    var workerMessage = function(index){
        return function(event){
            if(event.data.status == "done"){
                stationMap[index] = event.data.stationMap;
                callbacksForIndex[index]();
            } else if (event.data.status == "working"){
                updateCalculationProcess(index, event.data.at);
            }
        };
    };
    
    var workerError = function(index){
        return function(error){
            console.error(index, "Worker: "+error.message);
            throw error;
        };
    };
    
    var getColorFor = function(min){
        if(min == 0){min = 1;}
        if(typeof(colorCache[min]) === "undefined"){
            colorCache[min] = "hsla("+(colorBaseGradientColor - Math.floor(min/colorMaxAcceptableTime*(colorBaseGradientColor+colorMaxGradientColor)))+", 100%, 50%, 0.75)";
        }
        return colorCache[min];
    };
    
    that.getTimeForStationId = function(stid){
        return stationMap[0][stid].minutes;
    };

    var drawMinuteCircle = function(ctx, pos, minutes, minuteValue, prefunc){
        var mins = Math.min((minuteValue - minutes),maxWalkTime);
        var radius = Math.max(mins * pixelPerMinute, 1);
        var nxy = mapnificent.getCanvasXY(pos);
        try {
            if(prefunc){
                prefunc(ctx, pos, minutes, minuteValue, mins, nxy, radius);
            }
           ctx.moveTo(nxy.x,nxy.y);
           ctx.arc(nxy.x,nxy.y,radius, 0, mapnificent.circleRadians, true);
            // ctx.fillRect(xy.x-radius, xy.y-radius, radius*2, radius*2);
            // ctx.font = "8pt Arial";
            // ctx.fillText(""+parseInt(minutes), nxy.x,nxy.y);
            // ctx.textAlign = "center";
        }catch(e){
            console.log(e);
            console.log(pos.lat, pos.lng);
            console.log(nxy.x, nxy.y);
            console.log(radius);
            console.log(mapnificent.circleRadians);
        }
    };
    
    
    var addMinuteGradient = function(ctx, pos, minutes, minuteValue, mins, nxy, radius){
        var grad = ctx.createRadialGradient(nxy.x,nxy.y,0,nxy.x,nxy.y,radius);  
        grad.addColorStop(0, getColorFor(minutes));
        grad.addColorStop(0.5, getColorFor(Math.floor(minutes + (mins/2))));
        grad.addColorStop(1, getColorFor(minutes+mins));
        ctx.fillStyle = grad;
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
    
    var redrawTransparent = function(ctx){
        if(!intersection){
           fillGreyArea(ctx);
           ctx.globalCompositeOperation = "destination-out";
        } else {
            ctx.globalCompositeOperation = "source-over";
        }
        var count = 0;
        ctx.fillStyle = "rgba(75,75,75,0.8)";
        for(var index in startPositions){
            if (!startPositions[index].ready){continue;}
            if(count == 1 && intersection){
                ctx.globalCompositeOperation = "destination-in";
            }
            ctx.beginPath();
            drawMinuteCircle(ctx, startPositions[index].latlng, 0, startPositions[index].minutes);
            if(!jQuery.browser.opera && !intersection){
                ctx.fill();
            }
            for (var i=0; i<stationList.length;i++){
                var stationId = stationList[i];
                var station = stations[stationId];
                if (typeof station.pos !== "object" || station.pos === null){continue;}
                if (typeof stationMap[index][stationId] === "undefined"){continue;}
                if (stationMap[index][stationId].minutes > startPositions[index].minutes){continue;}
                if(!jQuery.browser.opera  && !intersection){
                    ctx.beginPath();
                }
                drawMinuteCircle(ctx, station.pos, stationMap[index][stationId].minutes, startPositions[index].minutes);
                if(!jQuery.browser.opera && !intersection){
                     ctx.fill();
                }
            }
            if(jQuery.browser.opera || intersection){
               ctx.fill();
            }
            count += 1;
        }
        if(intersection){
            fillGreyArea(ctx);
        }
    };
    
    var getStationMinuteList = function(){
        var sml = [];
        for (var i=0; i<stationList.length;i++){
            var smallesIndex = null, smallestMinute = Infinity;
            for(var index in startPositions){
                if(typeof(stationMap[index][stationList[i]]) !== "undefined" &&
                        stationMap[index][stationList[i]].minutes < smallestMinute){
                    smallestMinute = stationMap[index][stationList[i]].minutes;
                    smallestIndex = index;
                }
            }
            sml.push([smallestIndex, smallestMinute, stationList[i]]);
        }
        return sml;
    };
    
    var sortByMinutes = function(){
        minuteSorted = getStationMinuteList();
        minuteSorted.sort(function(a,b){
            return ((a[1] < b[1]) ? -1 : ((a[1] > b[1]) ? 1 : 0));
        });
    };
    
    var redrawColored = function(ctx){
        if(minuteSorted == false){
            sortByMinutes();
        }
        for(var i=(minuteSorted.length-1); i>=0;i--){
            var stationId = minuteSorted[i][2];
            var index = minuteSorted[i][0];
            var station = stations[stationId];
            if (typeof station.pos !== "object" || station.pos === null){continue;}
            if (typeof stationMap[index][stationId] === "undefined"){continue;}
            if (stationMap[index][stationId].minutes > startPositions[index].minutes){continue;}
            ctx.beginPath();
            drawMinuteCircle(ctx, station.pos, stationMap[index][stationId].minutes, startPositions[index].minutes, addMinuteGradient);
            ctx.fill();
        }
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(255,255,255,1)";
        var xy = mapnificent.getCanvasXY(mapnificent.env.northwest);
        ctx.fillRect(xy.x,xy.y,mapnificent.env.map_width,mapnificent.env.map_height);
        ctx.restore();
    };
    
    that.redraw = function(ctx){
        pixelPerMinute = (1/minutesPerKm) * mapnificent.env.pixelPerKm;
        ctx.save();
        if (colored){
            redrawColored(ctx);
        } else {
            redrawTransparent(ctx);
        }
        ctx.restore();
    };
    
    return that;
}(mapnificent));