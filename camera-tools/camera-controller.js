

class CameraController {

    constructor(p) {
        this.cam = null;
        this.host = null;
        this.allCameras = [];

        this.camSelector = '#node-input-camera';
        this.camPropSelector = '#node-input-camprop';
    }

    getAllAttributes(el) {
        return el.getAttributeNames()
            .reduce((obj, name) => ({
                ...obj,
                [name]: el.getAttribute(name)
            }), {})
    }

    setHost(host) {
        this.host = host;
    }

    setCam(cam) {
        this.cam = cam;
    }

    loadCameras(forceReload) {
        if (!forceReload) {
            let cameras = localStorage.getItem('flexV-'+this.host+'-Cameras')
            if (cameras) {
                return JSON.parse(cameras);
            }
        }

        window.$(this.camSelector).addClass('loading')
        // var url = this.host + '/vision/cameras';
        var url = "/static/api/cameras.json"; // "resources/camera-tools/api/cameras.json";

        window.$.ajax({
            url: url,
            dataType: "json"
        }).done((data) => {
            console.log("Got Cameras " + data);
            localStorage.setItem('flexV-'+this.host+'-Cameras', JSON.stringify(data))
            this.allCameras = data;
            window.$(this.camSelector).removeClass('loading')
            return data;
        }).error((err) => {
            console.log(err);
            this.allCameras = [];
            window.$(this.camSelector).removeClass('loading')
            return err; // TODO: display error?
        });

    }

    renderCameras (host) {
        window.$(this.camSelector).html('');
        this.allCameras.forEach(o => {
            window.$('<option/>', {
                'value': o.id,
                'text': o.user_defined_name
            }).appendTo(this.camSelector);
        })
    }

    preloadCamConfigs (camId) {

        // var url = this.host + '/api/vision/vision/configTree/' + camId;
        let url = "/static/api/configTree.json?camId=" + camId;

        window.$(this.camPropSelector).html('<option>Please Wait. Loading Camera Config Tree...</option>');

        window.$.ajax({
            url: url,
            dataType: "json"
        }).done(function (data) {
            console.log("Got Config Tree:", data);
            let allTypes = {}
            window.$(this.camPropSelector).html('');
            let parents = {};
            for(let parent in data) {
                if (!parents[parent]) {
                    window.$('<option/>', {
                        'text': parent,
                        'disabled':true
                    }).appendTo(this.camPropSelector);
                    parents[parent] = true;
                }
                for(let selector in data[parent]) {
                    allTypes[data[parent][selector].type] = true;
                    var toPass = {}
                    for (let p in data[parent][selector]) {
                        toPass['data-'+p] = data[parent][selector][p];
                    }
                    toPass.value = data[parent][selector].value;
                    toPass.text = selector;
                    toPass['data-parent'] = parent;
                    window.$('<option/>', toPass).appendTo(this.camPropSelector);
                }
            }
            console.info(Object.keys(allTypes));
        }).error(function (err) {
            window.$(this.camPropSelector).html('Error loading cameras');
            console.error(err);
        });
    }

    buildPropValField (opt)  {
        // TODO: handle: ['Enumerate', 'String', 'Integer', 'Float', 'Command', 'Bool', 'null']
        console.log("BUILD ", opt);
        window.$('#node-input-propval').html('');
    }


}

export default CameraController;
