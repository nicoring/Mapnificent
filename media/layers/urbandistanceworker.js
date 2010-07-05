var urbandistancePoster;
var urbandistanceWorker = (function(){
    
    var stationMap, stations, lines, count, index, estimatedMinuteLimit;

    var calculateTimes = function(stationId, minutes, line, stay){
        var i, nextMinutes, station;
        if (minutes > estimatedMinuteLimit){ return; }
        count += 1;
        if (count % 100000 == 0){
            urbandistancePoster({"status": "working", "at": count});
        }
        station = stations[stationId];
        if (line !== -1 && typeof(stationMap[stationId]) !== "undefined" && 
                stationMap[stationId].minutes <= minutes){
            /*  Same line look-ahead:
                I got here faster before, but maybe switching lines caused a delay for
                the next station on this line, so I'll be faster at the next station even
                though it took me longer to get to the current one. Let's check it out!
            */
            for(i=0;i<station.reachableStations.length;i++){
                if(station.reachableStations[i].line === line){
                    // a station on the same line
                    nextMinutes = minutes + station.reachableStations[i].minutes + stay;                    
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
        if(typeof(stationMap[stationId]) !== "undefined" && stationMap[stationId].minutes <= minutes){
            return;
        }
        stationMap[stationId] = {"minutes": minutes};
        for(i=0;i<station.reachableStations.length;i++){
            if (line === -1){
                // My first station! I don't have to wait!
                nextMinutes = minutes + station.reachableStations[i].minutes;
            } else if(station.reachableStations[i].line == line){
                // Same line! The current transport may pause here for some time
                nextMinutes = minutes + station.reachableStations[i].minutes + stay;
            } else {
                // Switch line! Guess the wait time for the next line
                nextMinutes = minutes + getWaitTime(stationId, line, station.reachableStations[i].stationId, 
                        station.reachableStations[i].line) + station.reachableStations[i].minutes;
            }
            calculateTimes(station.reachableStations[i].stationId, nextMinutes, 
                    station.reachableStations[i].line, station.reachableStations[i].stay);
        }
        // for(var i=0;station.blockIndizes.length;i++){
        //     
        // }
    };


    var getWaitTime = function(station1, line1, station2, line2){
        if(typeof lines[line2] !== "undefined" && !!lines[line2].interval){
            return Math.log(lines[line2].interval)/0.40546510810816438;
        }
        return 6; // Well, uhm, this is a fallback
    };
    
    return function(event){
        stationMap = {};
        count = 0;
        stations = event.data.stations;
        lines = event.data.lines;
        startPos = event.data.position;
        blockGrid = event.data.blockGrid;
        estimatedMinuteLimit = event.data.estimatedMinuteLimit;
        var fromStations = event.data.fromStations
            , distances = event.data.distances
            , maxWalkTime = event.data.maxWalkTime
            , minutesPerKm = event.data.minutesPerKm;

        for(var k=0;k<fromStations.length;k++){
            var stationId = fromStations[k];
            var minutes = distances[k] * minutesPerKm;
            if (minutes <= maxWalkTime){
                calculateTimes(stationId, minutes, -1, 0);
            }
        }
        urbandistancePoster({"status": "working", "at": count});
        urbandistancePoster({"status": "done", "stationMap": stationMap});
    };
}());

if(typeof(window) === "undefined"){
    onmessage = urbandistanceWorker;
    urbandistancePoster = postMessage;
} else {
    urbandistancePoster = WorkerFacade.add("media/layers/urbandistanceworker.js", urbandistanceWorker);
}