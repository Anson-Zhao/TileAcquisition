$(function () {

    Number.prototype.pad = function (size) {
        var s = String(this);
        while (s.length < (size || 2)) {
            s = "0" + s;
        }
        return s;
    }

    //Variables
    var worldBounds = [-180, -90.0, 180, 90.0];
    var maxDownload = 100;
    var currentFeature;
    var displayGridFirstTime = false;
    var isGridShown = false;
    var isSeaShown = false;
    var isSeaLoaded = false;
    var overWarning = false;
    $('#mouse').text("-");
    $('#download_counts').text("0");

    //Source
    var drawLine = new ol.source.Vector({});
    var gridLine = new ol.source.Vector({});
    var highlightLine = new ol.source.Vector({});
    var seaLine = new ol.source.Vector({});
    var selectionLine = new ol.source.Vector({});

    //Layers
    var tileLayer = new ol.layer.Tile({
        source: new ol.source.OSM({
            wrapX: false,
            noWrap: true,
//            url: "https://192.168.25.116/php/grs_osm_gw.php?URL=https://grsosm.grias.jp/osm_tiles/{z}/{x}/{y}.png"
//            url: "https://gdem.jspacesystems.or.jp/php/grs_osm_gw.php?URL=https://grsosm.grias.jp/osm_tiles/{z}/{x}/{y}.png"
        })
    });

    var drawLayer = new ol.layer.Vector({
        source: drawLine
    });
    var gridLineLayer = new ol.layer.Vector({
        source: gridLine,
        extent: ol.proj.transformExtent(worldBounds, 'EPSG:4326', 'EPSG:3857'),
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#aaaaaa',
                width: 1
            })
        })
    });
    gridLineLayer.set('name', 'gridLine');

    var highlightLineLayer = new ol.layer.Vector({
        source: highlightLine,
        wrapX: false,
        noWrap: true,
        extent: ol.proj.transformExtent(worldBounds, 'EPSG:4326', 'EPSG:3857'),
        style: new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(255, 240, 149, 0.3)'
            }),
            stroke: new ol.style.Stroke({
                color: 'rgba(255, 255, 255, 0.0)',
                width: 1
            })
        })
    });
    highlightLineLayer.set('name', 'highlight');

    var seaLineLayer = new ol.layer.Vector({
        source: seaLine,
        wrapX: false,
        noWrap: true,
        extent: ol.proj.transformExtent(worldBounds, 'EPSG:4326', 'EPSG:3857'),
        style: new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(100, 100, 100, 0.1)'
            }),
            stroke: new ol.style.Stroke({
                color: 'rgba(255, 255, 255, 0.0)',
                width: 1
            })
        })
    });
    seaLineLayer.set('name', 'sea');

    var selectionStyle = new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(255, 255, 255, 0.2)'
        }),
        stroke: new ol.style.Stroke({
            color: 'rgba(26, 155, 252, 1)',
            width: 2
        })
    })

    var selectionLayer = new ol.layer.Vector({
        source: selectionLine,
        wrapX: true,
        extent: ol.proj.transformExtent(worldBounds, 'EPSG:4326', 'EPSG:3857'),
        style: selectionStyle
    });

    //Interaction
    var draw = new ol.interaction.DragBox({
        source: drawLine,
        condition: ol.events.condition.altKeyonly,
        style: new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(255, 255, 255, 0.5)'
            }),
            stroke: new ol.style.Stroke({
                color: 'rgba(26, 155, 252, 1)',
                width: 2
            })
        })
    });

    var select = new ol.interaction.Select({
        filter: function (feature, layer) {
            if (feature.get('name') == 'selection') {
                return true;
            }
            return false;
        },
        style: function (feature, resolution) {
            return selectionStyle;
        }
    });

    var translate = new ol.interaction.Translate({
        features: select.getFeatures()
    });

    var map = new ol.Map({
        interactions: ol.interaction.defaults().extend([select, translate]),
        layers: [tileLayer, seaLineLayer, highlightLineLayer, gridLineLayer, drawLayer, selectionLayer], //layer in orders
        target: 'map',
        view: new ol.View({
            center: ol.proj.transform([139.6917, 35.6895], 'EPSG:4326', 'EPSG:3857'), //tokyo
            zoom: 6,
            minZoom: 3,
            maxZoom: 9,
            extent: ol.proj.transformExtent(worldBounds, 'EPSG:4326', 'EPSG:3857')
        })
    });

    //Events
    map.on('pointermove', function (event) {
        if (event.dragging) {
            return;
        }
        var coord = ol.proj.transform(event.coordinate, 'EPSG:3857', 'EPSG:4326');
        $('#mouse').text(formatLat(Math.floor(coord[1])) + formatLong(Math.floor(coord[0])));
    });
    translate.on('translateend', function () {
        showHighlight();
    });

    draw.on('boxend', function (event) {
        selectionLine.clear();
        map.removeInteraction(draw);
        currentFeature = new ol.Feature({
            geometry: new ol.geom.Polygon(draw.getGeometry().getCoordinates())
        });
        currentFeature.set('name', 'selection');
        selectionLine.addFeature(currentFeature);

        select.getFeatures().clear();
        select.getFeatures().push(currentFeature);
        showHighlight();
    });

    //Functions
    function showHighlight() {
        highlightLine.clear();

        var coord = currentFeature.getGeometry().getCoordinates();

        var coord2 = parseIntCoord(ol.proj.transform(coord[0][2], 'EPSG:3857', 'EPSG:4326'), true, false);
        var coord4 = parseIntCoord(ol.proj.transform(coord[0][4], 'EPSG:3857', 'EPSG:4326'), false, true);

        //area under polygon mochi
        var w1 = coord4[0];
        var w2 = coord2[0];
        var h1 = coord4[1];
        var h2 = coord2[1];

        var width = (w1 > 0 && w2 < 0 || w2 > 0 && w1 < 0) ? Math.abs(Math.abs(w1) + Math.abs(w2)) : Math.abs(Math.abs(w1) - Math.abs(w2));
        var height = (h1 > 0 && h2 < 0 || h2 > 0 && h1 < 0) ? Math.abs(Math.abs(h1) + Math.abs(h2)) : Math.abs(Math.abs(h1) - Math.abs(h2));

        var lw = (w1 > w2) ? w2 : w1;
        var lh = (h1 > h2) ? h2 : h1;

        var result = [];
        for (var i = 0; i < width; i++) {
            for (var j = 0; j < height; j++) {
                result.push([lw + i, lh + j]);
            }
        }

        $('#download_list').html("");
        var download_counts = 0;
        for (var i = 0; i < result.length; i++) {
            var lng = result[i][0];
            var lat = result[i][1];

            var lngText = formatLong(lng);
            var latText = formatLat(lat);

            if (validTiles.indexOf(latText + lngText) !== -1) {
                if (download_counts > maxDownload) {
                    if (overWarning == false) {
                        alert("Please select " + maxDownload + " tiles or less for each download.");
                        overWarning = true;
                    }
                    resizeFeature(1 / 1.5);
                    return;
                }
                overWarning = false;
                addHighlightPolygon([lng, lat]);
                $('#download_list').append("<li onclick=\"downloadTile('Download_" + latText + lngText + ".zip')\">Download_" + latText + lngText + "<span class='download_btn'></span></li>");
                download_counts++;
            }
        }
        $('#download_counts').text(download_counts);

        function parseIntCoord(coord, first, second) {
            coord[0] = first == true ? parseInt(Math.ceil(coord[0])) : parseInt(Math.floor(coord[0]));
            coord[1] = second == true ? parseInt(Math.ceil(coord[1])) : parseInt(Math.floor(coord[1]));
            return coord;
        }

        function addHighlightPolygon(startPoint, which) {

            var nw = ol.proj.transform([startPoint[0], startPoint[1]], 'EPSG:4326', 'EPSG:3857');
            var ne = ol.proj.transform([startPoint[0] + 1, startPoint[1]], 'EPSG:4326', 'EPSG:3857');
            var se = ol.proj.transform([startPoint[0] + 1, startPoint[1] + 1], 'EPSG:4326', 'EPSG:3857');
            var sw = ol.proj.transform([startPoint[0], startPoint[1] + 1], 'EPSG:4326', 'EPSG:3857');

            var feature = new ol.Feature({
                geometry: new ol.geom.Polygon([
                    [nw, ne, se, sw, nw]
                ])
            });
            highlightLine.addFeature(feature);
        }
    }

    function formatLong(lng) {
        return lng < 0 ? "W" + (lng * -1).pad(3) : "E" + lng.pad(3);
    }

    function formatLat(lat) {
        return lat < 0 ? "S" + (lat * -1).pad(2) : "N" + lat.pad(2);
    }

    function drawSea() {
        seaLineLayer.setVisible(false);

        var lat = 0;
        var lng = 0;
        for (var i = 0; i < 360; i++) {
            if (i < 180) {
                lng++;
            }
            if (i == 180) {
                lng = 0;
            }
            if (i > 180) {
                lng--;
            }

            lat = 0;
            for (var j = 0; j < 167; j++) {
                if (j < 83) {
                    lat++;
                }
                if (j == 83) {
                    lat = 0;
                }
                if (j > 83) {
                    lat--;
                }

                var lngText = formatLong(lng);
                var latText = formatLat(lat);
                if (validTiles.indexOf(latText + lngText) == -1) {
                    addSeaPolygon([lng, lat]);
                }
            }
        }

        function addSeaPolygon(startPoint) {

            var nw = ol.proj.transform([startPoint[0], startPoint[1]], 'EPSG:4326', 'EPSG:3857');
            var ne = ol.proj.transform([startPoint[0] + 1, startPoint[1]], 'EPSG:4326', 'EPSG:3857');
            var se = ol.proj.transform([startPoint[0] + 1, startPoint[1] + 1], 'EPSG:4326', 'EPSG:3857');
            var sw = ol.proj.transform([startPoint[0], startPoint[1] + 1], 'EPSG:4326', 'EPSG:3857');

            var mochifeature = new ol.Feature({
                geometry: new ol.geom.Polygon([
                    [nw, ne, se, sw, nw]
                ])
            });
            seaLine.addFeature(mochifeature);
        }

    }

    function drawGrid() {
        gridLineLayer.setVisible(false);

        var lat = 0;
        var lng = 0;
        for (var i = 0; i < 360; i++) {
            if (i < 180) {
                lng++;
            }
            if (i == 180) {
                lng = 0;
            }
            if (i > 180) {
                lng--;
            }
            addLine(lng, 84, lng, -83);
            if (i <= 167) {
                if (i < 84) {
                    lat++;
                }
                if (i == 84) {
                    lat = 0;
                }
                if (i > 84) {
                    lat--;
                }
                addLine(0, lat, 180, lat);
                addLine(0, lat, -180, lat);
            }
        }

        function addLine(a, b, c, d) {
            var points = [];
            points[0] = ol.proj.transform([a, b], 'EPSG:4326', 'EPSG:3857');
            points[1] = ol.proj.transform([c, d], 'EPSG:4326', 'EPSG:3857');
            var cFlakeLine = new ol.Feature({
                geometry: new ol.geom.LineString(points)
            });
            gridLine.addFeature(cFlakeLine);
        }
    }

    function triggleGrid() {
        if (isGridShown == true) {
            hideGrid();
        } else {
            showGrid();
        }
    }

    function triggleSea() {
        if (isSeaShown == true) {
            hideSea();
        } else {
            showSea();
        }
    }

    function showGrid() {
        if (isGridShown == true) {
            return;
        }
        isGridShown = true;
        gridLineLayer.setVisible(true);
        $('#grid .icon_tool').removeClass('icon_showgrid');
        $('#grid .icon_tool').addClass('icon_hidegrid');
        $('#grid .icon_text').text('Hide Tiles');
    }

    function hideGrid() {
        if (isGridShown == false) {
            return;
        }
        isGridShown = false;
        gridLineLayer.setVisible(false);
        $('#grid .icon_tool').addClass('icon_showgrid');
        $('#grid .icon_tool').removeClass('icon_hidegrid');
        $('#grid .icon_text').text('Show Tiles');
    }

    function showSea() {
        if (isSeaShown == true) {
            return;
        }
        if (isSeaLoaded == false) {
            $('#loading').css("display", "block");
            setTimeout(function() {
                drawSea();
                $('#loading').css("display", "none");
                seaLineLayer.setVisible(true);
            }, 1000);
            isSeaLoaded = true;
        }
        isSeaShown = true;
        seaLineLayer.setVisible(true);
        $('#ocean .icon_tool').removeClass('icon_showocean');
        $('#ocean .icon_tool').addClass('icon_hideocean');
        $('#ocean .icon_text').text('Hide Sea Tiles');
    }

    function hideSea() {
        if (isSeaShown == false) {
            return;
        }
        isSeaShown = false;
        seaLineLayer.setVisible(false);
        $('#ocean .icon_tool').addClass('icon_showocean');
        $('#ocean .icon_tool').removeClass('icon_hideocean');
        $('#ocean .icon_text').text('Show Sea Tiles');
    }

    function resizeFeature(scale) {
        currentFeature.getGeometry().scale(scale);
        showHighlight();
    }

    function drawFeature() {
        if (currentFeature != undefined) {
            select.getFeatures().clear();
            drawLine.clear();
            highlightLine.clear();
            selectionLine.clear();
            currentFeature = undefined;
        }
        if (displayGridFirstTime == false) {
            showGrid();
        }
        displayGridFirstTime = true;
        map.addInteraction(draw);
    }
    drawGrid();

    //Button Handler
    $('#draw').click(function () {
        drawFeature();
    });
    $('#scale_up').click(function () {
        resizeFeature(1.5);
    });
    $('#scale_down').click(function () {
        resizeFeature(1 / 1.5);
    });
    $('#grid').click(function () {
        triggleGrid();
    });
    $('#whole_world').click(function () {
        map.getView().setCenter(ol.proj.transform([40, 10], 'EPSG:4326', 'EPSG:3857'));
        map.getView().setZoom(3);
    });
    $('#ocean').click(function () {
        triggleSea();
    });

    //Tab
    $('#tab_map').click(function () {
        $('#tab_latlon').removeClass("tab_select");
        $('#tab_map').addClass("tab_select");
        $('#map_content').css("display", "block");
        $('#latlon_content').css("display", "none");
    });
    $('#tab_latlon').click(function () {
        $('#tab_map').removeClass("tab_select");
        $('#tab_latlon').addClass("tab_select");
        $('#map_content').css("display", "none");
        $('#latlon_content').css("display", "block");
    });
    $('#latlon_btn').click(function () {
        var lat = $('#lat_1').val();
        var lng = $('#lon_1').val();
        if (/^(N|S)[0-9][0-9]$/.test(lat) && /^(E|W)[0-9][0-9][0-9]$/.test(lng)) {
            downloadTile("Download_" + lat + lng + ".zip");
        } else {
            alert("Please enter a correct coordinate. (e.g.) N34");
        }
    });
});

function downloadTile(id) {
    //window.location = "./download/"+id;
    window.open('./download/' + id, '_blank');
}
