/* Currently: (c) Copyright 2010 Stefan Wehrmeyer. All Rights Reserved. 
    This will probably be published under a free license soon.
*/

MAPNIFICENT_LAYER.crimeZones = (function (mapnificent){
    var that = mapnificent.createLayer();
    that.idname = "crimeZones";
    that.tabid = "areaReputation";
    var LOCK = false,
    crimecategories = ["Gewalt", "Vandalismus", "Raub", "Diebstahl", "Brand", "Verkehr", "Sonstiges"],
    crimecategories_de = ["Violence", "Vandalism", "Robbery", "Burglary", "Fire", "Traffic", "Other"],
    showCategory =    [true,       true,        true,    true,        true,    true,       true],
    crimes;
    
    var update = function(e){
        if (LOCK){return;}
        LOCK = true;
        for(var i=0;i<crimecategories.length;i++){
            if(jQuery('#'+that.idname+'-show'+crimecategories[i]).is(":checked")){
                showCategory[i] = true;
            } else {showCategory[i] = false;}
        }
        mapnificent.trigger("redraw");
        LOCK = false;
    };

    that.getTitle = function(){
        return "Areas mentioned in Police News Feed";
    };
    that.appendControlHtmlTo = function(container){
        var html = "<div>", chk;
        for (var i=0;i<crimecategories.length;i++){
            if(showCategory[i]){
                chk =  ' checked="checked"';
            } else {chk = '';}
            html +='<span style="padding:0 15px"><input class="'+that.idname+'-checkbox" type="checkbox" id="'+that.idname+'-show'+crimecategories[i]+'"'+chk+'/>'+
                '<label for="'+that.idname+'-show'+crimecategories[i]+'">'+crimecategories_de[i]+'</label></span>';
        }
        html+="</div>";
        container.html(''+
            '<span style="padding:0 15px">Based on <a href="http://www.berlin.de/polizei/presse-fahndung/presse.html">Berlin/Brandenburg Police News</a> from 2009. Select crime categories: </span>'+
            html+
         '');
        jQuery("."+that.idname+'-checkbox').change(update);
    };
    that.getDrawingLevel = function(){
        return 10;
    };
    that.redraw = function(ctx){
        ctx.save();
        ctx.globalCompositeOperation = "darker";
        ctx.globalAlpha = 1;
        var radius = mapnificent.env.pixelPerKm*0.3;
        for(var i=0;i<crimecategories.length;i++){
            var category = crimecategories[i];
            if(!showCategory[i]){continue;}
            for(var j=0;j<crimes[category].length;j++){
                var crime = crimes[category][j];
                var xy = mapnificent.getCanvasXY(crime);
                var grad = ctx.createRadialGradient(xy.x,xy.y,radius/5,xy.x,xy.y,radius);  
                grad.addColorStop(0, 'rgba(255,0,0,0.2)');  
                grad.addColorStop(1, 'rgba(255,0,0,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(xy.x-radius, xy.y-radius, radius*2, radius*2);
            }
        }
        ctx.restore();
    };
    
    that.activate = function(){
        jQuery("."+that.idname+'-checkbox').removeAttr("disabled");
    };
    that.deactivate = function(){
        jQuery("."+that.idname+'-checkbox').attr("disabled", "disabled");
    };
    that.setup = function(dataobjs){
        crimes = dataobjs[0];
    };
    return that;
}(mapnificent));