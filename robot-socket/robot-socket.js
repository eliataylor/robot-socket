module.exports = function(RED) {
  "use strict";

  const fs = require("fs");
  const http = require('http');

  const templates = {
    "numreg" : {t:'/SMONDO/SETNREG%20:index%20:value'},
    "strreg" : {t:'/SMONDO/SETSREG%20:index%20:value'},
    "DIN" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:1}},
    "DOUT" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:2}},
    "RI" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:8}},
    "RO" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:9}},
    "Flag" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:35}},
    "SysVar" : {t:'/SMONDO/SETVAR%20:index%20":value"'}
  };

  function FanucRegistryNode(n) {
      RED.nodes.createNode(this,n);
      this.host = n.host;
  }

  function RobotSocketFailures(msg, node) {
    // TODO: improve error handling with a 'verbose' flag better control message tracing
    console.log(msg);
    node.error(msg);
    node.status({fill:"red",shape:"dot",text:"node-red:common.status.not-connected"});
  }

  function RobotSocketSet(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.name = n.name;
      node.simulated = n.simulated;
      node.reg = n.reg;
      node.index = n.index;

      var config =  RED.nodes.getNode(n.regpoint);
      node.host = config.host;

      // node.status({fill:"grey",shape:"dot",text:"node-red:common.status.ready"});

      node.on('input', function(msg) {
        var data = msg;
        if (typeof data == 'string') data = JSON.parse(msg);
        if (typeof msg.payload == 'object') {
          console.log('invalid set value');
          return false;
        }

        var value = data.payload;
        if (value == null) value = '';

        if (typeof templates[node.reg] == 'undefined') {
          return RobotSocketFailures('illegal registry: ' + node.reg, node);
        }

        var obj = templates[node.reg]; // these are not dynamic variables and do not change are runtime (via inject / timestamps / http responses ... )
        var path = obj.t;
        for(var i in obj.inject) {
          var regex = new RegExp(":"+i, 'g');
          path = path.replace(regex, obj.inject[i]);
        }

        var runtimes = {
          'index' : node.index,
          'simulated' : node.simulated,
          'value' : value
        }
        for(var i in runtimes) {
          var regex = new RegExp(":"+i, 'g'); // replaces ALL occurances of : plus the runtime/template key
          path = path.replace(regex, runtimes[i]);
        }
        var parts = node.host.split(':');
        if (parts.length == 1) parts[1] = '1880';
        var options = {host:parts[0], port: parseInt(parts[1]), path: path};
        if (RED.settings.logging.console.level == 'debug') console.log('setter path ', options);

        var req = http.get(options, function(res) {

          const { statusCode } = res;
          if (statusCode > 300) {
            // usually the robot replies with 'no content' > 204
            // TODO: set robot to reply with reg.index value
            RobotSocketFailures(`Request Failed. Status Code: ${statusCode} ${options.path}`, node);
            res.resume();  // consume response data to free up memory
            return;
          }

          msg = {topic:'setrobotdata'}; // arbitrary topic
          msg.payload = {reg:node.reg, index:node.index};
          node.send(msg);

        });

        req.on('error', function(e){
          RobotSocketFailures(e,node);
        });

      });
  }

  function handleRobotJson(rawData, node) {
    try {
      if (typeof rawData != 'object') {
        rawData = JSON.parse(rawData);
      }

      var verbose = 0;
      if (node.reg && typeof rawData[node.reg] == 'object') {
        rawData = rawData[node.reg];
        verbose = 1;
      }
      if (node.index) {
        var key = 'REG'+node.index;
        if (typeof rawData[key] != 'undefined') {
          rawData = rawData[key]; // I DON'T THINK THIS SHOULD HAPPEN ON PRODUCTION (but don't fully know how getdata.stm is rewritten)
          verbose = 2;
        } else {
          key = '<!-- #echo var='+key+' -->'; // SHOULD NEVER HAPPEN ON PRODUCTION!
          if (typeof rawData[key] != 'undefined') {
            rawData = rawData[key];
            verbose = 3;
          }
        }
      }

      if (verbose > 2) {
        // this would implies getdata.stm was no rewritten properly by the robot
        console.log('warning: unaltered value at ' + key, rawData);
      }

      node.send({payload:rawData, topic:'robotdata'}); // arbitrary topic
      // node.status({fill:"green",shape:"dot",text:"node-red:common.status.ready"});

    } catch (e) {
      RobotSocketFailures(e, node);
    }
  }

  function RobotSocketGet(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.name = n.name;
      node.reg = n.reg;
      node.index = n.index;

      var config =  RED.nodes.getNode(n.regpoint);
      node.host = config.host;

      // node.status({fill:"grey",shape:"dot",text:"node-red:common.status.ready"});

      node.on('input', function(msg) {

        if (msg.filename == 'getdata.stm' || msg.filename == 'getdata.json') {
          console.log(msg.filename + ' passed directly '); // this shoud never happen on productio. it's just for testing and retrieving the base getdata.stm file
          return handleRobotJson(msg.payload, node);
        }

        var parts = node.host.split(':');
        if (parts.length == 1) parts[1] = '1880'; // this is just for my own testing without a robot

        if (parts[0] == 'localhost' || parts[0] == '127.0.0.1') { // any getter nodes pointing a localhost load the static file if it exists
          fs.readFile('getdata.json', (err, rawData) => {
            if (err) {
              return console.log('getdata.json do not exist yet'); // make sure you have at least one getter loading from the robot IP
            }
            // retrieved static data file
            handleRobotJson(rawData, node);
          });
          return;
        }

        // below is only for nodes loading from the robot IP
        var options = {
          host:parts[0],
          port: parseInt(parts[1]),
          path: '/MD/getdata.stm',
          method: 'GET'
        };

        var req = http.get(options, function(res) {

          const { statusCode } = res;
          if (statusCode > 300) {
            RobotSocketFailures(`Request Failed. Status Code: ${statusCode} ${options.path}`, node);
            res.resume();  // consume response data to free up memory
            return;
          }

          node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"}); // show the one node that is pooling the robot
          res.setEncoding('utf8');

          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            handleRobotJson(rawData, node);
            // WARN: i'm a bit worried about too many nodes writing at once.
            fs.writeFile('getdata.json', rawData, { flag: 'w' }, (err) => {
              if (err) {
                throw err;
                return console.log('filewriter failed: getdata.json');
              }
            });

/*            arr.reduce((chain, str) => {
              return chain
               .then(() => writeToFilePromise(str));
            }, Promise.resolve()); */

          });
        });

        req.on('error', function(e){
          RobotSocketFailures(e,node);
        });
      });
  }

  function writeToFilePromise(str) {
    return new Promise((resolve, reject) => {
      fs.write("getdata.json", str, {flag: "x"}, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  RED.nodes.registerType("fanuc-registry",FanucRegistryNode);
  RED.nodes.registerType("robot-socket-set",RobotSocketSet);
  RED.nodes.registerType("robot-socket-get",RobotSocketGet);

}
