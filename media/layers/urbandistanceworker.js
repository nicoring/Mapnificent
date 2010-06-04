var calculate = (function(){
    
    var stationMap, stations, lines, count, index;

    var calculateTimes = function(stationId, minutes, line, stay){
        count += 1;
        if (count % 100000 == 0){
            postMessage({"status": "working", "at": count, "index": index});
        }
        var station = stations[stationId];
        if (line != null && typeof(stationMap[stationId]) !== "undefined" && 
                stationMap[stationId].minutes <= minutes){
            /*  Same line look-ahead:
                I got here faster before, but maybe switching lines caused a delay for
                the next station on this line, so I'll be faster at the next station even
                though it took me longer to get to the current one. Let's check it out!
            */
            for(var i=0;i<station.reachableStations.length;i++){
                if(station.reachableStations[i].line == line){
                    // a station on the same line
                    var nextMinutes = minutes + station.reachableStations[i].minutes + stay;
                    if (typeof(stationMap[station.reachableStations[i].stationId]) === "undefined" ||
                            stationMap[station.reachableStations[i].stationId].minutes > nextMinutes){
                        // Yeah, I can get to the next station on this line faster than before, let's go there!
                        calculateTimes(station.reachableStations[i].stationId, nextMinutes, 
                                station.reachableStations[i].line, station.reachableStations[i]["stay"]);
                    }
                }
            }
            return;
        }
        stationMap[stationId] = {"minutes": minutes};
        for(var i=0;i<station.reachableStations.length;i++){
            if (line == null){
                // My first station! I don't have to wait!
                var nextMinutes = minutes + station.reachableStations[i].minutes;
            } else if(station.reachableStations[i].line == line){
                // Same line! The current transport may pause here for some time
                var nextMinutes = minutes + station.reachableStations[i].minutes + stay;
            } else {
                // Switch line! Guess the wait time for the next line
                var nextMinutes = minutes + getWaitTime(stationId, line, station.reachableStations[i].stationId, 
                        station.reachableStations[i].line) + station.reachableStations[i].minutes;
            }
            calculateTimes(station.reachableStations[i].stationId, nextMinutes, 
                    station.reachableStations[i].line, station.reachableStations[i]["stay"]);
        }
        return true;
    };


    var getWaitTime = function(station1, line1, station2, line2){
        if(typeof lines[line2] !== "undefined"){
            return lines[line2].interval/2;
        }
        return 6; // Well, uhm, this is a fallback
    };
    
    return function(event){
        stationMap = {};
        count = 0;
        stations = event.data.stations;
        lines = event.data.lines;
        startPos = event.data.position;
        index = event.data.index;
        var fromStations = event.data.fromStations
            , distances = event.data.distances
            , maxWalkTime = event.data.maxWalkTime
            , minutesPerKm = event.data.minutesPerKm;

        for(var k=0;k<fromStations.length;k++){
            var stationId = fromStations[k];
            var minutes = distances[k] * minutesPerKm;
            if (minutes <= maxWalkTime){
                calculateTimes(stationId, minutes, null);
            }
        }
        postMessage({"status": "working", "at": count, "index": index});
        postMessage({"status": "done", "stationMap": stationMap, "index": index});
    };
}());

if(typeof(MAPNIFICENT_LAYER)  !== "undefined" && typeof(MAPNIFICENT_LAYER.urbanDistance) !== "undefined"){
    MAPNIFICENT_LAYER.urbanDistance.calculate = calculate;
} else {
    onmessage = calculate;
}