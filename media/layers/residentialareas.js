/* Currently: (c) Copyright 2010 Stefan Wehrmeyer. All Rights Reserved. 
    This will probably be published under a free license soon.
*/
/*
 13° 4'34.84"E   52°20'2.67"N   = 13.076344, 52.334075
 13°46'22.55"E   52°20'2.67"N
 13°46'22.55"E   52°40'30.86"N  =   13.439597,   52.675239
 13° 4'34.84"E   52°40'30.86"N
 */
MAPNIFICENT_LAYER.residentialAreas = (function (mapnificent){
    var that = mapnificent.createLayer();
    that.idname = "residentialAreas";
    that.tabid = "areaReputation";
    var LOCK = false,
        currentOpacity = 0.7,
        imageLoaded = false,
        img = new Image();
    img.onload = function(){
        imageLoaded = true;
        jQuery("#"+that.idname+'-loading').css("visibility", "hidden");
        mapnificent.trigger("redraw");
    };
    img.alt = "Wohnlagenkarte 2009";
    var update = function(e, ui){
        if (LOCK){return;}
        LOCK = true;
        currentOpacity = ui.value;
        mapnificent.trigger("redraw");
        LOCK = false;
    };
    
    that.getTitle = function(){
        return "Residential Areas";
    };
    that.appendControlHtmlTo = function(container){
        container.html(''+
         '<div style="float:right"><span style="color:#c00;visibility:hidden;" id="'+that.idname+'-loading">Loading...</span> <span style="padding:0 15px">Overlay of <a href="http://www.stadtentwicklung.berlin.de/wohnen/mietspiegel/de/wohnlagenkarte.shtml">Wohnlagenkarte Berlin 2009</a>'+
         ' - <span style="color:#9D2B2A">Good Residential Area</span>, <span style="color:#F09A4F">Normal Residential Area</span>, <span style="color:#FED963">Simple Residential Area</span></span></div>'+
         '<div>Slide to change transparency:</div>'+
         '<div id="'+that.idname+'-slider" class="slider"></div>'+
         '');
        jQuery("#"+that.idname+'-slider').slider({ min: 0, max: 1, step: 0.05,
            slide: update,
            stop: update,
            value: currentOpacity
         });
    };
    that.activate = function(){
        jQuery("#"+that.idname+'-slider').slider("enable");
        if (img.src === null || img.src === ""){
            jQuery("#"+that.idname+'-loading').css("visibility", "visible");
            img.src = 'http://mapnificent.stefanwehrmeyer.com/media/layers/wohnlagenkarte2009s.png';
        }
    };
    that.deactivate = function(){
        jQuery("#"+that.idname+'-slider').slider("disable");
    };
    that.getDrawingLevel = function(){
        return 3;
    };
    that.setup = function(objs){
        // Load here to avoid blocking
    };
    that.redraw = function(ctx){
        if (!imageLoaded){return;}
        var topleft = mapnificent.getCanvasXY({"lat": 52.674240, "lng": 13.077550});
        var bottomright = mapnificent.getCanvasXY({"lat": 52.334075, "lng": 13.768597});
        var w = bottomright.x - topleft.x;
        var h = bottomright.y - topleft.y;
        ctx.save();
//        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = currentOpacity;
        ctx.drawImage(img, topleft.x, topleft.y, w, h);
        ctx.restore();
    };
    return that;
}(mapnificent));