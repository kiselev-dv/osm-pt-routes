osmpt.service('osmpt-overpass', ['$http', function($http) {
    var baseURL = 'https://overpass-api.de/api/interpreter';
    var dataURL = baseURL + '?data=';
    var outJSONPrefix = '[out:json];';
    var metaQTSuffix = 'out meta qt;';

    var data = {
        nodes: {},
        ways: {},
        relations: {}
    };

    var stopTiles = {
    };
    this.updateStops = function(bbox) {
        var promises = [];
        var tiles = tileBBOX(bbox, 10);
        for(var i = 0; i < tiles.length; i++) {
            if(!stopTiles[tiles[i].key]) {
                stopTiles[tiles[i].key] = tiles[i].coords;
                let bboxS = '' + bbox[1] + ', ' + bbox[0] + ', ' + bbox[3] + ', ' + bbox[2];
                let STOPS_QUERY = '(node["highway"="bus_stop"]('+bboxS+');' +
                                  ' node["public_transport"="platform"]('+bboxS+');' +
                                  ' way["public_transport"="platform"]('+bboxS+'););';
                promises.push(this.getQuery(STOPS_QUERY).then(applyData.bind(this, [bbox])));
            }
        }
        if (promises.length > 0) {
            return Promise.all(promises);
        }
        return null;
    };

    this.updateRoutes = function(bbox) {
        let bboxS = '' + bbox[1] + ', ' + bbox[0] + ', ' + bbox[3] + ', ' + bbox[2];
        let ROUTES_QUERRY = 'rel[type=route][route=bus](' + bboxS + '); >>;';
        return this.getQuery(ROUTES_QUERRY).then(applyData.bind(this, [bbox]));
    };

    this.getQuery = function(query) {
        let url = dataURL + 
            encodeURIComponent(outJSONPrefix + query) +
            metaQTSuffix;

        return $http.get(url);
    };

    this.readData = function(transaction) {
        transaction(data);
    };

    this.updateData = function(transaction) {
        transaction(data);
    };

    function applyData(bbox, response) {
        var elements = response.data.elements;
        mergeData(buildWays(byTypes(elements)));
    };

    function merge(olds, news) {
        $.each(news, function(k, v) {
            if(olds[k] === undefined) {
                olds[k] = v;
            }
            else if(news[k].version > olds[k].version) {
                if (olds[k].modified) {
                    that.data.conflicts = true;
                    olds[k].conflict = true;
                    olds[k].server = v;
                }
                else {
                    olds[k].version = news[k].version;
                }
            }
        });
    }

    function mergeData(newData) {
        merge(data.nodes, newData.nodes);
        merge(data.ways, newData.ways);
        merge(data.relations, newData.relations);
    };

    function buildWays(typed) {
        $.each(typed.ways, function(i, way) {
            if (!way.geometry) {
                way.geometry = {
                    type: 'LineString',
                    coordinates: []
                };
                var bbox = [];
                way.nodes.forEach(function(nref) {
                    var n = typed.nodes[nref];
                    way.geometry.coordinates.push([n.lon, n.lat]);
                    bbox = mergeBBOX(bbox, n.lon, n.lat);
                });
                way.closed = way.nodes[0] == way.nodes[way.nodes.length - 1];
                way.bbox = bbox;
            }
        });
        return typed;
    };

    function mergeBBOX(bbox, x, y) {
        bbox[0] = Math.min(isNaN(bbox[0]) ? Infinity : bbox[0], x);
        bbox[1] = Math.min(isNaN(bbox[1]) ? Infinity : bbox[1], y);

        bbox[2] = Math.max(isNaN(bbox[2]) ? -Infinity : bbox[2], x);
        bbox[3] = Math.max(isNaN(bbox[3]) ? -Infinity : bbox[3], y);

        return bbox;
    }

    function byTypes(elements) {
        var nodes = {};
        var ways = {};
        var relations = {};
        elements.forEach(function(element) {
            if (element.type == 'node') {
                nodes[element.id] = element;
            }
            if (element.type == 'way') {
                ways[element.id] = element;
            }
            if (element.type == 'relation') {
                relations[element.id] = element;
            }
        });

        return {
            nodes: nodes,
            ways: ways,
            relations: relations
        };
    };

    function tileBBOX(bbox, zoom) {
        var x1 = long2tile(bbox[0], zoom);
        var x2 = long2tile(bbox[2], zoom);
        var y1 = lat2tile(bbox[1], zoom);
        var y2 = lat2tile(bbox[3], zoom);

        var tiles = [];
        for(var x = Math.min(x1, x2) - 1; x < Math.max(x1, x2); x++) {
            for(var y = Math.min(y1, y2) - 1; y < Math.max(y1, y2); y++) {
                tiles.push([x, y, x + 1, y + 1]);
            }
        }

        return tiles.map(function(t) {
            return {
                key: t[0] + "_" + t[1] + "_" + zoom,
                coords:[
                    tile2long(t[0], zoom),
                    tile2lat(t[1], zoom),
                    tile2long(t[2], zoom),
                    tile2lat(t[3], zoom),
            ]};
        });
    }

    function long2tile(lon,zoom) { 
        return (Math.floor((lon+180)/360*Math.pow(2,zoom))); 
    }

    function lat2tile(lat,zoom) { 
        return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom))); 
    }

    function tile2long(x,z) {
        return (x/Math.pow(2,z)*360-180);
    }

    function tile2lat(y,z) {
        var n=Math.PI-2*Math.PI*y/Math.pow(2,z);
        return (180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n))));
    }

}]);




