module.exports = function(RED) {

  function FanucRegistryNode(n) {
      RED.nodes.createNode(this,n);
      this.reg = n.reg;
      this.index = n.index;
  }
  RED.nodes.registerType("fanuc-registry",FanucRegistryNode);

  function RobotSocketNode(n) {
      RED.nodes.createNode(this,n);
      var node = this;
      node.name = n.name;
      node.host = n.host;
      node.simulated = n.simulated;

      var config =  RED.nodes.getNode(n.regpoint);
      node.reg = config.reg;
      node.index = config.index;

      //console.log('Compiled RobotSocketNode', node);

      node.status({fill:"grey",shape:"dot",text:"node-red:common.status.not-connected"});

      node.on('input', function(msg) {
        var data = msg;
        if (typeof data == 'string') data = JSON.parse(msg);
        if ((typeof data.req == 'object' && typeof data.req.params == 'object') || data.filename == 'GETDATA.json') {
              var debug = data;
              debug.req = data.req.params;
              debug.res = '';
              debug.payload = JSON.stringify(debug.payload).substring(0, 20);
              console.log('json file received: ', debug);
        } else {

              console.log('input msg: ', msg);

              var templates = { // TODO: move to config or some shared global
                "numreg" : {t:'/SMONDO/SETNREG%20:index%20:value'},
                "strreg" : {t:'/SMONDO/SETSREG%20:index%20:value'},
                "DIN" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:1}},
                "DOUT" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:2}},
                "RI" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:8}},
                "RO" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:9}},
                "Flag" : {t:'/SMONDO/SETIOVAL%20:ioval%20:index%20:simulated%20:value%20:value', inject:{ioval:35}},
                "SysVar" : {t:'/SMONDO/SETVAR%20:index%20":value"'},
              };
              // $UALRM_MSG[1]

              var runtimes = {
                'index' : node.index,
                'simulated' : node.simulated,
                'value' : msg.payload,
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
              var options = {
                host:parts[0],
                port: parseInt(parts[1]),
                path: path,
                method: 'GET'
              };
              console.log('sending path ', options);

              var http = require('http');
              var req = http.request(options, function(res) {
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                  // console.log('REQ RESPONSE BODY: ' + chunk);
                  node.status({fill:"green",shape:"dot",text:"node-red:common.status.connected"});
                });
              });

              req.on('error', function(e) {
                console.log('problem with request: ' + e.message);
                node.status({fill:"red",shape:"dot",text:"node-red:common.status.not-connected"});
              });

              req.end();
        }


      });

  }
  RED.nodes.registerType("robot-socket",RobotSocketNode);
}
