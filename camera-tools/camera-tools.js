module.exports = function (RED) {
    "use strict";

    // const fs = require("fs");
    const http = require('http');
    const cors = require('cors');

    function RemoteServerNode(n) {
        RED.nodes.createNode(this,n);
        this.host = n.host;
        this.port = n.port;
    }

    function CameraLocationNode(n) {
        RED.nodes.createNode(this, n);
        this.camlocation = n.camlocation;
    }

    function SetCameraConfig(n) {
        RED.nodes.createNode(this, n);
        var node = this;
        node.camlocation = RED.nodes.getNode(n.camlocation);
        node.camera = n.camera;
        node.camprop = n.camprop;
        node.propval = n.propval;
        console.log("SetCameraConfig", n, node);

        const HandleFailures = function (msg) {
            // TODO: use RED.settings.logging.console.level to control debug / error messages
            node.error(msg);
            console.error(msg);
            //node.status({fill:"red",shape:"dot",text:"node-red:common.status.not-connected"});
        }

        const HandleReponse = function(data) {
            node.send({
                topic: 'cam-config-set',
                payload: data
            });
        }

        node.on('input', function (msg) {

            const url = node.camlocation + '/vision/configureCamera/' + node.camera + '/' + node.camprop + '/' + node.propval;
            console.log("POST Image to " + url);

            const options = {method: "POST", url: url, dataType: "json"};

            http.get(options, HandleReponse, HandleFailures).on('error', (e) => {
                console.error(`http error: ${e.message}`);
            });

        });
    }


    let corsHandler = function (req, res, next) {
        next();
    }
    if (RED.settings.httpNodeCors) {
        corsHandler = cors(RED.settings.httpNodeCors);
        RED.httpNode.options("*", corsHandler);
    }

    RED.nodes.registerType("remote-server",RemoteServerNode);
    RED.nodes.registerType("camera-server", CameraLocationNode);
    RED.nodes.registerType("set-camera-property", SetCameraConfig);

}
