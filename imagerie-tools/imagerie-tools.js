module.exports = function(RED) {
  "use strict";

  const fs = require("fs");
  const http = require('http');
  const path = require('path');

  var FormData = require('form-data');

  var bodyParser = require("body-parser");
  var multer = require("multer");
  var cookieParser = require("cookie-parser");
  var getBody = require('raw-body');
  var cors = require('cors');
  var jsonParser = bodyParser.json();
  var urlencParser = bodyParser.urlencoded({extended:true});
  var onHeaders = require('on-headers');

  function ImagerieConfigNode(n) {
      RED.nodes.createNode(this,n);
      this.host = n.host;
  }

  const HandleFailures = function(msg, node) {
    // TODO: use RED.settings.logging.console.level to control debug / error messages
    node.error(msg);
    //node.status({fill:"red",shape:"dot",text:"node-red:common.status.not-connected"});
  }

  function PredictUpload(n) {
      RED.nodes.createNode(this,n);
      var config = RED.nodes.getNode(n.imagerieconfig);
      var node = this;
      node.host = config.host;
      node.project = n.project;
      //console.log(n, config, node);

      node.on('input', function(msg) {
        if (!node.project) {
          return alert("Select a project");
        }
        var url = node.host + '/predict/upload/' + node.project;
        console.log("POST Image to " + url);

        var file = msg.filename;
        if (msg.payload instanceof Buffer) {
          file = msg.payload;
        } else if (typeof file == 'string') {
          file = fs.createReadStream(file);
        }


        var form = new FormData();
        form.append('file', file);

        /*
        var request = http.request({
          method: 'post',
          host: 'http://35.232.117.223',
          port: '80',
          path: '/api/capture',
          headers: form.getHeaders()
        });

        form.pipe(request);

        request.on('response', function(res) {
          console.log('form posted', res.statusCode);
        });
        */

        form.submit(url, function(err, res) {
          if (err) {
            console.error(err.statusMessage);
          } else {
            res.resume();
            node.send({
              topic:'image-predicted',
              filename:msg.filename,
              payload:{
                statusMessage:res.statusMessage,
                statusCode:res.statusCode,
                url:res.url,
                method:res.method
              }
            });
          }
        });

      });
  }

  function PredictCamera(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.project = n.project;
      node.camera = n.camera;
  }

  const httpMiddleware = function(req,res,next) {
    console.log('httpMiddleware');
    next();
  }
  if (RED.settings.httpNodeMiddleware) {
      if (typeof RED.settings.httpNodeMiddleware === "function") {
          console.log('Use settings httpNodeMiddleware');
          httpMiddleware = RED.settings.httpNodeMiddleware;
      }
  }

  const corsHandler = function(req,res,next) { next(); }
  if (RED.settings.httpNodeCors) {
      corsHandler = cors(RED.settings.httpNodeCors);
      RED.httpNode.options("*",corsHandler);
  }

  RED.nodes.registerType("imagerie-settings",ImagerieConfigNode);
  RED.nodes.registerType("predict-camera",PredictCamera);
  RED.nodes.registerType("predict-upload",PredictUpload);

}
