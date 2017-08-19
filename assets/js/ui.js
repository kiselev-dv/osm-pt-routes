var osmpt = angular.module("osmpt", ['ngHandsontable']);
osmpt.run(['osmpt-map', function(map) {
    map.fitBounds([-63.7475, 44.6583, -63.4780, 44.7722]);
}]);