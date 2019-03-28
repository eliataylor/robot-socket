module.exports = function(RED) {
  "use strict";

  const fs = require("fs");
  const http = require('http');
  const path = require('path');

  var FormData = require('form-data');
  var cors = require('cors');

  function ImagerieConfigNode(n) {
      RED.nodes.createNode(this,n);
      this.host = n.host;
  }

  const HandleFailures = function(msg, node) {
    // TODO: use RED.settings.logging.console.level to control debug / error messages
    node.error(msg);
    console.log(msg);
    //node.status({fill:"red",shape:"dot",text:"node-red:common.status.not-connected"});
  }

  const postImage = function(node) {

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
          console.log("as buffer ");
        } else if (typeof file == 'string') {
          console.log("from filepath ", file);
          file = fs.createReadStream(file);
          console.log("to stream ", file);
        }

        var form = new FormData();
        form.append('file', file);

/*
        var request = http.request({
          method: 'post',
          host: 'http://35.232.117.223',
          port: '80',
          path: '/api/capture/predict/upload/' + node.project,
          headers: form.getHeaders()
        });

        form.pipe(request);

        request.on('response', function(res) {
          console.log(res.statusCode);
          node.send({
            topic:'image-predicted',
            filename:msg.filename,
            payload:{
              statusMessage:res.statusMessage,
              statusCode:res.statusCode,
              url:res.url,
              method:res.method
            }
          })
        });
*/

        form.submit(url, function(err, res) {
          if (err) {
            console.error(err.statusMessage);
          } else {
            res.resume();
            if (res.statusCode != 200) {
              console.log(res);
            }
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
      var config = RED.nodes.getNode(n.imagerieconfig);
      var node = this;
      node.host = config.host;
      node.project = n.project;
      node.camera = n.camera;

      node.on('input', function(msg) {
        if (!node.project) {
          return alert("Select a project");
        }
        if (!node.camera) {
          return alert("Select a camera");
        }
        var url = node.host + '/predict/snap/' + node.project + '/' + node.camera;
        console.log("GET Image to " + url);

        http.get(url, (res) => {
          console.log(url, res);
          const { statusCode } = res;
          const contentType = res.headers['content-type'];

          let error;
          if (statusCode !== 200) {
            error = new Error('Request Failed.\n' +
                              `Status Code: ${statusCode}`);
          } else if (!/^application\/json/.test(contentType)) {
            error = new Error('Invalid content-type.\n' +
                              `Expected application/json but received ${contentType}`);
          }
          if (error) {
            HandleFailures(error.message);
            // Consume response data to free up memory
            res.resume();
            return;
          }

          res.setEncoding('utf8');
          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            try {
              const parsedData = JSON.parse(rawData);
              console.log(parsedData);
              node.send({
                topic:'camera-snap-predicted',
                payload:parsedData
              });
            } catch (e) {
              HandleFailures(error.message);
            }
          });
        }).on('error', (e) => {
          HandleFailures(error.message);
        });

      });
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
