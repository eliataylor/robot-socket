class CameraController {

    constructor(jq) {
        this.$ = jq;

        this.typeMap = {
            'Enumerate':{type:'select', nodeName:'select'},
            'String':{type:'text', nodeName:'input'},
            'Integer':{type:'number', nodeName:'input'},
            'Float':{type:'number', nodeName:'input'},
            'Command':{type:'textarea', nodeName:'textarea'},
            'Bool':{type:'checkbox', nodeName:'checkbox'}
        };

        this.camId = null;
        this.camSettings = {};
        this.camProperty = {};
        this.host = null;
        this.allCameras = [];
        this.camSelector = '#node-input-camera';
        this.camPropSelector = '#node-input-camprop';
        this.camPropValSelector = '#node-input-propval';
    }

    async camerasCallBack(cameras) {
        this.allCameras = cameras;
        this.renderCameras();
        if (!this.camId) {
            this.camId = cameras[0].id;
        } else {
            console.log("reusing preselected camera: " + this.camId)
            let camera = cameras.find(c => c.id === this.camId);
            if (camera) {
                this.camId = camera.id;
            } else {
                console.warn("No Camera Selected Yet", this.getContext(true), this.getContext())
                this.$(this.camSelector).removeClass('loading').attr('disabled', false)
                return false;
            }
        }

        // await this.loadCamConfigs();
        // this.renderCamProps();

        this.$(this.camSelector).removeClass('loading').attr('disabled', false)
    }

    async loadCameras() {
        this.$(this.camSelector).addClass('loading').attr('disabled', true)
        // var url = this.host + '/vision/cameras';
        var url = "resources/node-red-contrib-refined-motion/api/cameras.json";

        await this.$.ajax({
            url: url,
            dataType: "json"
        }).done(async (cameras) => {
            console.log("Got Cameras ", cameras);
            this.camerasCallBack(cameras);
        }).error((err) => {
            console.error("LOAD CAM FAILED", err);
            this.$(this.camSelector).removeClass('loading').attr('disabled', false)
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
        this.getToolTip()
    }

    async loadCamConfigs() {

        // var url = this.host + '/api/vision/vision/configTree/' + this.cam;
        let url = "resources/node-red-contrib-refined-motion/api/configTree.json?camId=" + this.cam;

        this.$(this.camPropSelector).addClass('loading').attr('disabled', true);

        await this.$.ajax({
            url: url,
            dataType: "json"
        }).done(data => {
            this.camSettings = data;
            this.$(this.camPropSelector).removeClass('loading').attr('disabled', false);
        }).error(err => {
            this.camSettings = {};
            this.$(this.camPropSelector).removeClass('loading').attr('disabled', false);
            console.error("LOAD CAM CONFIG FAILED", err);
        })
    }

    renderCamProps() {
        console.log("Got Config Tree:", this.camSettings);
        let allTypes = {}
        this.$(this.camPropSelector).html('<option disabled="true" value="">Select a Property</option>');
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
        // console.info(allTypes);
    }

    buildPropValField ()  {
        if (!this.camProperty || !this.camProperty.type) {
            return;
        }

        let config = this.typeMap[this.camProperty.type];

        if (this.$(this.camPropValSelector).length === 0) {
            console.warn("RACE CONDITION!??");
            return;
        }

        if (this.$(this.camPropValSelector).prop('nodeName').toLowerCase() !== config.nodeName) {
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
            this.$(this.camPropValSelector).html('');
            this.$('<option/>', {text:config.value, value:config.value}).appendTo(this.camPropValSelector)
            this.camProperty.options.forEach(o => {
                this.$('<option/>', {text:o, value:o}).appendTo(this.camPropValSelector)
            })
        }

        console.log("buildPropValField ", config, this.camProperty);

        for(let c in config) {
            this.$(this.camPropValSelector).attr(c, config[c]);
        }

        this.getToolTip()

    }

    releaseCamera() {
        //
    }

    getToolTip() {
        let html = JSON.stringify(this.camProperty, null, 2);
        let ctx = JSON.stringify(this.getContext(), null, 2);
        let htmlCtx = JSON.stringify(this.getContext(true), null, 2);
        this.$('#camPropertyDesc').html(`<h3>Selected Property</h3><div>${html}</div><h3>Context</h3><div>${ctx}</div><h3>Form Context</h3><div>${htmlCtx}</div>`)
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
        this.camId = cam;
    }

    getContext(html) {
        if (html === true) {
            return {
                host:$('#node-input-camlocation option:selected').text(),
                camId:$('#node-input-camera option:selected').val(),
                camProp:$('#node-input-camprop option:selected').val(),
                propVal:$('#node-input-propval option:selected').val()
            }
        }
        return {
            host:this.host,
            camId:this.camId,
            camProp:this.camProperty,
            propVal: this.camProperty.value
        }
    }


}

// export default CameraController;
