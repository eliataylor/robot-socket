module.exports = function (RED) {
    "use strict";

    // const fs = require("fs");
    // const http = require('http');
    var cors = require('cors');

    function CameraLocationNode(n) {
        RED.nodes.createNode(this, n);
        this.host = n.host;
    }

    const HandleFailures = function (msg, node) {
        // TODO: use RED.settings.logging.console.level to control debug / error messages
        node.error(msg);
        console.error(msg);
        //node.status({fill:"red",shape:"dot",text:"node-red:common.status.not-connected"});
    }

    function SetCameraConfig(n) {
        RED.nodes.createNode(this, n);
        var config = RED.nodes.getNode(n.camserver);
        var node = this;
        node.camserver = config.camserver;
        node.camera = n.camera;
        node.camprop = n.camprop;
        node.propval = n.propval;
        console.log(n, config, node);

        node.on('input', function (msg) {
            var url = node.camserver + '/vision/configureCamera/' + node.camera + '/' + node.camprop + '/' + node.propval;
            console.log("POST Image to " + url);

            $.ajax({
                method: "POST",
                url: url,
                dataType: "json"
            }).done(function (data) {
                node.send({
                    topic: 'cam-config-set',
                    payload: data
                });
            }).error(function (err) {
                HandleFailures(err)
            });

        });
    }

    const corsHandler = function (req, res, next) {
        next();
    }
    if (RED.settings.httpNodeCors) {
        corsHandler = cors(RED.settings.httpNodeCors);
        RED.httpNode.options("*", corsHandler);
    }

    RED.nodes.registerType("camserver", CameraLocationNode);
    RED.nodes.registerType("set-camera-config", SetCameraConfig);

}
