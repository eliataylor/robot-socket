class CameraController {

    constructor(jq, p) {
        this.$ = jq;

        this.typeMap = {
            'Enumerate':{type:'select', nodeName:'select'},
            'String':{type:'text', nodeName:'input'},
            'Integer':{type:'number', nodeName:'input'},
            'Float':{type:'number', nodeName:'input'},
            'Command':{type:'textarea', nodeName:'textarea'},
            'Bool':{type:'checkbox', nodeName:'checkbox'}
        };
        this.camSettings = {};
        this.allCameras = [];

        console.log('PASSED DEFAULTS', p);

        this.host = ""; // parse from config!?!
        this.camId = p.camId || '';
        this.camProp = p.camProp || "";
        this.camProperty = {};
        this.propVal = p.propVal || "";

        this.camServerSelector = '#node-input-camlocation';
        this.camSelector = '#node-input-camera';
        this.camPropSelector = '#node-input-camprop';
        this.camPropValSelector = '#node-input-propval';

    }

    startListeners() {
        this.$(this.camServerSelector).change((e) => {
            this.syncToForm();
            this.loadCameras();
        })

        this.$(this.camSelector).change((e) => {
            this.syncToForm();
            this.loadCamConfigs();
        });

        this.$(this.camPropSelector).change((e) => {
            this.syncToForm();
            this.buildPropValField()
        });

        this.loadCameras();
    }

    restoreFromLocalStorage() {
        if (this.host === "") {
            console.log("Restore found not host", this)
            return false;
        }
        let key = 'fvenv' + this.host;
        let env = localStorage.getItem(key);
        if (env) {
            env = JSON.parse(env);
            if (env.allCameras && env.allCameras.length > 0) {
                this.allCameras = env.allCameras;
            }
            if (this.camId && env.allSettings && env.allSettings[this.camId]) {
                this.camSettings = env.allSettings[this.camId];
            } else {
                this.camSettings = {}
            }
        }
        console.log("restored " + key, env)
        return env;
    }

    saveToLocalStorage() {
        if (this.host === "") return false;
        let key = 'fvenv' + this.host;
        let env = localStorage.getItem(key);
        if (env) {
            env = JSON.parse(env);
        } else {
            env = {allCameras:this.allCameras, allSettings: {}}
        }
        if (this.allCameras && this.allCameras.length > 0) {
            env.allCameras = this.allCameras;
        }
        if (this.camId) {
            env.allSettings[this.camId] = this.camSettings;
        }
        console.log("saved " + key, env);
        localStorage.setItem(key, JSON.stringify(env));
    }

    renderCameras () {
        this.$(this.camSelector).html('<option value="">Select a Camera</option>');
        this.allCameras.forEach(o => {
            const toPass =  {'value': o.id, 'text': o.user_defined_name}
            if (o.id === this.camId) {
                toPass.selected = true;
            }
            this.$('<option/>',toPass).appendTo(this.camSelector);
        })
        this.$(this.camSelector).removeClass('loading').attr('disabled', false)
        this.getToolTip()
    }

    loadCameras(forceReload) {
        if (forceReload !== true) {
            this.restoreFromLocalStorage();
            if (this.allCameras && this.allCameras.length > 0) {
                if (this.camId === '') {
                    return this.camerasCallBack(this.allCameras);
                } else if (this.camId && this.allCameras.findIndex(c => c.id === this.camId) > -1) {
                    return this.camerasCallBack(this.allCameras);
                }
            }
        }

        this.$(this.camSelector).addClass('loading').attr('disabled', true)
        // var url = this.host + '/vision/cameras';
        var url = "resources/node-red-contrib-refined-motion/api/cameras.json";

        this.$.ajax({
            url: url,
            dataType: "json"
        }).done(async (cameras) => {
            console.log("Got Cameras ", cameras);
            this.allCameras = cameras;
            this.saveToLocalStorage()
            this.camerasCallBack(cameras);
        }).error((err) => {
            console.error("LOAD CAM FAILED", err);
            this.$(this.camSelector).removeClass('loading').attr('disabled', false)
            return err; // TODO: display error?
        });
    }

    camerasCallBack(cameras) {
        this.renderCameras();
        if (!this.camId) {
            return false;
        }
        let camera = cameras.find(c => c.id === this.camId);
        if (!camera) {
            return console.warn("THIS CAMERA IS NO LONGER CONNECTED", this.camId)
        }
        this.loadCamConfigs();
    }

    loadCamConfigs(forceReload) {

        if (forceReload !== true) {
            let env = this.restoreFromLocalStorage();
            if (env.allSettings && env.allSettings[this.camId]) {
                return this.renderCamProps();
            }
        }

        // var url = this.host + '/api/vision/vision/configTree/' + this.cam;
        let url = "resources/node-red-contrib-refined-motion/api/configTree.json?camId=" + this.cam;

        this.$(this.camPropSelector).addClass('loading').attr('disabled', true);

        this.$.ajax({
            url: url,
            dataType: "json"
        }).done(data => {
            console.log("Got Cam Configs", data)
            this.camSettings = data;
            this.renderCamProps();
            this.saveToLocalStorage()
        }).error(err => {
            this.camSettings = {};
            this.$(this.camPropSelector).removeClass('loading').attr('disabled', false);
            console.error("LOAD CAM CONFIG FAILED", err);
        })
    }

    renderCamProps() {
        let allTypes = {}
        this.$(this.camPropSelector).html('<option value="">Select a Property</option>');
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
                if (this.camProp === selector) {
                    toPass.selected = true;
                }
                this.$('<option/>', toPass).appendTo(this.camPropSelector);
            }
        }
        this.$(this.camPropSelector).removeClass('loading').attr('disabled', false);
        this.buildPropValField()
        // console.info(allTypes);
    }

    buildPropValField ()  {
        if (!this.camProperty || !this.camProperty.type) {
            console.log('missing camProperty', this.getContext)
            return;
        }

        let config = this.typeMap[this.camProperty.type];

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

        this.$(this.camPropValSelector).attr('type', config.type);
        this.$(this.camPropValSelector).val(this.propVal)

        if (this.camProperty.options) {
            this.$(this.camPropValSelector).html('');
            this.camProperty.options.forEach(o => {
                this.$('<option/>', {
                    text:o,
                    value:o,
                    selected : o === this.propVal
                }).appendTo(this.camPropValSelector)
            })
        }

        this.$(this.camPropValSelector).change((e) => {
            this.syncToForm();
        });

        console.log("buildPropValField " + this.propVal);

        this.getToolTip()

    }

    releaseCamera() {
        //
    }

    setProperty(parent, selector) {
        if (!this.camSettings[parent] || !this.camSettings[parent][selector]) {
            return false;
        }
        this.camProperty = this.camSettings[parent][selector];
        this.camProperty.parent = parent;
        this.camProperty.selector = selector;
        this.camProp = selector;
    }

    setHost(host) {
        this.host = host;
    }

    setCam(cam) {
        this.camId = cam;
    }

    // like ComponentDidUpdate in react.js
    syncToForm() {
       let defaults = {
           host:this.host,
           camId:this.camId,
           camProperty:this.camProperty,
           propVal: this.propVal
       };
       let check = $(this.camServerSelector + ' option:selected').text()
       try {
           let test = new URL(check);
           if (check && check.length > 0) {
               defaults.host = check;
               this.setHost(check)
           }
       } catch(e) {}

        check = $(this.camSelector + ' option:selected')
        if (check && check.length > 0) {
            defaults.camId = check.attr('value');
            this.setCam(check.attr('value'))
        } else if (defaults.camId) {
            $(this.camSelector).val(defaults.camId);
        }

        check = $(this.camPropSelector + ' option:selected')
        if (check && check.length > 0) {
            this.setProperty(check.attr('data-parent'), check.attr('value'))
            defaults.camProperty = this.camProperty;
            defaults.camProp = check.attr('value')
        } else if (defaults.camProp && defaults.camProp) {
            $(this.camPropSelector).val(defaults.camProp)
        }

        check = $(this.camPropValSelector).val()
        if (check && check.length > 0) {
            defaults.propVal = check;
            this.propVal = check;
        } else if (defaults.propVal) {
            $(this.camPropValSelector).val(defaults.propVal)
        }
        console.log(defaults);
        return defaults;
    }

    getToolTip() {
        let html = JSON.stringify(this.camProperty, null, 2);
        let ctx = JSON.stringify(this.getContext(), null, 2);
        this.$('#camPropertyDesc').html(`<h3>Selected Property</h3><div>${html}</div><h3>Context</h3><div>${ctx}</div>`)
    }

    getContext() {
        const prop = $(this.camPropSelector + ' option:selected');
        let form = {
            host:$(this.camServerSelector + ' option:selected').text(),
            camId:$(this.camSelector).val(),
            camProp:prop.val(),
            propVal:$(this.camPropValSelector).val()
        }
        if (form.camProp && form.camProp.length > 0) {
            form.camProperty = this.camSettings[prop.attr('data-parent')][form.camProp]
        }

        const ctx = {
            host: this.host,
            camId: this.camId,
            camProperty: this.camProperty,
            camProp: this.camProp,
            propVal: this.propVal
        };

        const event = new CustomEvent('updateToolContext', {detail:ctx});
        document.getElementById("fvCamForm").dispatchEvent(event);

        return {form: form, ctx: ctx}
    }


}

// export default CameraController;
