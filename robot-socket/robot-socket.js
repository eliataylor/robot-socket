module.exports = function(RED) {
  "use strict";

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
      this.reg = n.reg;
      this.index = n.index;
  }

  function RobotSocketFailures(msg, node) {
    console.log(msg);
    node.error(msg);
    node.status({fill:"red",shape:"dot",text:"node-red:common.status.not-connected"});
  }

  function RobotSocketSet(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.name = n.name;
      node.host = n.host;
      node.simulated = n.simulated;

      var config =  RED.nodes.getNode(n.regpoint);
      node.reg = config.reg;
      node.index = config.index;

      node.status({fill:"grey",shape:"dot",text:"node-red:common.status.ready"});

      node.on('input', function(msg) {
        var data = msg;
        if (typeof data == 'string') data = JSON.parse(msg);
        if (typeof msg.payload == 'object') {
          console.log('invalid set value');
          return false;
        }

        var value = msg.payload;
        if (value == null) value = '';

        var runtimes = {
          'index' : node.index,
          'simulated' : node.simulated,
          'value' : msg.payload,
        }

        if (typeof templates[node.reg] == 'undefined') {
          return RobotSocketFailures('illegal registry: ' + node.reg, node);
        }
        var obj = templates[node.reg];
        var path = obj.t;
        for(var i in obj.inject) {
          var regex = new RegExp(":"+i, 'g');
          path = path.replace(regex, obj.inject[i]);
        }
        for(var i in runtimes) {
          var regex = new RegExp(":"+i, 'g');
          path = path.replace(regex, runtimes[i]);
        }
        var parts = node.host.split(':');
        if (parts.length == 1) parts[1] = '1880';
        var options = {host:parts[0], port: parseInt(parts[1]), path: path};
        console.log('sending path ', options);

        var http = require('http');
        var req = http.get(options, function(res) {

          const { statusCode } = res;

          if (statusCode > 300) {
            RobotSocketFailures(`Request Failed. Status Code: ${statusCode}`, node);
            res.resume();  // consume response data to free up memory
            return;
          }

          var msg = {topic:'setrobotdata'};
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
          rawData = rawData[key];
          verbose = 2;
        } else {
          key = '<!-- #echo var='+key+' -->';
          if (typeof rawData[key] != 'undefined') {
            rawData = rawData[key];
            verbose = 3;
          }
        }
      }

      if (verbose > 2) {
        console.log('warning: unaltered value at ' + key, rawData);
      }

      node.send({msg:rawData, topic:'robotdata'});
      node.status({fill:"green",shape:"dot",text:"node-red:common.status.ready"});

    } catch (e) {
      RobotSocketFailures(e, node);
    }
  }

  function RobotSocketGet(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.name = n.name;
      node.host = n.host;

      var config =  RED.nodes.getNode(n.regpoint);
      node.reg = config.reg;
      node.index = config.index;

      node.status({fill:"grey",shape:"dot",text:"node-red:common.status.ready"});

      node.on('input', function(msg) {

        if (msg.filename == 'getdata.stm') {
          console.log(msg.filename + ' passed directly ');
          return handleRobotJson(msg.payload, node);
        }

        var parts = node.host.split(':');
        if (parts.length == 1) parts[1] = '1880';
        var options = {
          host:parts[0],
          port: parseInt(parts[1]),
          path: '/MD/getdata.stm',
          method: 'GET'
        };

        var http = require('http');
        var req = http.get(options, function(res) {

          const { statusCode } = res;
          const contentType = res.headers['content-type'];

          let error;
          if (statusCode !== 200) {
            error = new Error('Request Failed.\n' +
                              `Status Code: ${statusCode}`);
          }
          //else if (!/^application\/json/.test(contentType)) {
          //  error = new Error('Invalid content-type.\n' + `Expected application/json but received ${contentType}`);
          // }
          if (error) {
            RobotSocketFailures(error.message, node);
            res.resume();  // consume response data to free up memory
            return;
          }

          node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
          res.setEncoding('utf8');

          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            handleRobotJson(rawData, node);
          });
        });

        req.on('error', function(e){
          RobotSocketFailures(e,node);
        });
      });
  }

  RED.nodes.registerType("fanuc-registry",FanucRegistryNode);
  RED.nodes.registerType("robot-socket-set",RobotSocketSet);
  RED.nodes.registerType("robot-socket-get",RobotSocketGet);

}
