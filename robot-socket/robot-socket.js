module.exports = function(RED) {
  "use strict";

  const fs = require("fs");
  //const http = require('http');
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

  const templates = {
    "numreg" : {t:'SETNREG%20:index%20:value'},
    "strreg" : {t:'SETSREG%20:index%20:value'},
    "DIN" : {t:'SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:1}},
    "DOUT" : {t:'SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:2}},
    "RI" : {t:'SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:8}},
    "RO" : {t:'SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:9}},
    "Flag" : {t:'SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:35}},
    "SysVar" : {t:'SETVAR%20:index%20":value"'}
  };

  function FanucRegistryNode(n) {
      RED.nodes.createNode(this,n);
      this.host = n.host;
  }

  var RobotSocketFailures = function(msg, node) {
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

  function RobotSocketSet(n) {
      RED.nodes.createNode(this,n);
      //console.log('RED.server.app: ', RED.server.app); // @TODO: can these be used to handle global request queue???
      //console.log('RED.server.server:', RED.server.server);
      var node = this;
      node.name = n.name;
      node.simulated = n.simulated;
      node.reg = n.reg;
      node.index = n.index;

      var config =  RED.nodes.getNode(n.regpoint);
      node.host = config.host;

      node.on('input', function(msg) {
        var data = msg;
        if (typeof data == 'string') data = JSON.parse(msg);
        if (typeof msg.payload == 'object') {
          node.error('invalid set value');
          return false;
        }

        var value = data.payload;
        if (value == null) value = '';

        if (typeof templates[node.reg] == 'undefined') {
          return RobotSocketFailures('illegal registry: ' + node.reg, node);
        }

        var obj = templates[node.reg]; // these are not dynamic variables and do not change are runtime (via inject / timestamps / http responses ... )
        var spath = obj.t;
        for(var i in obj.inject) {
          var regex = new RegExp(":"+i, 'g');
          spath = spath.replace(regex, obj.inject[i]);
        }

        var runtimes = {
          'index' : node.index,
          'simulated' : node.simulated,
          'value' : value
        }
        for(var i in runtimes) {
          var regex = new RegExp(":"+i, 'g'); // replaces ALL occurances of : plus the runtime/template key
          spath = spath.replace(regex, encodeURIComponent(runtimes[i]));
        }

        if (node.host === 'robot-test-data') {
          //@TODO: edit robot-test-data.json and resave file
        }

        var parts = node.host.split(':');
        if (parts.length < 2) parts[1] = process.env.PORT;

        var options = {host:parts[0], port: parseInt(parts[1]), path: '/SMONDO/' + spath};
        node.warn('setter path: ' + options.path);

        var singlePath = node.filepath.replace('.json', '.txt');
        var singleHttp = fs.readFileSync(singlePath, 'utf8');
        var param = '_' + node.reg + node.index;
        if (singleHttp) {
          singleHttp = upParam(param, spath, singleHttp);
        } else {
          singleHttp = '//' + parts[0] + ':' + parts[1] + '/SMONDO/testset.stm?' + param + '=' + spath;
        }

        fs.writeFileSync(singlePath, singleHttp, { encoding: 'utf-8', flag: 'w' });

        msg = {topic:'robotdatasmondo'}; // arbitrary topic
        msg.payload = options;
        node.send(msg);


        /*
        var req = RED.httpNode.get(options, function(res) {

          const { statusCode } = res;
          if (statusCode > 300) {
            // usually the robot replies with 'no content' > 204
            // TODO: set robot to reply with reg.index value
            RobotSocketFailures(`Request Failed. Status Code: ${statusCode} ${options.path}`, node);
            res.resume();  // consume response data to free up memory
            return;
          }

          // warn: unhandled response
          res.on('end', () => {
            msg = {topic:'setrobotdata'}; // arbitrary topic
            msg.payload = {reg:node.reg, index:node.index};
            node.send(msg);
          });

        });

        req.on('error', function(e){
          RobotSocketFailures(e,node);
        });
        */

      });
  }

  function handleRobotJson(rawData, node) {
    try {
      if (typeof rawData != 'object') {
        rawData = JSON.parse(rawData);
      }

      if (typeof rawData[node.reg] != 'undefined') {
        rawData = rawData[node.reg];
        var key = 'REG'+node.index;
        if (typeof rawData[key] != 'undefined') {
          rawData = rawData[key];
          //node.log('parsed json: ' + node.reg + ' - ' + key + ' == ' + rawData);
        } else {
          node.error('json missing registry/index: ' + node.reg + ' / ' + key);  // will the robot ever send something back like this?
        }
      } else {
        node.error('json missing registry: ' + node.reg); // will the robot ever send something back like this?
      }

      node.send({payload:rawData, topic:'gotrobotdata'}); // arbitrary topic

    } catch (e) {
      console.log(typeof rawData, rawData);
      RobotSocketFailures(e, node);
    }
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

  function RobotSocketGet(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.name = n.name;
      node.reg = n.reg;
      node.index = n.index;
      node.source = n.source;

      var config =  RED.nodes.getNode(n.regpoint);
      node.host = config.host;
      node.filename = node.host.toString().replace(/[^a-z0-9]/gi, '-').toLowerCase() + '.json'; // @WARN: this still doesn't replace strings begnining or ending with non-alphanumeric characters
      node.filepath = path.join(__dirname, '..', node.filename);
      // console.log("NODE INIT", node);

      node.on('input', function(msg) {

        if (msg.filename == node.filename && msg.payload.length > 0) {
          // @INFO nodes can be passed the robot data via other request node. this node will just parse the configured values and pass it along
          node.status(msg.filename + ' passed directly for parsing');
          handleRobotJson(msg.payload, node);
        }  else if (node.source == 'file') { // any getter nodes pointing a localhost load the static file if it exists

          if (fs.existsSync(node.filepath)) {

            //var jsonString = fs.readFileSync(jsonPath, 'utf8');
            fs.readFile(node.filepath, "utf8", (err, rawData) => {
              if (err) {
                node.warn('Error loading file: ' + node.filepath);
              } else {
                // found local data file
                handleRobotJson(rawData, node);
              }
            });
          } else {
            // @TODO check to allow HTTP request fallback
            node.status(node.filepath + ' File Missing. Be sure at least 1 getter node is requesting over HTTP to: ' + node.host);
          }
        } else {

          var parts = node.host.split(':');
          if (parts.length < 2) parts[1] = process.env.PORT;

          // below is only for nodes loading from the robot IP
          var options = {
            host:parts[0],
            port: parseInt(parts[1]),
            path: '/MD/getdata.stm',
            method: 'GET'
          };
          //console.log('getter HTTP: ', options);

          // @TODO: idea for  https://github.com/eliataylor/robot-socket/issues/1
          //requestQueue.push(options, 'GET', callback);

          var gotRobotData = function(res) {
              const { statusCode } = res;
              console.log('gotRobotData ' + statusCode);
              if (statusCode > 300) {
                RobotSocketFailures(`Request Failed. Status Code: ${statusCode} ${options.path}`, node);
                res.resume();  // consume response data to free up memory
              } else {
                res.setEncoding('utf8');

                let rawData = '';
                res.on('data', (chunk) => { rawData += chunk; });
                res.on('end', () => {
                  try {
                    // @WARN: each and every getter node with HTTP setting will resave the file for this host
                    fs.writeFile(node.filepath, rawData, { encoding: 'utf-8', flag: 'w' }, (err) => {
                      if (err) {
                        throw err;
                        node.error('filewriter failed: '+node.filepath);
                      } else {
                        node.status(node.filepath+' file saved!');
                      }
                    });

                    rawData = JSON.parse(rawData);
                    handleRobotJson(rawData, node);


                  } catch (e) {
                    console.log(typeof rawData, rawData);
                    node.error(e.message);
                  }
                });
              }
          }

          var metricsHandler = function(req,res,next) { next(); }
          if (this.metric()) {
              metricsHandler = function(req, res, next) {
                  var startAt = process.hrtime();
                  onHeaders(res, function() {
                      if (res._msgid) {
                          var diff = process.hrtime(startAt);
                          var ms = diff[0] * 1e3 + diff[1] * 1e-6;
                          var metricResponseTime = ms.toFixed(3);
                          var metricContentLength = res._headers["content-length"];
                          //assuming that _id has been set for res._metrics in HttpOut node!
                          node.metric("response.time.millis", {_msgid:res._msgid} , metricResponseTime);
                          node.metric("response.content-length.bytes", {_msgid:res._msgid} , metricContentLength);
                      }
                  });
                  next();
              };
          }
          console.log('requesting: ' + node.host + '/MD/getdata.stm');
          RED.httpNode.get(node.host + '/MD/getdata.stm',gotRobotData,RobotSocketFailures);
          // RED.httpNode.get(node.host + '/MD/getdata.stm',cookieParser(),httpMiddleware,corsHandler,metricsHandler,gotRobotData,RobotSocketFailures);
        }
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

  RED.nodes.registerType("fanuc-registry",FanucRegistryNode);
  RED.nodes.registerType("robot-socket-set",RobotSocketSet);
  RED.nodes.registerType("robot-socket-get",RobotSocketGet);

}
