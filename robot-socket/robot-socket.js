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
    // TODO: use RED.settings.logging.console.level to control debug / error messages
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
          node.error('invalid set value');
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
          path = path.replace(regex, encodeURIComponent(runtimes[i]));
        }
        var parts = node.host.split(':');
        if (parts.length == 1) parts[1] = '1880';
        var options = {host:parts[0], port: parseInt(parts[1]), path: path};
        node.warn('setter path: ' + options.path);

        var req = http.get(options, function(res) {

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
          node.log('parsed json: ' + node.reg + ' - ' + key + ' == ' + rawData);
        } else {
          node.error('json missing registry/index: ' + node.reg + ' / ' + key);  // will the robot ever send something back like this?
        }
      } else {
        node.error('json missing registry: ' + node.reg); // will the robot ever send something back like this?
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
      node.source = n.source;

      var config =  RED.nodes.getNode(n.regpoint);
      node.host = config.host;

      // node.status({fill:"grey",shape:"dot",text:"node-red:common.status.ready"});

      node.on('input', function(msg) {

        if (msg.filename == 'getdata.stm' || msg.filename == 'getdata.json' || msg.filename == node.host + '.json') {
          node.warn(msg.filename + ' passed directly '); // this shoud never happen on productio. it's just for testing and retrieving the base getdata.stm file
          return handleRobotJson(msg.payload, node);
        }

        var parts = node.host.split(':');
        if (parts.length == 1) parts[1] = '1880'; // this is just for my own testing without a robot

        if (node.source == 'file') { // any getter nodes pointing a localhost load the static file if it exists

          fs.readFile(node.host + '.json', "utf8", (err, rawData) => {
            if (err) {
              return node.warn(node.host + '.json do not exist yet'); // make sure you have at least one getter loading from the robot IP
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
        node.log('getter path: ' + options.path);

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
            // WARN: i'm a bit worried about too many nodes writing at once.
            fs.writeFile(node.host + '.json', rawData, { flag: 'w' }, (err) => {
              if (err) {
                throw err;
                return node.error('filewriter failed: '+node.host+'.json');
              } else {
                node.log(node.host+'.json saved');
              }
            });
            try {
              rawData = JSON.parse(rawData);
            } catch (e) {
              return node.error(e.message);
            }
            handleRobotJson(rawData, node);

          });
        });

        req.on('error', function(e){
          RobotSocketFailures(e,node);
        });
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
