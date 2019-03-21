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

  function FanucRegistryNode(n) {
      RED.nodes.createNode(this,n);
      this.host = n.host;
  }

  const RobotSocketFailures = function(msg, node) {
    // TODO: use RED.settings.logging.console.level to control debug / error messages
    node.error(msg);
    //node.status({fill:"red",shape:"dot",text:"node-red:common.status.not-connected"});
  }

  // from trackauthority
  var qParam = function(name, url) {
       name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
       var regexS = "[\\?&]" + name + "=([^&#]*)";
       var regex = new RegExp(regexS);
       var results = null;
       results = regex.exec(url);
       if(results == null) return false;
       else return results[1].replace(/\+/g, " ");
   }

   var upParam = function(param, val, href) {
       var style = qParam(param, href);
       if (style && style != "") {
           href = href.replace("=" + style, "=" + val); // replace if it exists
       } else if (href.indexOf("?") > -1) {
           href += "&" + param + "=" + val; // add new param to others
       } else {
           href += "?" + param + "=" + val; // add only param to path
       }
       return href;
   }

  function PredictUpload(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.project = n.project;

      var config =  RED.nodes.getNode(n.imagerieconfig);
      node.host = config.host;
      node.filename = node.host.toString().replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.json'; // @WARN: this still doesn't replace strings begnining or ending with non-alphanumeric characters
      node.filepath = path.join(__dirname, '..', node.filename);

      var config =  RED.nodes.getNode(n.imagerieconfig);
      node.host = config.host;

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

  var httpMiddleware = function(req,res,next) {
    console.log('httpMiddleware');
    next();
  }
  if (RED.settings.httpNodeMiddleware) {
      if (typeof RED.settings.httpNodeMiddleware === "function") {
          console.log('use settings httpNodeMiddleware!!!');
          httpMiddleware = RED.settings.httpNodeMiddleware;
      }
  }

  var corsHandler = function(req,res,next) { next(); }
  if (RED.settings.httpNodeCors) {
      corsHandler = cors(RED.settings.httpNodeCors);
      RED.httpNode.options("*",corsHandler);
  }

  function PredictCamera(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.project = n.project;
      node.camera = n.camera;

      var config =  RED.nodes.getNode(n.imagerieconfig);
      node.host = config.host;
      node.filename = node.host.toString().replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.json'; // @WARN: this still doesn't replace strings begnining or ending with non-alphanumeric characters
      node.filepath = path.join(__dirname, '..', node.filename);
      // console.log("NODE INIT", node);

      node.on('input', function(msg) {
        //POST predict/upload/{project}
        // RED.httpNode.get(node.host + '/MD/getdata.stm',cookieParser(),httpMiddleware,corsHandler,metricsHandler,gotRobotData,RobotSocketFailures);

      });
  }

  function writeToFilePromise(str) {
    return new Promise((resolve, reject) => {
      fs.write(node.host+".json", str, {flag: "x"}, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  RED.nodes.registerType("imagerie-settings",FanucRegistryNode);
  RED.nodes.registerType("predict-camera",RobotSocketSet);
  RED.nodes.registerType("predict-upload",PredictCamera);

}
