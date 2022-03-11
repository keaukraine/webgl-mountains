"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MountainsRenderer = void 0;
const webgl_framework_1 = require("webgl-framework");
const gl_matrix_1 = require("gl-matrix");
const DiffuseColoredShader_1 = require("./shaders/DiffuseColoredShader");
const DiffuseATColoredAnimatedShader_1 = require("./shaders/DiffuseATColoredAnimatedShader");
const CameraMode_1 = require("./CameraMode");
const TerrainShader_1 = require("./shaders/TerrainShader");
const TerrainWaterShader_1 = require("./shaders/TerrainWaterShader");
const CameraPositionInterpolator_1 = require("./CameraPositionInterpolator");
const FOV_LANDSCAPE = 60.0; // FOV for landscape
const FOV_PORTRAIT = 70.0; // FOV for portrait
const YAW_COEFF_NORMAL = 200.0; // camera rotation time
const TERRAIN_SCALE = 1000;
class MountainsRenderer extends webgl_framework_1.BaseRenderer {
    constructor() {
        super();
        this.lastTime = 0;
        this.angleYaw = 0;
        this.loaded = false;
        this.fmSky = new webgl_framework_1.FullModel();
        this.fmSmoke = new webgl_framework_1.FullModel();
        this.fmSun = new webgl_framework_1.FullModel();
        this.fmBird = new webgl_framework_1.FullModel();
        this.fmTerrain = new webgl_framework_1.FullModel();
        this.Z_NEAR = 35.0;
        this.Z_FAR = 30000.0;
        this.timerDustRotation = 0;
        this.DUST_ROTATION_SPEED = 903333;
        this.timerDustMovement = 0;
        this.DUST_MOVEMENT_SPEED = 90000;
        this.timerBirdAnimation1 = 0;
        this.timerBirdAnimation2 = 0;
        this.BIRD_ANIMATION_PERIOD1 = 2500;
        this.BIRD_ANIMATION_PERIOD2 = 1200;
        this.timerBirdsFly = 0;
        this.BIRD_FLIGHT_PERIOD = 50000;
        this.BIRD_FLIGHT_RADIUS = 400;
        this.BIRD_SPREAD = 400;
        this.CLOUD_TRAVEL_X = 30000;
        this.CLOUD_TRAVEL_Y = 30000;
        this.CLOUD_TRAVEL_Z = 0;
        this.PRESETS = [
            {
                SKY: "night_1.jpg",
                LM_GRADIENT: "gradient-night",
                LM: "lm2",
                LM_FLIP: true,
                FOG_COLOR: {
                    r: 6 / 255 * 1.0,
                    g: 8 / 255 * 1.0,
                    b: 13 / 255 * 1.0
                },
                DISTANT_FOG_COLOR: {
                    r: 6 / 255 * 1.0,
                    g: 8 / 255 * 1.0,
                    b: 13 / 255 * 1.0
                },
                DECO_COLOR: {
                    r: 100 / 255 * 0.18,
                    g: 110 / 255 * 0.18,
                    b: 170 / 255 * 0.18
                },
                SUN_TRANSFORM: {
                    tx: 0,
                    ty: -22000,
                    tz: 8500,
                    sx: 0.0,
                    sy: 1,
                    sz: 1
                },
                CLOUDS_COLOR: {
                    r: 52 / 255 * 0.18,
                    g: 75 / 255 * 0.18,
                    b: 86 / 255 * 0.18
                },
                FOG_START_DISTANCE: 2000,
                FOG_DISTANCE: 14000,
                DISTANT_FOG_START_DISTANCE: 7000,
                DISTANT_FOG_DISTANCE: 40000,
                SUN_COLOR: {
                    r: 255 / 255,
                    g: 255 / 255,
                    b: 255 / 255
                },
                SUN_STRENGTH: 0.7,
                BIRDS: false
            },
            {
                SKY: "day_2.jpg",
                LM_GRADIENT: "gradient-day",
                LM: "lm2",
                LM_FLIP: false,
                FOG_COLOR: {
                    r: 147 / 255,
                    g: 178 / 255,
                    b: 205 / 255
                },
                DISTANT_FOG_COLOR: {
                    r: 147 / 255,
                    g: 178 / 255,
                    b: 205 / 255
                },
                DECO_COLOR: {
                    r: 150 / 255 * 1.0,
                    g: 150 / 255 * 1.0,
                    b: 190 / 255 * 1.0
                },
                SUN_TRANSFORM: {
                    tx: 2000,
                    ty: 22000,
                    tz: 13000,
                    sx: 300.0,
                    sy: 1,
                    sz: 1
                },
                CLOUDS_COLOR: {
                    r: 189 / 255 * 0.98,
                    g: 220 / 255 * 0.98,
                    b: 238 / 255 * 0.98
                },
                FOG_START_DISTANCE: 700,
                FOG_DISTANCE: 30000,
                DISTANT_FOG_START_DISTANCE: 7000,
                DISTANT_FOG_DISTANCE: 40000,
                SUN_COLOR: {
                    r: 255 / 255,
                    g: 255 / 255,
                    b: 255 / 255
                },
                SUN_STRENGTH: 0.7,
                BIRDS: true
            },
            {
                SKY: "sunset_1.jpg",
                LM_GRADIENT: "gradient-dusk",
                LM: "lm1",
                LM_FLIP: false,
                FOG_COLOR: {
                    r: 186 / 255,
                    g: 150 / 255,
                    b: 158 / 255
                },
                DISTANT_FOG_COLOR: {
                    r: 186 / 255,
                    g: 150 / 255,
                    b: 158 / 255
                },
                DECO_COLOR: {
                    r: 200 / 255 * 0.3,
                    g: 190 / 255 * 0.3,
                    b: 150 / 255 * 0.3
                },
                SUN_TRANSFORM: {
                    tx: -100,
                    ty: -22000,
                    tz: 2500,
                    sx: 0.0,
                    sy: 1,
                    sz: 1
                },
                CLOUDS_COLOR: {
                    r: 235 / 255 * 0.07,
                    g: 162 / 255 * 0.07,
                    b: 48 / 255 * 0.07
                },
                FOG_START_DISTANCE: 1000,
                FOG_DISTANCE: 40000,
                DISTANT_FOG_START_DISTANCE: 18000,
                DISTANT_FOG_DISTANCE: 40000,
                SUN_COLOR: {
                    r: 253 / 255 * 1.0,
                    g: 172 / 255 * 1.0,
                    b: 62 / 255 * 1.0
                },
                SUN_STRENGTH: 0.7,
                BIRDS: true
            },
            {
                SKY: "sunrise_1.jpg",
                LM_GRADIENT: "gradient-dawn",
                LM: "lm1",
                LM_FLIP: true,
                FOG_COLOR: {
                    r: 186 / 255,
                    g: 150 / 255,
                    b: 158 / 255
                },
                DISTANT_FOG_COLOR: {
                    r: 186 / 255,
                    g: 150 / 255,
                    b: 158 / 255
                },
                DECO_COLOR: {
                    r: 200 / 255 * 0.3,
                    g: 190 / 255 * 0.3,
                    b: 150 / 255 * 0.3
                },
                SUN_TRANSFORM: {
                    tx: 0,
                    ty: 22000,
                    tz: 100,
                    sx: 0.0,
                    sy: 1,
                    sz: 1
                },
                CLOUDS_COLOR: {
                    r: 235 / 255 * 0.17,
                    g: 162 / 255 * 0.17,
                    b: 48 / 255 * 0.17
                },
                FOG_START_DISTANCE: 1000,
                FOG_DISTANCE: 40000,
                DISTANT_FOG_START_DISTANCE: 18000,
                DISTANT_FOG_DISTANCE: 40000,
                SUN_COLOR: {
                    r: 255 / 255 * 1.0,
                    g: 221 / 255 * 1.0,
                    b: 176 / 255 * 1.0
                },
                SUN_STRENGTH: 0.97,
                BIRDS: true
            }
        ];
        this.currentPreset = 1;
        this.preset = this.PRESETS[this.currentPreset];
        this.SUN_COLOR_FADE = 0.6;
        this.SUN_COLOR = {
            r: 255 * this.SUN_COLOR_FADE / 255,
            g: 229 * this.SUN_COLOR_FADE / 255,
            b: 159 * this.SUN_COLOR_FADE / 255
        };
        this.animationBird = new webgl_framework_1.CombinedAnimation(5);
        this.cameraMode = CameraMode_1.CameraMode.Random;
        this.currentRandomCamera = 0;
        this.matViewInverted = gl_matrix_1.mat4.create();
        this.matViewInvertedTransposed = gl_matrix_1.mat4.create();
        this.matTemp = gl_matrix_1.mat4.create();
        this.cameraPosition = gl_matrix_1.vec3.create();
        this.cameraRotation = gl_matrix_1.vec3.create();
        this.cloudCoordinates = [
            [-9489, -22323, 3733],
            [-3277, -20646, 8186],
            [1122, -20246, 7236],
            [8909, -20443, 8187],
            [9276, -20321, 6082],
            [-1037, -20900, 6255]
        ];
        this.closeCloudCoordinates = [
            [7872, 7144, 2800],
            [4034, 9023, 2069],
            [2122, 8961, 1472],
            [-11135, -8329, 3218],
            [-12732, -3057, 2734]
        ];
        this.CAMERAS = [
            {
                start: {
                    position: new Float32Array([-1112.6859130859375, 729.1329956054688, -239.7705535888672]),
                    rotation: new Float32Array([-0.012000204995274544, 0.9959993362426758, 0])
                },
                end: {
                    position: new Float32Array([645.9349975585938, -18.192354202270508, -228.8282012939453]),
                    rotation: new Float32Array([-0.04800020530819893, 0.27600017189979553, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([-178.7762451171875, -2807.227294921875, 1566.0164794921875]),
                    rotation: new Float32Array([0.7199998497962952, 5.731186866760254, 0.15])
                },
                end: {
                    position: new Float32Array([2632.601318359375, 2175.90234375, 198.9224853515625]),
                    rotation: new Float32Array([0.19800011813640594, 5.041182041168213, 0])
                },
                speedMultiplier: 3.0
            },
            {
                start: {
                    position: new Float32Array([834.5593872070312, -770.0967407226562, -306.2893981933594]),
                    rotation: new Float32Array([-0.1379999965429306, 4.873180866241455, 0])
                },
                end: {
                    position: new Float32Array([674.3294677734375, -139.16824340820312, -332.8673095703125]),
                    rotation: new Float32Array([-0.11400000751018524, 1.1220039129257202, 0])
                },
                speedMultiplier: 0.16
            },
            {
                start: {
                    position: new Float32Array([624.666259765625, -532.7366943359375, -339.30474853515625]),
                    rotation: new Float32Array([-0.3600001633167267, 5.7011799812316895, 0])
                },
                end: {
                    position: new Float32Array([624.666259765625, -532.7366943359375, -339.30474853515625]),
                    rotation: new Float32Array([-0.3600001633167267, 5.011799812316895, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([-283.8520202636719, -2290.094970703125, -266.1039123535156]),
                    rotation: new Float32Array([-0.04199996590614319, 0.28199970722198486, 0])
                },
                end: {
                    position: new Float32Array([1182.0682373046875, 2523.386474609375, 303.9177551269531]),
                    rotation: new Float32Array([-0.029999978840351105, 0.31800538301467896, 0])
                },
                speedMultiplier: 1.2
            },
            {
                start: {
                    position: new Float32Array([-721.6138916015625, 352.1138000488281, -308.95306396484375]),
                    rotation: new Float32Array([0.053999774158000946, 0.8040063977241516, 0])
                },
                end: {
                    position: new Float32Array([430.62530517578125, 1523.1546630859375, 560.4711303710938]),
                    rotation: new Float32Array([1.368000864982605, 0.8580016493797302, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([-233.26089477539062, 1256.260009765625, 597.6262817382812]),
                    rotation: new Float32Array([0.5340001583099365, 1.0919983386993408, -0.4])
                },
                end: {
                    position: new Float32Array([937.0480346679688, 3349.404296875, 476.18017578125]),
                    rotation: new Float32Array([0.5280001759529114, 2.928008556365967, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([945.0444946289062, 301.43560791015625, -222.38575744628906]),
                    rotation: new Float32Array([-0.03599999472498894, 2.8020060062408447, 0])
                },
                end: {
                    position: new Float32Array([-981.968505859375, -945.9314575195312, 3.977069854736328]),
                    rotation: new Float32Array([0.1860000640153885, 2.3399999141693115, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([-1188.12646484375, 1898.4190673828125, 823.771240234375]),
                    rotation: new Float32Array([1.392001748085022, 0.8579999208450317, 0])
                },
                end: {
                    position: new Float32Array([1373.2762451171875, -1064.7838134765625, 823.771240234375]),
                    rotation: new Float32Array([1.392001748085022, 0.8579999208450317, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([1188.5819091796875, -1524.3404541015625, -155.47640991210938]),
                    rotation: new Float32Array([0.22199995815753937, 5.119176387786865, 0])
                },
                end: {
                    position: new Float32Array([624.7249145507812, 1558.1802978515625, 365.2804870605469]),
                    rotation: new Float32Array([0.43800029158592224, 3.781172275543213, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([524.9288940429688, -637.63037109375, -294.49609375]),
                    rotation: new Float32Array([-0.060000333935022354, 4.67284631729126, 0.22])
                },
                end: {
                    position: new Float32Array([-1235.30322265625, -2294.029052734375, -179.30984497070312]),
                    rotation: new Float32Array([-0.024000322446227074, 6.094856262207031, 0])
                },
                speedMultiplier: 1.0
            },
            {
                start: {
                    position: new Float32Array([741.303466796875, -2453.761962890625, 372.46221923828125]),
                    rotation: new Float32Array([1.3500022888183594, 3.8831727504730225, 0])
                },
                end: {
                    position: new Float32Array([-2050.67431640625, 481.10614013671875, 889.6722412109375]),
                    rotation: new Float32Array([1.3500022888183594, 5.8831727504730225, 0])
                },
                speedMultiplier: 0.9
            },
        ];
        this.CAMERA_SPEED = 0.15;
        this.CAMERA_MIN_DURATION = 9000;
        this.cameraPositionInterpolator = new CameraPositionInterpolator_1.CameraPositionInterpolator();
        this.cameraPositionInterpolator.speed = this.CAMERA_SPEED;
        this.cameraPositionInterpolator.minDuration = this.CAMERA_MIN_DURATION;
        this.randomizeCamera();
        document.addEventListener("keypress", event => {
            if (event.key === "1") {
                this.CAMERAS[0].start = {
                    position: new Float32Array([this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2]]),
                    rotation: new Float32Array([this.cameraRotation[0], this.cameraRotation[1], this.cameraRotation[2]]),
                };
                this.logCamera();
            }
            else if (event.key === "2") {
                this.CAMERAS[0].end = {
                    position: new Float32Array([this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2]]),
                    rotation: new Float32Array([this.cameraRotation[0], this.cameraRotation[1], this.cameraRotation[2]]),
                };
                this.logCamera();
            }
        });
    }
    logCamera() {
        const camera = this.CAMERAS[0];
        console.log(`
        {
            start: {
                position: new Float32Array([${camera.start.position.toString()}]),
                rotation: new Float32Array([${camera.start.rotation.toString()}])
            },
            end: {
                position: new Float32Array([${camera.end.position.toString()}]),
                rotation: new Float32Array([${camera.end.rotation.toString()}])
            },
            speedMultiplier: 1.0
        },
        `);
    }
    setCustomCamera(camera, position, rotation) {
        this.customCamera = camera;
        // console.log(position, rotation);
        if (position !== undefined) {
            this.cameraPosition = position;
        }
        if (rotation !== undefined) {
            this.cameraRotation = rotation;
        }
    }
    resetCustomCamera() {
        this.customCamera = undefined;
    }
    onBeforeInit() {
    }
    onAfterInit() {
    }
    onInitError() {
        var _a, _b;
        (_a = document.getElementById("canvasGL")) === null || _a === void 0 ? void 0 : _a.classList.add("hidden");
        (_b = document.getElementById("alertError")) === null || _b === void 0 ? void 0 : _b.classList.remove("hidden");
    }
    initShaders() {
        this.shaderDiffuse = new webgl_framework_1.DiffuseShader(this.gl);
        this.shaderDiffuseColored = new DiffuseColoredShader_1.DiffuseColoredShader(this.gl);
        this.shaderAnimated = new DiffuseATColoredAnimatedShader_1.DiffuseATColoredAnimatedShader(this.gl);
        this.shaderTerrain = TerrainShader_1.TerrainShader.getInstance(this.gl, 0);
        this.shaderTerrainOpposite = TerrainShader_1.TerrainShader.getInstance(this.gl, 1);
        this.shaderTerrainWater = TerrainWaterShader_1.TerrainWaterShader.getInstance(this.gl, 0);
        this.shaderTerrainWaterOpposite = TerrainWaterShader_1.TerrainWaterShader.getInstance(this.gl, 1);
    }
    async loadData() {
        var _a, _b;
        const modelsPromise = Promise.all([
            this.fmSky.load("data/models/sky", this.gl),
            this.fmSmoke.load("data/models/cloud", this.gl),
            this.fmSun.load("data/models/sun_flare", this.gl),
            this.fmBird.load("data/models/bird-anim-uv", this.gl),
            this.fmTerrain.load("data/models/iceland", this.gl),
        ]);
        const texturesPromise = Promise.all([
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/" + this.preset.SKY, this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/" + this.preset.LM_GRADIENT + ".png", this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/smoke.png", this.gl),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/sun_flare.png", this.gl),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/bird2.png", this.gl),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/diffuse.webp", this.gl),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/" + this.preset.LM + ".webp", this.gl, undefined, undefined, true)
        ]);
        const [models, textures] = await Promise.all([modelsPromise, texturesPromise]);
        [
            this.skyTexture,
            this.textureTerrainGradient,
            this.textureCloud,
            this.textureSunFlare,
            this.textureBird,
            this.textureTerrainDiffuse,
            this.textureTerrainLM
        ] = textures;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureTerrainDiffuse);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureTerrainLM);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.loaded = true;
        console.log("Loaded all assets");
        (_a = document.getElementById("message")) === null || _a === void 0 ? void 0 : _a.classList.add("hidden");
        (_b = document.getElementById("canvasGL")) === null || _b === void 0 ? void 0 : _b.classList.remove("transparent");
        setTimeout(() => { var _a; return (_a = document.querySelector(".promo")) === null || _a === void 0 ? void 0 : _a.classList.remove("transparent"); }, 1800);
        setTimeout(() => { var _a; return (_a = document.querySelector("#toggleFullscreen")) === null || _a === void 0 ? void 0 : _a.classList.remove("transparent"); }, 1800);
    }
    async changeTimeOfDay() {
        const newPreset = ++this.currentPreset % this.PRESETS.length;
        const textures = await Promise.all([
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/" + this.PRESETS[newPreset].SKY, this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/" + this.PRESETS[newPreset].LM_GRADIENT + ".png", this.gl, undefined, undefined, true),
            webgl_framework_1.UncompressedTextureLoader.load("data/textures/" + this.PRESETS[newPreset].LM + ".webp", this.gl, undefined, undefined, true),
        ]);
        this.gl.deleteTexture(this.skyTexture);
        this.gl.deleteTexture(this.textureTerrainGradient);
        this.gl.deleteTexture(this.textureTerrainLM);
        [
            this.skyTexture,
            this.textureTerrainGradient,
            this.textureTerrainLM
        ] = textures;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureTerrainLM);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.preset = this.PRESETS[newPreset];
        this.currentPreset = newPreset;
        window.PRESET = this.preset;
    }
    animate() {
        const timeNow = new Date().getTime();
        if (this.lastTime != 0) {
            const elapsed = timeNow - this.lastTime;
            this.angleYaw += elapsed / YAW_COEFF_NORMAL;
            this.angleYaw %= 360.0;
            this.timerDustRotation = (timeNow % this.DUST_ROTATION_SPEED) / this.DUST_ROTATION_SPEED;
            this.timerDustMovement = (timeNow % this.DUST_MOVEMENT_SPEED) / this.DUST_MOVEMENT_SPEED;
            this.timerBirdAnimation1 = (timeNow % this.BIRD_ANIMATION_PERIOD1) / this.BIRD_ANIMATION_PERIOD1;
            this.timerBirdAnimation2 = (timeNow % this.BIRD_ANIMATION_PERIOD2) / this.BIRD_ANIMATION_PERIOD2;
            this.timerBirdsFly = (timeNow % this.BIRD_FLIGHT_PERIOD) / this.BIRD_FLIGHT_PERIOD;
            this.cameraPositionInterpolator.iterate(timeNow);
            if (this.cameraPositionInterpolator.timer === 1.0) {
                this.randomizeCamera();
            }
        }
        this.lastTime = timeNow;
    }
    /** Calculates projection matrix */
    setCameraFOV(multiplier) {
        var ratio;
        if (this.gl.canvas.height > 0) {
            ratio = this.gl.canvas.width / this.gl.canvas.height;
        }
        else {
            ratio = 1.0;
        }
        let fov = 0;
        if (this.gl.canvas.width >= this.gl.canvas.height) {
            fov = FOV_LANDSCAPE * multiplier;
        }
        else {
            fov = FOV_PORTRAIT * multiplier;
        }
        this.setFOV(this.mProjMatrix, fov, ratio, this.Z_NEAR, this.Z_FAR);
    }
    /**
     * Calculates camera matrix.
     *
     * @param a Position in [0...1] range
     */
    positionCamera(a) {
        if (this.customCamera !== undefined) {
            this.mVMatrix = this.customCamera;
            return;
        }
        if (this.cameraMode === CameraMode_1.CameraMode.Random) {
            this.mVMatrix = this.cameraPositionInterpolator.matrix;
            this.cameraPosition[0] = this.cameraPositionInterpolator.cameraPosition[0];
            this.cameraPosition[1] = this.cameraPositionInterpolator.cameraPosition[1];
            this.cameraPosition[2] = this.cameraPositionInterpolator.cameraPosition[2];
        }
        else {
            this.cameraPosition[0] = 0;
            this.cameraPosition[1] = 0;
            this.cameraPosition[2] = 200;
            gl_matrix_1.mat4.lookAt(this.mVMatrix, this.cameraPosition, // eye
            [1000, 0, 0], // center
            [0, 0, 1] // up vector
            );
            gl_matrix_1.mat4.rotate(this.mVMatrix, this.mVMatrix, (this.angleYaw + 280) / 160.0 * 6.2831852, [0, 0, 1]);
        }
    }
    /** Issues actual draw calls */
    drawScene() {
        if (!this.loaded) {
            return;
        }
        this.positionCamera(0.0);
        this.setCameraFOV(1.0);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.colorMask(true, true, true, true);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null); // This differs from OpenGL ES
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.drawSceneObjects();
    }
    setTerrainShaderUniforms(shader) {
        this.setTexture2D(0, this.textureTerrainDiffuse, shader.sTexture);
        this.setTexture2D(1, this.textureTerrainLM, shader.sLM);
        this.setTexture2D(2, this.textureTerrainGradient, shader.sGradient);
        this.gl.uniform4f(shader.uFogColor, this.preset.FOG_COLOR.r, this.preset.FOG_COLOR.g, this.preset.FOG_COLOR.b, 1.0);
        this.gl.uniform1f(shader.fogStartDistance, this.preset.FOG_START_DISTANCE);
        this.gl.uniform1f(shader.fogDistance, this.preset.FOG_DISTANCE);
    }
    setTerrainWaterShaderUniforms(shader) {
        this.setTexture2D(0, this.textureTerrainDiffuse, shader.sTexture);
        this.setTexture2D(1, this.textureTerrainLM, shader.sLM);
        this.setTexture2D(2, this.textureTerrainGradient, shader.sGradient);
        this.gl.uniform4f(shader.uFogColor, this.preset.FOG_COLOR.r, this.preset.FOG_COLOR.g, this.preset.FOG_COLOR.b, 1.0);
        this.gl.uniform1f(shader.fogStartDistance, this.preset.FOG_START_DISTANCE);
        this.gl.uniform1f(shader.fogDistance, this.preset.FOG_DISTANCE);
        this.gl.uniformMatrix4fv(shader.model_matrix, false, this.getModelMatrix());
        this.gl.uniform3f(shader.viewPos, this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2]);
        this.gl.uniform3f(shader.lightPos, this.preset.SUN_TRANSFORM.tx, this.preset.SUN_TRANSFORM.ty, this.preset.SUN_TRANSFORM.tz);
        this.gl.uniform4f(shader.lightColor, this.preset.SUN_COLOR.r, this.preset.SUN_COLOR.g, this.preset.SUN_COLOR.b, 1.0);
        this.gl.uniform1f(shader.specularStrength, this.preset.SUN_STRENGTH);
    }
    drawSceneObjects() {
        if (this.shaderDiffuse === undefined
            || this.shaderDiffuseColored === undefined
            || this.shaderTerrain === undefined
            || this.shaderTerrainOpposite === undefined
            || this.shaderTerrainWater === undefined
            || this.shaderTerrainWaterOpposite === undefined) {
            console.log("undefined shaders");
            return;
        }
        const shaderMainTerrain = this.preset.LM_FLIP ? this.shaderTerrainWaterOpposite : this.shaderTerrainWater;
        const shader1 = this.preset.LM_FLIP ? this.shaderTerrainOpposite : this.shaderTerrain;
        const shader2 = this.preset.LM_FLIP ? this.shaderTerrain : this.shaderTerrainOpposite;
        const TERRAIN_SIZE = 5.42;
        const SKIRT_SCALE = 1.3;
        const SKIRT_OFFSET = TERRAIN_SIZE * TERRAIN_SCALE / 2 + (TERRAIN_SIZE * TERRAIN_SCALE / 2 * SKIRT_SCALE);
        this.gl.disable(this.gl.BLEND);
        if (this.preset.BIRDS) {
            this.drawBirds(-100, 0);
            this.drawBirds(-80, 60);
            this.drawBirds(-90, 99);
        }
        this.calculateMVPMatrix(0, 0, 0, 0, 0, 0, TERRAIN_SCALE, TERRAIN_SCALE, TERRAIN_SCALE);
        shaderMainTerrain.use();
        this.setTerrainWaterShaderUniforms(shaderMainTerrain);
        shaderMainTerrain.drawModel(this, this.fmTerrain, 0, 0, 0, 0, 0, 0, TERRAIN_SCALE, TERRAIN_SCALE, TERRAIN_SCALE);
        shader1.use();
        this.setTerrainShaderUniforms(shader1);
        this.gl.cullFace(this.gl.FRONT);
        shader1.drawModel(this, this.fmTerrain, SKIRT_OFFSET, 0, 0, 0, 0, 0, -TERRAIN_SCALE * SKIRT_SCALE, TERRAIN_SCALE, TERRAIN_SCALE);
        shader1.drawModel(this, this.fmTerrain, -SKIRT_OFFSET, 0, 0, 0, 0, 0, -TERRAIN_SCALE * SKIRT_SCALE, TERRAIN_SCALE, TERRAIN_SCALE);
        shader2.use();
        this.setTerrainShaderUniforms(shader2);
        shader2.drawModel(this, this.fmTerrain, 0, SKIRT_OFFSET, 0, 0, 0, 0, TERRAIN_SCALE, -TERRAIN_SCALE * SKIRT_SCALE, TERRAIN_SCALE);
        shader2.drawModel(this, this.fmTerrain, 0, -SKIRT_OFFSET, 0, 0, 0, 0, TERRAIN_SCALE, -TERRAIN_SCALE * SKIRT_SCALE, TERRAIN_SCALE);
        this.gl.cullFace(this.gl.BACK);
        shader2.drawModel(this, this.fmTerrain, SKIRT_OFFSET, SKIRT_OFFSET, 0, 0, 0, 0, -TERRAIN_SCALE * SKIRT_SCALE, -TERRAIN_SCALE * SKIRT_SCALE, TERRAIN_SCALE);
        shader2.drawModel(this, this.fmTerrain, -SKIRT_OFFSET, -SKIRT_OFFSET, 0, 0, 0, 0, -TERRAIN_SCALE * SKIRT_SCALE, -TERRAIN_SCALE * SKIRT_SCALE, TERRAIN_SCALE);
        shader2.drawModel(this, this.fmTerrain, SKIRT_OFFSET, -SKIRT_OFFSET, 0, 0, 0, 0, -TERRAIN_SCALE * SKIRT_SCALE, -TERRAIN_SCALE * SKIRT_SCALE, TERRAIN_SCALE);
        shader2.drawModel(this, this.fmTerrain, -SKIRT_OFFSET, SKIRT_OFFSET, 0, 0, 0, 0, -TERRAIN_SCALE * SKIRT_SCALE, -TERRAIN_SCALE * SKIRT_SCALE, TERRAIN_SCALE);
        // Distant mountains
        shader1.use();
        this.setTerrainShaderUniforms(shader1);
        this.gl.uniform4f(shader1.uFogColor, this.preset.DISTANT_FOG_COLOR.r, this.preset.DISTANT_FOG_COLOR.g, this.preset.DISTANT_FOG_COLOR.b, 1.0);
        this.gl.uniform1f(shader1.fogStartDistance, this.preset.DISTANT_FOG_START_DISTANCE);
        this.gl.uniform1f(shader1.fogDistance, this.preset.DISTANT_FOG_DISTANCE);
        shader1.drawModel(this, this.fmTerrain, 0, 0, 0, 0, 0, 0, TERRAIN_SCALE * 9.5, TERRAIN_SCALE * 9.5, TERRAIN_SCALE * 13);
        this.shaderDiffuse.use();
        this.setTexture2D(0, this.skyTexture, this.shaderDiffuse.sTexture);
        this.shaderDiffuse.drawModel(this, this.fmSky, 0, 0, -1200, 0, 0, 0, 150, 150, 150);
        this.drawClouds();
        this.drawSun();
    }
    drawClouds() {
        if (this.shaderDiffuseColored === undefined) {
            console.log("undefined shaders");
            return;
        }
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_COLOR);
        this.gl.depthMask(false);
        this.shaderDiffuseColored.use();
        this.setTexture2D(0, this.textureCloud, this.shaderDiffuseColored.sTexture);
        for (let i = 0; i < this.cloudCoordinates.length; i++) {
            const coordinates = this.cloudCoordinates[i];
            const timer = (this.timerDustMovement + i * 13.37) % 1.0;
            const x = coordinates[0]; // + timer * this.DUST_TRAVEL_X;
            const y = coordinates[1] + timer * this.CLOUD_TRAVEL_Y;
            const z = coordinates[2];
            const opacity = this.smootherstep(0.01, 0.3, timer) * (1 - this.smootherstep(0.7, 0.99, timer));
            this.gl.uniform4f(this.shaderDiffuseColored.color, this.preset.CLOUDS_COLOR.r * opacity, this.preset.CLOUDS_COLOR.g * opacity, this.preset.CLOUDS_COLOR.b * opacity, 1);
            this.drawDiffuseVBOFacingCamera(this.shaderDiffuseColored, this.fmSmoke, x, y, z, 80, 1, 1, 0);
        }
        for (let i = 0; i < this.closeCloudCoordinates.length; i++) {
            const coordinates = this.closeCloudCoordinates[i];
            const timer = (this.timerDustMovement + i * 13.37) % 1.0;
            const x = coordinates[0]; // + timer * this.DUST_TRAVEL_X;
            const y = coordinates[1] + timer * this.CLOUD_TRAVEL_Y * 0.1;
            const z = coordinates[2];
            const opacity = this.smootherstep(0.01, 0.3, timer) * (1 - this.smootherstep(0.7, 0.99, timer));
            this.gl.uniform4f(this.shaderDiffuseColored.color, this.preset.CLOUDS_COLOR.r * 1.3 * opacity, this.preset.CLOUDS_COLOR.g * 1.3 * opacity, this.preset.CLOUDS_COLOR.b * 1.3 * opacity, 1);
            this.drawDiffuseVBOFacingCamera(this.shaderDiffuseColored, this.fmSmoke, x, y, z, 50, 1, 1, 0);
        }
        this.gl.disable(this.gl.BLEND);
        this.gl.depthMask(true);
    }
    drawBirds(z, angleOffset) {
        var _a, _b, _c, _d, _e;
        this.gl.disable(this.gl.CULL_FACE);
        (_a = this.shaderAnimated) === null || _a === void 0 ? void 0 : _a.use();
        this.setTexture2D(0, this.textureBird, this.shaderAnimated.msTextureHandle);
        this.gl.uniform4f(this.shaderAnimated.color, this.preset.DECO_COLOR.r, this.preset.DECO_COLOR.g, this.preset.DECO_COLOR.b, 1.0);
        const scale1 = 2;
        const scale2 = 2.5;
        const angle = angleOffset + this.timerBirdsFly * Math.PI * 2;
        const angle2 = angleOffset + 70 + this.timerBirdsFly * Math.PI * 2;
        const bird1 = this.getBirdPosition(this.BIRD_FLIGHT_RADIUS, angle, this.BIRD_SPREAD, 0);
        const bird2 = this.getBirdPosition(this.BIRD_FLIGHT_RADIUS, -angle - Math.PI, -this.BIRD_SPREAD, 0);
        const bird3 = this.getBirdPosition(this.BIRD_FLIGHT_RADIUS * 0.8, angle2, 0, this.BIRD_SPREAD);
        const bird4 = this.getBirdPosition(this.BIRD_FLIGHT_RADIUS * 0.8, -angle2 - Math.PI, 0, -this.BIRD_SPREAD);
        this.animationBird.animate(this.timerBirdAnimation1);
        (_b = this.shaderAnimated) === null || _b === void 0 ? void 0 : _b.drawModel(this, this.fmBird, this.animationBird.getFramesCount(), this.animationBird.getStart(), this.animationBird.getEnd(), this.animationBird.getCurrentCoeff(), bird1.x, bird1.y, z + 10, 0, 0, -angle - Math.PI * 0.5, scale1, scale1, scale1);
        (_c = this.shaderAnimated) === null || _c === void 0 ? void 0 : _c.drawModel(this, this.fmBird, this.animationBird.getFramesCount(), this.animationBird.getStart(), this.animationBird.getEnd(), this.animationBird.getCurrentCoeff(), bird3.x, bird3.y, z + 15, 0, 0, -angle2 - Math.PI * 0.5, scale2, scale2, scale2);
        this.animationBird.animate(this.timerBirdAnimation2);
        (_d = this.shaderAnimated) === null || _d === void 0 ? void 0 : _d.drawModel(this, this.fmBird, this.animationBird.getFramesCount(), this.animationBird.getStart(), this.animationBird.getEnd(), this.animationBird.getCurrentCoeff(), bird2.x, bird2.y, z + 20, 0, 0, angle + Math.PI * 1.5, scale1, scale1, scale1);
        (_e = this.shaderAnimated) === null || _e === void 0 ? void 0 : _e.drawModel(this, this.fmBird, this.animationBird.getFramesCount(), this.animationBird.getStart(), this.animationBird.getEnd(), this.animationBird.getCurrentCoeff(), bird4.x, bird4.y, z + 25, 0, 0, angle2 + Math.PI * 1.5, scale2, scale2, scale2);
        this.gl.enable(this.gl.CULL_FACE);
    }
    getBirdPosition(radius, angle, centerX, centerY) {
        const x = Math.sin(angle) * radius + centerX;
        const y = Math.cos(angle) * radius + centerY;
        return { x, y };
    }
    drawDiffuseVBOFacingCamera(shader, model, tx, ty, tz, sx, sy, sz, rotation) {
        model.bindBuffers(this.gl);
        this.gl.enableVertexAttribArray(shader.rm_Vertex);
        this.gl.enableVertexAttribArray(shader.rm_TexCoord0);
        this.gl.vertexAttribPointer(shader.rm_Vertex, 3, this.gl.FLOAT, false, 4 * (3 + 2), 0);
        this.gl.vertexAttribPointer(shader.rm_TexCoord0, 2, this.gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        this.calculateMVPMatrixForSprite(tx, ty, tz, sx, sy, sz, rotation);
        this.gl.uniformMatrix4fv(shader.view_proj_matrix, false, this.mMVPMatrix);
        this.gl.drawElements(this.gl.TRIANGLES, model.getNumIndices() * 3, this.gl.UNSIGNED_SHORT, 0);
        this.checkGlError("glDrawElements");
    }
    calculateMVPMatrixForSprite(tx, ty, tz, sx, sy, sz, rotation) {
        gl_matrix_1.mat4.identity(this.mMMatrix);
        gl_matrix_1.mat4.translate(this.mMMatrix, this.mMMatrix, [tx, ty, tz]);
        gl_matrix_1.mat4.scale(this.mMMatrix, this.mMMatrix, [sx, sy, sz]);
        gl_matrix_1.mat4.multiply(this.mMVPMatrix, this.mVMatrix, this.mMMatrix);
        this.resetMatrixRotations(this.mMVPMatrix);
        gl_matrix_1.mat4.rotateZ(this.mMVPMatrix, this.mMVPMatrix, rotation);
        gl_matrix_1.mat4.multiply(this.mMVPMatrix, this.mProjMatrix, this.mMVPMatrix);
    }
    resetMatrixRotations(matrix) {
        const d = Math.sqrt(matrix[0] * matrix[0] + matrix[1] * matrix[1] + matrix[2] * matrix[2]);
        matrix[0] = d;
        matrix[4] = 0;
        matrix[8] = 0;
        matrix[1] = 0;
        matrix[5] = d;
        matrix[9] = 0;
        matrix[2] = 0;
        matrix[6] = 0;
        matrix[10] = d;
        matrix[3] = 0;
        matrix[7] = 0;
        matrix[11] = 0;
        matrix[15] = 1;
    }
    drawSun() {
        var _a;
        this.gl.enable(this.gl.BLEND);
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
        this.gl.depthMask(false);
        (_a = this.shaderDiffuseColored) === null || _a === void 0 ? void 0 : _a.use();
        this.setTexture2D(0, this.textureSunFlare, this.shaderDiffuseColored.sTexture);
        this.gl.uniform4f(this.shaderDiffuseColored.color, this.SUN_COLOR.r, this.SUN_COLOR.g, this.SUN_COLOR.b, 1.0);
        this.drawDiffuseVBOFacingCamera(this.shaderDiffuseColored, this.fmSun, this.preset.SUN_TRANSFORM.tx, this.preset.SUN_TRANSFORM.ty, this.preset.SUN_TRANSFORM.tz, this.preset.SUN_TRANSFORM.sx, this.preset.SUN_TRANSFORM.sy, this.preset.SUN_TRANSFORM.sz, this.timerDustRotation * Math.PI * 2);
        this.gl.disable(this.gl.BLEND);
        this.gl.depthMask(true);
    }
    clamp(i, low, high) {
        return Math.max(Math.min(i, high), low);
    }
    smoothstep(edge0, edge1, x) {
        const t = this.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
        return t * t * (3.0 - 2.0 * t);
    }
    smootherstep(edge0, edge1, x) {
        x = this.clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
        return x * x * x * (x * (x * 6 - 15) + 10);
    }
    randomizeCamera() {
        this.currentRandomCamera = (this.currentRandomCamera + 1 + Math.trunc(Math.random() * (this.CAMERAS.length - 2))) % this.CAMERAS.length;
        this.cameraPositionInterpolator.reverse = Math.random() < 0.5;
        this.cameraPositionInterpolator.speed = this.CAMERA_SPEED * this.CAMERAS[this.currentRandomCamera].speedMultiplier;
        this.cameraPositionInterpolator.position = this.CAMERAS[this.currentRandomCamera];
        this.cameraPositionInterpolator.reset();
    }
    checkGlError(operation) {
        // Do nothing in production build.
    }
}
exports.MountainsRenderer = MountainsRenderer;
//# sourceMappingURL=MountainsRenderer.js.map