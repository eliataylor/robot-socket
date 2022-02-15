class CameraController {

    constructor(jq) {
        this.$ = jq;

        this.cam = null;
        this.camSettings = {};
        this.camProperty = {};
        this.host = null;
        this.allCameras = [];
        this.camSelector = '#node-input-camera';
        this.camPropSelector = '#node-input-camprop';
        this.camPropValSelector = '#node-input-propval';
    }

    async loadCameras(forceReload) {
        if (!forceReload) {
            let cameras = localStorage.getItem('flexV-'+this.host+'-Cameras')
            if (cameras) {
                return JSON.parse(cameras);
            }
        }

        this.$(this.camSelector).addClass('loading')
        // var url = this.host + '/vision/cameras';
        var url = "resources/node-red-contrib-refined-motion/api/cameras.json";

        await this.$.ajax({
            url: url,
            dataType: "json"
        }).done((data) => {
            console.log("Got Cameras " + data);
            this.allCameras = data;
            if (!this.cam) {
                this.cam = data[0].id;
            }
            this.$(this.camSelector).removeClass('loading')
            localStorage.setItem('flexV-'+this.host+'-Cameras', JSON.stringify(data))
            return data;
        }).error((err) => {
            console.error("LOAD CAM FAILED", err);
            if (forceReload === true) {
                this.allCameras = [];
                this.cam = null;
            }
            this.$(this.camSelector).removeClass('loading')
            return err; // TODO: display error?
        });
    }

    renderCameras () {
        this.$(this.camSelector).html('');
        this.allCameras.forEach(o => {
            this.$('<option/>', {
                'value': o.id,
                'text': o.user_defined_name
            }).appendTo(this.camSelector);
        })
    }

    async loadCamConfigs() {

        // var url = this.host + '/api/vision/vision/configTree/' + this.cam;
        let url = "resources/node-red-contrib-refined-motion/api/configTree.json?camId=" + this.cam;

        this.$(this.camPropSelector).addClass('loading');

        await this.$.ajax({
            url: url,
            dataType: "json"
        }).done(data => {
            this.camSettings = data;
            this.$(this.camPropSelector).removeClass('loading');
        }).error(err => {
            this.camSettings = {};
            this.$(this.camPropSelector).removeClass('loading');
            console.error("LOAD CAM CONFIG FAILED", err);
        })
    }

    renderCamProps() {
        console.log("Got Config Tree:", this.camSettings);
        let allTypes = {}
        this.$(this.camPropSelector).html('');
        let parents = {};
        for(let parent in this.camSettings) {
            if (!parents[parent]) {
                this.$('<option/>', {
                    'text': parent,
                    'disabled':true
                }).appendTo(this.camPropSelector);
                parents[parent] = true;
            }
            for(let selector in this.camSettings[parent]) {
                allTypes[this.camSettings[parent][selector].type] = true;
                var toPass = {}
                for (let p in this.camSettings[parent][selector]) {
                    toPass['data-'+p] = this.camSettings[parent][selector][p];
                }
                toPass.value = this.camSettings[parent][selector].value;
                toPass.text = selector;
                toPass['data-parent'] = parent;
                this.$('<option/>', toPass).appendTo(this.camPropSelector);
            }
        }
        console.info(Object.keys(allTypes));
    }

    buildPropValField (opt)  {
        // TODO: handle: ['Enumerate', 'String', 'Integer', 'Float', 'Command', 'Bool', 'null']
        this.camProperty = opt;
        console.log("BUILD ", opt);
        this.$(this.camPropValSelector).html('');
    }

    releaseCamera() {
        //
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


}

// export default CameraController;
