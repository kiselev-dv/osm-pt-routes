function Route(relation, data) {
    this.relation = relation;
    this.data = data;
    this.name = relation.tags.name;
    this.ref = relation.tags.ref;

    this.wayMembers = [];
    var self = this;
    $.each(relation.members, function(i, ref) {
        if(ref.type == 'way' && ref.role != 'platform') {
            var w = self.data.ways[ref.ref];
            if (w) {
                self.wayMembers.push(w);
            }
        }
    });
}

Route.prototype.listSegments = function() {
    var segments = [];
    segments.push(new Segment());
    for(var i = 0; i < this.wayMembers.length; i++) {
        var way = this.wayMembers[i];
        var lastSegment = segments[segments.length - 1];
        if(!lastSegment.addWay(way)) {
            lastSegment = new Segment();
            lastSegment.addWay(way);
            segments.push(lastSegment);
        }
    }
    segments[0].first = true;
    segments[segments.length - 1].last = true;
    return segments;
};

Route.prototype.listStops = function() {
    var stopRoles = ['stop', 'stop_exit_only', 'stop_entry_only'];
    var platformRoles = ['platform', 'platform_exit_only', 'platform_entry_only'];

    var self = this;
    var stops = [];
    var index = 1;

    $.each(this.relation.members, function(i, ref) {
        if(stopRoles.indexOf(ref.role) >= 0 
           || platformRoles.indexOf(ref.role) >= 0
           || ref.type === 'node') {
            var node = self.data.nodes[ref.ref];
            var way = self.data.ways[ref.ref];
            var rowId = (node ? 'n' : 'w') + (node || way).id;
            if (node || way) {
                stops.push({
                    num: index++,
                    way: way,
                    node: node,
                    rowId: rowId,
                    subj: (node || way),
                    tags: (node || way).tags,
                    role: ref.role,
                    ref: (node || way).tags.ref,
                    name: (node || way).tags.name
                });
            }
        }
    });

    return stops;
};

function Joint(node, wayA, wayB) {
    this.node = node;

    this.wayA = wayA;
    this.wayB = wayB;
    this.wayNodeIndexA = wayA.nodes.indexOf(node);
    this.wayNodeIndexB = wayB.nodes.indexOf(node);
}

Joint.joinWays = function(wayA, wayB) {

    if(wayA.nodes[0] === wayB.nodes[0]) {
        return new Joint(wayA.nodes[0], wayA, wayB);
    }
    if(wayA.nodes[0] === wayB.nodes[wayB.nodes.length - 1]) {
        return new Joint(wayA.nodes[0], wayA, wayB);
    }
    if(wayA.nodes[wayA.nodes.length - 1] === wayB.nodes[0]) {
        return new Joint(wayB.nodes[0], wayA, wayB);
    }
    if(wayA.nodes[wayA.nodes.length - 1] === wayB.nodes[wayB.nodes.length - 1]) {
        return new Joint(wayA.nodes[wayA.nodes.length - 1], wayA, wayB);
    }

    // Slow
    var nodeMapA = Joint.mapWayNodes(wayA);
    var nodeMapB = Joint.mapWayNodes(wayB);

    var result = null;
    $.each(nodeMapA, function(nodeId, indexA) {
        if(nodeMapB[nodeId] !== undefined) {
            result = new Joint(nodeId, wayA, wayB);
            return false;
        }
    });

    return result;
}

Joint.mapWayNodes = function(way) {
    var result = {};
    way.nodes.forEach(function(node, index) {
        result[node] = index;
    });
    return result;
};

Joint.prototype.getOpenEndA = function() {
    if (this.wayNodeIndexA === 0) {
        return this.wayA.nodes[this.wayA.nodes.length - 1];
    }
    if (this.wayNodeIndexA > 0) {
        return this.wayA.nodes[0];
    }
};

Joint.prototype.getOpenEndB = function() {
    if (this.wayNodeIndexB === 0) {
        return this.wayB.nodes[this.wayB.nodes.length - 1];
    }
    if (this.wayNodeIndexB > 0) {
        return this.wayB.nodes[0];
    }
};

function Segment() {
    this.nodeA = null;
    this.nodeZ = null;
    this.ways = [];
    this.joints = [];
}

Segment.prototype.addWay = function(way) {
    if (this.ways.length == 0) {
        this.ways.push(way);
        this.nodeA = way.nodes[0];
        this.nodeZ = way.nodes[way.nodes.length - 1];
        return true;
    }
    if (this.ways.length == 1) {
        var join = Joint.joinWays(this.ways[0], way);
        if (join) {
            this.nodeA = join.getOpenEndA();
            this.nodeZ = join.getOpenEndB();
            this.ways.push(way);
            this.joints.push(join);
            return true;
        }
    }
    if (this.ways.length > 1) {
        var prevWay = this.ways[this.ways.length - 1];
        var join = Joint.joinWays(prevWay, way);
        if (join) {
            // prevWay.nodes.indexOf(join.getOpenEndA()); 
            this.nodeZ = join.getOpenEndB();
            this.ways.push(way);
            this.joints.push(join);
            return true;
        }
    }
}
