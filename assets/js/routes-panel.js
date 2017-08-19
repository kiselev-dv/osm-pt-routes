osmpt.controller("RoutesPanelCtrl", [
    '$scope', 'osmpt-overpass', 'osmpt-map', 'osmpt-gtfs',
    function($scope, overpass, map, gtfs) {

        function updateScope(data) {
            var routes = [];
            
            $.each(data.relations, function(i, r) {
                var route = new Route(r, data);
                routes.push(route);
            });
            
            routes.sort(function(a, b) {
                var ref1 = a.relation.tags.ref || 'zzz_';
                var ref2 = b.relation.tags.ref || 'zzz_';
                return ref1.localeCompare(ref2);
            });
            
            $scope.routes = routes;
        }

        function applyStopsToScope(data) {
            var stops = [];
            function fillStops(i, e) {
                if (e && e.tags) {
                    if (e.tags['highway'] === 'bus_stop' || e.tags['public_transport'] === 'platform') {
                        stops.push(e);
                    }
                }
            }
            $.each(data.nodes, fillStops);
            $.each(data.ways, fillStops);

            $scope.stops = stops;
        }

        $scope.updateRoutes = function() {
            var bbox = map.getCurrentBBox();
            overpass.updateRoutes(bbox).then(function(){
                overpass.readData(updateScope);
            });
        };

        $scope.updateStops = function() {
            var bbox = map.getCurrentBBox();
            var promise = overpass.updateStops(bbox);
            if (promise) {
                promise.then(function() {
                    overpass.readData(applyStopsToScope);
                });
            }
        };
        map.subscribeMapMove(function() {
            $scope.$apply($scope.updateStops);
        });
        $scope.updateStops();

        $scope.listRouteSegments = function(route) {
            if (route.segments) {
                return route.segments;
            }
            var segments = route.listSegments();
            route.segments = segments;
            return route.segments;
        };

        $scope.listSegmentWays = function(segment) {
            if (segment.wayWrappers) {
                return segment.wayWrappers;
            }
            var prevStreet = null;
            var result = [];
            segment.ways.forEach(function(way) {
                var wraper = {
                    way: way,
                    wayid: way.id,
                    title: getWayTitle(way),
                    hwtype: way.tags.highway
                };
                result.push(wraper);
                wraper.sibling = (getWayTitle(way) === prevStreet);
                prevStreet = getWayTitle(way);
            });
            segment.wayWrappers = result;
            return segment.wayWrappers;
        };

        $scope.listStops = function(route) {
            if (!route.stops) {
                var stops = route.listStops();
                route.stops = stops;
            }
            return route.stops;
        };

        $scope.getStopName = function(stop) {
            return getWayTitle(stop.node || stop.way)
        };

        $scope.focusOnRoute = function(route) {
            $scope.selectedRoute = route;
            showStops(route.stops);
            showRoute(route.wayMembers);
        }

        function showRoute(ways) {
            map.showWays(ways);
        }

        function showStops(stops, showIndexes) {
            var i = 1;
            var routeStopNodes = stops.map(function(s) {
                var node = s.node || s;
                var title = '';
                if (showIndexes === undefined || showIndexes) {
                    title += '<span style="font-weight: bold;">' + i++ + '</span>';
                }
                if (node.tags.name) {
                    title += " " + node.tags.name;
                }
                if (node.tags.ref) {
                    title += " (" + node.tags.ref + ")";
                }
                return {
                    lat:   node.lat,
                    lon:   node.lon,
                    title: title,
                    id:    node.id,
                    ref:   node.tags.ref,
                    name:  node.tags.name
                };
            });
            map.showNodes(routeStopNodes);
        }

        $scope.parseStops = function(text) {
            var stops = [];
            var index = 1;
            text.split('\n').forEach(function(line) {
                var name = /(?:[\s]*[0-9:]+\s*[AMP]+\s+)(.*)/.exec(line)[1];
                var ref = /.*\((.*)\)/.exec(name)[1];
                stops.push({
                    num: index++,
                    name: name,
                    ref: ref
                });
            });
            return stops;
        };

        $scope.rowSelected = function(r, c, r2, c2) {
            var rowData = this.getDataAtRow(r);
            if (rowData && rowData[0]) {
                var stopData = $scope.selectedRoute.stops.find(function(s){
                    return s.rowId === rowData[0];
                });
                if (stopData.node) {
                    map.focusNode(stopData.node);
                }
                if (stopData.way) {
                    map.focusWay(stopData.way);
                }
            }
        };

        $scope.rowMoved = function() {
            // We are in a context of handsontable callback
            // so this is table itself
            updateStopsTable(this);
        }

        $scope.rowRemoved = function() {
            updateStopsTable(this);
            map.clearFocus();
        };

        $scope.afterTableInit = function() {
            $scope.tableInstance = this;
        };

        $scope.platformRenderer = function (instance, td, row, col, prop, value, cellProperties) {
            var $button = $('<button class="stop-source-button">');
            if (value) {
                $button.html("Change");
            }
            else {
                $button.html("Connect");
            }

            $button.click(function() {
                var $b = $(this);
                $b.html('...');

                // Hide route, and show all stops
                showStops($scope.stops, false);

                map.waitForStopClick(function(target) {
                    $scope.$apply(function() {
                        // Looking for row number
                        $td = $b.parent('td');
                        var ri = $td.parent().index();
                        instance.setDataAtCell(ri, 0, 'n' + target.id);
                        instance.setDataAtCell(ri, 1, 'platform');
                        instance.setDataAtCell(ri, 2, target.ref);
                        instance.setDataAtCell(ri, 3, target.name);

                        overpass.readData(function(data) {
                            var rowId = 'n' + target.id;
                            var node = data.nodes[target.id];
                            for (var si = 0; si < $scope.selectedRoute.stops.length; si++) {
                                if ($scope.selectedRoute.stops[si].rowId === rowId) {
                                    $scope.selectedRoute.stops[si].num = si + 1;
                                    $scope.selectedRoute.stops[si].node = node;
                                    $scope.selectedRoute.stops[si].subj = node;
                                    $scope.selectedRoute.stops[si].node.tags = node.tags;
                                    // In theory, it's possible to have one stop twice
                                    // I'm not sure should I treat that situation as err
                                    // or not.
                                    // break;
                                }
                            }
                        });
                        updateStopsTable(instance);
                    });
                });
            });

            $(td).empty().append($button);
        };

        function getChanges() {
            var table = $scope.tableInstance;
            
        }

        function updateStopsTable(table) {
            var rc = table.countRows();
            var stops = [];
            for (var i = 0; i < rc; i++) {
                var rowId = table.getDataAtRow(i)[0];
                var stop = null;
                for (var si = 0; si < $scope.selectedRoute.stops.length; si++) {
                    if ($scope.selectedRoute.stops[si].rowId === rowId && $scope.selectedRoute.stops[si].node.id) {
                        stop = $scope.selectedRoute.stops[si];
                        break;
                    }
                }
                if (stop) {
                    stops.push(stop);
                }
            }
            showStops(stops);
        }

        function getWayTitle(way) {
            if (way.tags.name) {
                return way.tags.name;
            }
            if (way.tags.ref) {
                return way.tags.ref;
            }
            return '_';
        };

}]);
