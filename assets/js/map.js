osmpt.service('osmpt-map', [function() {
    this.map = L.map('map');
    L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
        maxZoom: 18, 
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, \
        &copy; <a href="https://carto.com/attribution">CARTO</a>'
    }).addTo(this.map);
    
    var selected = null;
    var nodesOnMap = null;
    var polylines = [];

    var selectedOptions = {
        color: '#FF2B2B',
        fillColor: '#FF2B2B'
    };

    this.fitBounds = function(bbox) {
        this.map.fitBounds(this.asLLBounds(bbox));
    };

    this.asLLBounds = function(bbox) {
        var corner1 = L.latLng(bbox[1], bbox[0]),
        corner2 = L.latLng(bbox[3], bbox[2]);
        return L.latLngBounds(corner1, corner2);
    };

    this.getCurrentBBox = function() {
        var bbox = this.map.getBounds();
        return [bbox.getWest(), bbox.getSouth(), bbox.getEast(), bbox.getNorth()];
    };

    this.clearFocus = function() {
        if (selected) {
            selected.remove();
        }
        selected = null;
    };

    this.focusNode = function(node) {
        if (selected) {
            selected.remove();
        }
        selected = L.circleMarker({lon: node.lon, lat: node.lat}, selectedOptions);
        this.map.setView({lon: node.lon, lat: node.lat});
        selected.addTo(this.map);
    };

    this.focusWay = function(way) {
        if (selected) {
            selected.remove();
        }
        L.polyline(latlngs)
        selected = wayAsPolyline(way);
        this.map.setView({lon: node.lon, lat: node.lat});
        selected.addTo(this.map);
    };

    this.showWays = function(ways) {
        if (polylines) {
            polylines.forEach(function(pl) {
                pl.remove();
            });
            polylines = [];
        }
        var map = this.map;
        ways.forEach(function(w) {
            var latLngs = [];
            w.geometry.coordinates.forEach(function(c){
                latLngs.push([c[1], c[0]]);
            });
            var pl = L.polyline(latLngs);
            map.addLayer(pl);
            polylines.push(pl);
        });
    };

    var markerClickWaiters = [];
    this.showNodes = function(nodes) {
        if(nodesOnMap) {
            nodesOnMap.forEach(function(n) {n.remove();});
        }
        nodesOnMap = [];
        var map = this.map;
        nodes.forEach(function(node) {
            var n = L.circleMarker({lon: node.lon, lat: node.lat})
                .bindTooltip(node.title, {
                    permanent: true, 
                    direction: 'top'
            });
            n.addTo(map);
            n.options.node = node;
            n.on('click', function() {
                for(var i = 0; i < markerClickWaiters.length; i++) {
                    markerClickWaiters[i](this.options.node);
                }
                markerClickWaiters = [];
            });
            nodesOnMap.push(n);
        });
    };

    this.waitForStopClick = function(callback) {
        markerClickWaiters.push(callback);
    };

    this.subscribeMapMove = function(callback) {
        this.map.on('moveend', callback);
    };

    function wayAsPolyline(way, options) {
        var latLngs = [];
        way.geometry.coordinates.forEach(function(c){
            latLngs.push([c[1], c[0]]);
        });
        return L.polyline(latLngs, options);
    }

}]);