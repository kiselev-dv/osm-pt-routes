osmpt.service('osmpt-changes', [function() {
    this.getChanges = function(route, table) {
        var modify = {
            nodes: [],
            ways: [],
            relations: []
        };

        var members = [];
        
        var rc = table.countRows();
        for (var i = 0; i < rc; i++) {
            var row = table.getDataAtRow(i);
            var rowId = row[0];
            var stop = null;
            for (var si = 0; si < route.stops.length; si++) {
                if (route.stops[si].rowId === rowId && route.stops[si].node.id) {
                    stop = route.stops[si];
                    break;
                }
            }
            if (stop) {
                members.push({
                    type: stop.node ? 'node' : 'way',
                    role: 'platform',
                    ref: (stop.node || stop.way).id
                });
                var ref = row[2];
                var name = row[3];
                var tags = (stop.node || stop.way).tags;
                if (tags.ref != ref || tags.name != name) {
                    var changed = $.extend(true, {}, (stop.node || stop.way));
                    changed.tags.name = name;
                    changed.tags.ref = ref;
                    (stop.node ? modify.nodes : modify.ways).push(changed);
                }
            }
        }

        route.wayMembers.forEach(function(w) {
            members.push({
                type: 'way',
                role: '',
                ref: w.id
            });
        });

        var lengthDiffers = route.relation.members.length !== members.length;
        var orderDiffers = false;
        if (!lengthDiffers) {
            for (var i = 0; i < members.length; i++) {
                var newMember = members[i];
                var oldMember = route.relation.members[i];
                var orderDiffers = newMember.type !== oldMember.type 
                    || oldMember.ref !== newMember.ref 
                    || oldMember.role !== newMember.role;
                if (orderDiffers) {
                    break;
                }
            }
        }
        if(orderDiffers || lengthDiffers) {
            var rel = $.extend(true, {}, route.relation);
            rel.members = members;
            modify.relations.push(rel);
        }

        return modify;
    };

    function createElement(cahngesetId, name, elem, doc, parent) {
        var nodexml = doc.createElement('node');
        nodexml.setAttribute('id', elem.id);
        nodexml.setAttribute('version', elem.version);
        nodexml.setAttribute('changeset', cahngesetId);

        parent.appendChild(nodexml);

        return nodexml;
    }

    function writeTags(parentxml, doc, elem) {
        $.each(function(k, v) {
            var tagxml = doc.createElement('tag');
            tagxml.setAttribute('k', k);
            tagxml.setAttribute('v', v);
            parentxml.appendChild(tagxml);
        });
    }

    function writeWayNodes(wayxml, doc, way) {
        way.nodes.forEach(function(n) {
            var nd = doc.createElement('nd');
            nd.setAttribute('ref', n);
            wayxml.appendChild(nd);
        });
    }

    function writeRelMemmbers(relxml, doc, relation) {
        relation.members.forEach(function(m) {
            var member = doc.createElement('member');
            member.setAttribute('ref', m.ref);
            member.setAttribute('role', m.role || '');
            member.setAttribute('type', m.type);
            relxml.appendChild(member);
        });
    }

    this.asChangesetXML = function(changes, cahngesetId) {
        var doc = document.implementation.createDocument(null, "changeset", null);
        var changeset = doc.documentElement;
        changeset.setAttribute('version', '0.6');
        changeset.setAttribute('generator', 'osm-pt-routes editor');

        var modify = doc.createElement('modify');
        changeset.appendChild(modify);

        changes.nodes.forEach(function(node) {
            var nodexml = createElement(cahngesetId, 'node', node, doc, modify);
            nodexml.setAttribute('lat', node.lat);
            nodexml.setAttribute('lon', node.lon);
            writeTags(nodexml, doc, node);
        });

        changes.ways.forEach(function(way) {
            var wayxml = createElement(cahngesetId, 'way', way, doc, modify);
            writeWayNodes(wayxml, doc, way);
            writeTags(wayxml, doc, way);
        });

        changes.relations.forEach(function(relation) {
            var relxml = createElement(cahngesetId, 'relation', relation, doc, modify);
            writeRelMemmbers(relxml, doc, relation);
            writeTags(relxml, doc, relation);
        });
        return new XMLSerializer().serializeToString(doc.documentElement);
    }

}]);