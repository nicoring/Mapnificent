/* Currently: (c) Copyright 2010 Stefan Wehrmeyer. All Rights Reserved. 
    This will probably be published under a free license soon.
*/

MAPNIFICENT_LAYER.apartmentPrices = (function (mapnificent){
    var that = mapnificent.createLayer();
    that.tabid = "estate";
    that.idname = "apartmentPrices";
    var LOCK = false;
    var currentPrice = 10;
    var update = function(e, ui){
        if (LOCK){return;}
        LOCK = true;
        currentPrice = ui.value;
        mapnificent.trigger("redraw");
        LOCK = false;
    };
    that.getTitle = function(){
        return "Apartments";
    };
    that.appendControlHtmlTo = function(container){
        container.html(''+
            '<span style="padding:0 15px">Appartments at max. '+
            '<strong id="'+that.idname+'-value"></strong> Euro/m<sup>2</sup> - This layer currently sucks (are you a cool flat hunting portal? Contact me!)</span>'+
            '<div id="'+that.idname+'-slider" class="slider"></div>'+
            '');
        jQuery("#"+that.idname+'-slider').slider({ min: 0, max: 100, step: 1,
               slide: update,
               stop: update,
               value: currentPrice
            });
        jQuery("#"+that.idname+'-value').text(currentPrice);
    };
    that.activate = function(){
        jQuery("#"+that.idname+'-slider').slider("enable");
    };
    that.deactivate = function(){
        jQuery("#"+that.idname+'-slider').slider("disable");
    };
    
    that.getDrawingLevel = function(){
        return 1;
    };
    that.redraw = function(ctx){
        if(Math.ceil(currentPrice) == currentPrice){
            jQuery("#"+that.idname+'-value').text(currentPrice+".0");
        } else {
            jQuery("#"+that.idname+'-value').text(currentPrice);
        }
        ctx.save();
        if(!jQuery.browser.opera){
            ctx.globalCompositeOperation = "darker";
        } else {
            ctx.globalCompositeOperation = "source-over";
        }
        ctx.fillStyle = "rgba(0,0,128,0.4)";
        for (var ap in that.apartments){
            var apartment = that.apartments[ap];
            if (apartment.pricePerSqm > currentPrice){continue;}
            ctx.beginPath();
            try {
                var nxy = mapnificent.getCanvasXY({"lat": apartment.lat, "lng": apartment.lng});
                var radius = mapnificent.env.pixelPerKm*0.25;
                ctx.moveTo(nxy.x,nxy.y);
                ctx.arc(nxy.x,nxy.y,radius, 0, mapnificent.circleRadians, true);
            }catch(e){
//                console.log(e);
            }
            ctx.fill();
        }
        ctx.restore();
    };
    
    that.setup = function(dataobjs){
        /*
        {"M3455856": 
            {"pricePerSqm": 16.136363636363637, "price": 355.0, 
            "sqm": 22, "lat": 52.404953999999996, "lng": 13.408855000000001, 
            "id": "M3455856"}
        */
        that.apartments = dataobjs[0];
        that.apartmentList = [];
        for (var ap in that.apartments){
            that.apartmentList.push(that.apartments[ap]);
        }
    };
    return that;
}(mapnificent));