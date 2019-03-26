module.exports = function(RED) {
  "use strict";

  const fs = require("fs");
  const http = require('http');
  const path = require('path');

  var bodyParser = require("body-parser");
  var multer = require("multer");
  var cookieParser = require("cookie-parser");
  var getBody = require('raw-body');
  var cors = require('cors');
  var jsonParser = bodyParser.json();
  var urlencParser = bodyParser.urlencoded({extended:true});
  var onHeaders = require('on-headers');
  var typer = require('media-typer');
  var isUtf8 = require('is-utf8');
  var hashSum = require("hash-sum");

  function ImagerieConfigNode(n) {
      RED.nodes.createNode(this,n);
      this.host = n.host;
  }

  const HandleFailures = function(msg, node) {
    // TODO: use RED.settings.logging.console.level to control debug / error messages
    node.error(msg);
    //node.status({fill:"red",shape:"dot",text:"node-red:common.status.not-connected"});
  }

  const PopulateProjects = function(host) {
    $.getJSON(host + '/project', function(data) {
      console.log("KNOWN PROJECTS", data);
    });
  }

  function PredictUpload(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.project = n.project;

      var config =  RED.nodes.getNode(n.imagerieconfig);
      node.host = config.host;
      PopulateProjects(node.host);
      console.log("PredictCamera NODE INIT", node);

      node.on('input', function(msg) {
        var data = msg;
        if (typeof data == 'string') data = JSON.parse(msg);
        if (typeof msg.payload == 'object') {
          node.error('invalid set value');
        //  return false;
        }

        var value = data.payload;
        if (value == null) value = '';


      });
  }

  function PredictCamera(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.project = n.project;
      node.camera = n.camera;

      var config =  RED.nodes.getNode(n.imagerieconfig);
      node.host = config.host;
      PopulateProjects(node.host);
      console.log("PredictCamera NODE INIT", node);

      node.on('input', function(msg) {
        // POST predict/upload/{project}
        // RED.httpNode.get(node.host + '/MD/getdata.stm',cookieParser(),httpMiddleware,corsHandler,metricsHandler,gotRobotData,HandleFailures);
      });
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
