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
                cameras = JSON.parse(cameras)
                this.allCameras = cameras;
                if (!this.cam) {
                    this.cam = cameras[0].id;
                }
                this.$(this.camSelector).removeClass('loading')
                return cameras;
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
                allTypes[this.camSettings[parent][selector].type] = selector;
                var toPass = {}
                toPass['data-parent'] = parent;
                toPass.value = selector;
                toPass.text = selector;
                if (this.camSettings[parent][selector].type === 'null') {
                    toPass.disabled = true;
                }
                this.$('<option/>', toPass).appendTo(this.camPropSelector);
            }
        }
        console.info(allTypes);
    }

    buildPropValField ()  {
        const typeMap = {
            'Enumerate':{type:'select', nodeName:'select'},
            'String':{type:'text', nodeName:'input'},
            'Integer':{type:'number', nodeName:'input'},
            'Float':{type:'number', nodeName:'input'},
            'Command':{type:'textarea', nodeName:'textarea'},
            'Bool':{type:'checkbox', nodeName:'checkbox'}
        };

        let config = typeMap[this.camProperty.type];

        if (this.$(this.camPropValSelector).get(0).nodeName.toLowerCase() !== config.nodeName) {
            // replace element with correct HTML5 element
            const newEl = document.createElement(config.nodeName);
            newEl.setAttribute('type', config.type);
            newEl.id = this.camPropValSelector.substring(1); // strip hash
            this.$(this.camPropValSelector).replaceWith(newEl)
            // TODO: if checkbox > add label
        }

        if (this.camProperty.min) {
            // TODO: VALIDATION
        }
        config.value = this.camProperty.value;
        if (this.camProperty.options) {
            this.$('<option/>', {text:config.value, value:config.value}).appendTo(this.camPropValSelector)
            // TODO: loop other options
        }
        console.log("BUILD ", config, 'from', this.camProperty);

        for(let c in config) {
            this.$(this.camPropValSelector).attr(c, config[c]);
        };
        this.getToolTip()

    }

    releaseCamera() {
        //
    }

    getToolTip() {
        let html = JSON.stringify(this.camProperty, null, 2);
        this.$('#camPropertyDesc').html(html)
    }

    getAllAttributes(el) {
        return el.getAttributeNames()
            .reduce((obj, name) => ({
                ...obj,
                [name]: el.getAttribute(name)
            }), {})
    }

    setProperty(parent, selector) {
        this.camProperty = this.camSettings[parent][selector];
    }

    setHost(host) {
        this.host = host;
    }

    setCam(cam) {
        this.cam = cam;
    }


}

// export default CameraController;
