osmpt.service('osmpt-gtfs', ['$http', function($http) {
    this.getTripStops = function(url, callback) {
        $('#cors-container').load(url);
        $http.get(url).then(function(response) {
            console.log(response.data);
        });
    }
}]);