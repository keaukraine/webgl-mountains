class FullScreenUtils {
    /** Enters fullscreen. */
    enterFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen({ navigationUI: "hide" });
        }
    }
    /** Exits fullscreen */
    exitFullScreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    /**
     * Adds cross-browser fullscreenchange event
     *
     * @param exitHandler Function to be called on fullscreenchange event
     */
    addFullScreenListener(exitHandler) {
        document.addEventListener("fullscreenchange", exitHandler, false);
    }
    /**
     * Checks fullscreen state.
     *
     * @return `true` if fullscreen is active, `false` if not
     */
    isFullScreen() {
        return !!document.fullscreenElement;
    }
}

class BinaryDataLoader {
    static async load(url) {
        const response = await fetch(url);
        return response.arrayBuffer();
    }
}

class UncompressedTextureLoader {
    static load(url, gl, minFilter = gl.LINEAR, magFilter = gl.LINEAR, clamp = false) {
        return new Promise((resolve, reject) => {
            const texture = gl.createTexture();
            if (texture === null) {
                reject("Error creating WebGL texture");
                return;
            }
            const image = new Image();
            image.src = url;
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
                if (clamp === true) {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                }
                else {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                }
                gl.bindTexture(gl.TEXTURE_2D, null);
                if (image && image.src) {
                    console.log(`Loaded texture ${url} [${image.width}x${image.height}]`);
                }
                resolve(texture);
            };
            image.onerror = () => reject("Cannot load image");
        });
    }
    static async loadCubemap(url, gl) {
        const texture = gl.createTexture();
        if (texture === null) {
            throw new Error("Error creating WebGL texture");
        }
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        const promises = [
            { type: gl.TEXTURE_CUBE_MAP_POSITIVE_X, suffix: "-posx.png" },
            { type: gl.TEXTURE_CUBE_MAP_NEGATIVE_X, suffix: "-negx.png" },
            { type: gl.TEXTURE_CUBE_MAP_POSITIVE_Y, suffix: "-posy.png" },
            { type: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, suffix: "-negy.png" },
            { type: gl.TEXTURE_CUBE_MAP_POSITIVE_Z, suffix: "-posz.png" },
            { type: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, suffix: "-negz.png" }
        ].map(face => new Promise((resolve, reject) => {
            const image = new Image();
            image.src = url + face.suffix;
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
                gl.texImage2D(face.type, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                if (image && image.src) {
                    console.log(`Loaded texture ${url}${face.suffix} [${image.width}x${image.height}]`);
                }
                resolve();
            };
            image.onerror = () => reject("Cannot load image");
        }));
        await Promise.all(promises);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture;
    }
}

class FullModel {
    /** Default constructor. */
    constructor() {
        /** Number of model indices. */
        this.numIndices = 0;
    }
    loadBuffer(gl, buffer, target, arrayBuffer) {
        var byteArray = new Uint8Array(arrayBuffer, 0, arrayBuffer.byteLength);
        gl.bindBuffer(target, buffer);
        gl.bufferData(target, byteArray, gl.STATIC_DRAW);
    }
    /**
     * Loads model.
     *
     * @param url Base URL to model indices and strides files.
     * @param gl WebGL context.
     * @returns Promise which resolves when model is loaded.
     */
    async load(url, gl) {
        const dataIndices = await BinaryDataLoader.load(url + "-indices.bin");
        const dataStrides = await BinaryDataLoader.load(url + "-strides.bin");
        console.log(`Loaded ${url}-indices.bin (${dataIndices.byteLength} bytes)`);
        console.log(`Loaded ${url}-strides.bin (${dataStrides.byteLength} bytes)`);
        this.bufferIndices = gl.createBuffer();
        this.loadBuffer(gl, this.bufferIndices, gl.ELEMENT_ARRAY_BUFFER, dataIndices);
        this.numIndices = dataIndices.byteLength / 2 / 3;
        this.bufferStrides = gl.createBuffer();
        this.loadBuffer(gl, this.bufferStrides, gl.ARRAY_BUFFER, dataStrides);
    }
    /**
     * Binds buffers for a `glDrawElements()` call.
     *
     * @param gl WebGL context.
     */
    bindBuffers(gl) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferStrides);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferIndices);
    }
    /**
     * Returns number of indices in model.
     *
     * @return Number of indices
     */
    getNumIndices() {
        return this.numIndices;
    }
}

class BaseShader {
    /**
     * Constructor. Compiles shader.
     *
     * @param gl WebGL context.
     */
    constructor(gl) {
        this.gl = gl;
        this.vertexShaderCode = "";
        this.fragmentShaderCode = "";
        this.fillCode();
        this.initShader();
    }
    /**
     * Creates WebGL shader from code.
     *
     * @param type Shader type.
     * @param code GLSL code.
     * @returns Shader or `undefined` if there were errors during shader compilation.
     */
    getShader(type, code) {
        const shader = this.gl.createShader(type);
        if (!shader) {
            console.warn('Error creating shader.');
            return undefined;
        }
        this.gl.shaderSource(shader, code);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.warn(this.gl.getShaderInfoLog(shader));
            return undefined;
        }
        return shader;
    }
    /**
     * Get shader unform location.
     *
     * @param uniform Uniform name.
     * @return Uniform location.
     */
    getUniform(uniform) {
        if (this.program === undefined) {
            throw new Error('No program for shader.');
        }
        const result = this.gl.getUniformLocation(this.program, uniform);
        if (result !== null) {
            return result;
        }
        else {
            throw new Error(`Cannot get uniform "${uniform}".`);
        }
    }
    /**
     * Get shader attribute location.
     *
     * @param attrib Attribute name.
     * @return Attribute location.
     */
    getAttrib(attrib) {
        if (this.program === undefined) {
            throw new Error("No program for shader.");
        }
        return this.gl.getAttribLocation(this.program, attrib);
    }
    /** Initializes shader. */
    initShader() {
        const fragmentShader = this.getShader(this.gl.FRAGMENT_SHADER, this.fragmentShaderCode);
        const vertexShader = this.getShader(this.gl.VERTEX_SHADER, this.vertexShaderCode);
        const shaderProgram = this.gl.createProgram();
        if (fragmentShader === undefined || vertexShader === undefined || shaderProgram === null) {
            return;
        }
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);
        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            console.warn(this.constructor.name + ": Could not initialise shader");
        }
        else {
            console.log(this.constructor.name + ": Initialised shader");
        }
        this.gl.useProgram(shaderProgram);
        this.program = shaderProgram;
        this.fillUniformsAttributes();
    }
    /** Activates shader. */
    use() {
        if (this.program) {
            this.gl.useProgram(this.program);
        }
    }
    /** Deletes shader. */
    deleteProgram() {
        if (this.program) {
            this.gl.deleteProgram(this.program);
        }
    }
}

/**
 * Common utilities
 * @module glMatrix
 */
// Configuration Constants
var EPSILON = 0.000001;
var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

/**
 * 3x3 Matrix
 * @module mat3
 */

/**
 * Creates a new identity mat3
 *
 * @returns {mat3} a new 3x3 matrix
 */

function create$2() {
  var out = new ARRAY_TYPE(9);

  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
  }

  out[0] = 1;
  out[4] = 1;
  out[8] = 1;
  return out;
}

/**
 * 4x4 Matrix<br>Format: column-major, when typed out it looks like row-major<br>The matrices are being post multiplied.
 * @module mat4
 */

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */

function create$3() {
  var out = new ARRAY_TYPE(16);

  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
  }

  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */

function identity$3(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
/**
 * Multiplies two mat4s
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the first operand
 * @param {ReadonlyMat4} b the second operand
 * @returns {mat4} out
 */

function multiply$3(out, a, b) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3];
  var a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7];
  var a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11];
  var a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15]; // Cache only the current line of the second matrix

  var b0 = b[0],
      b1 = b[1],
      b2 = b[2],
      b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to translate
 * @param {ReadonlyVec3} v vector to translate by
 * @returns {mat4} out
 */

function translate$2(out, a, v) {
  var x = v[0],
      y = v[1],
      z = v[2];
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;

  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  } else {
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11];
    out[0] = a00;
    out[1] = a01;
    out[2] = a02;
    out[3] = a03;
    out[4] = a10;
    out[5] = a11;
    out[6] = a12;
    out[7] = a13;
    out[8] = a20;
    out[9] = a21;
    out[10] = a22;
    out[11] = a23;
    out[12] = a00 * x + a10 * y + a20 * z + a[12];
    out[13] = a01 * x + a11 * y + a21 * z + a[13];
    out[14] = a02 * x + a12 * y + a22 * z + a[14];
    out[15] = a03 * x + a13 * y + a23 * z + a[15];
  }

  return out;
}
/**
 * Scales the mat4 by the dimensions in the given vec3 not using vectorization
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to scale
 * @param {ReadonlyVec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/

function scale$3(out, a, v) {
  var x = v[0],
      y = v[1],
      z = v[2];
  out[0] = a[0] * x;
  out[1] = a[1] * x;
  out[2] = a[2] * x;
  out[3] = a[3] * x;
  out[4] = a[4] * y;
  out[5] = a[5] * y;
  out[6] = a[6] * y;
  out[7] = a[7] * y;
  out[8] = a[8] * z;
  out[9] = a[9] * z;
  out[10] = a[10] * z;
  out[11] = a[11] * z;
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
/**
 * Rotates a mat4 by the given angle around the given axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {ReadonlyVec3} axis the axis to rotate around
 * @returns {mat4} out
 */

function rotate$3(out, a, rad, axis) {
  var x = axis[0],
      y = axis[1],
      z = axis[2];
  var len = Math.hypot(x, y, z);
  var s, c, t;
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;
  var b00, b01, b02;
  var b10, b11, b12;
  var b20, b21, b22;

  if (len < EPSILON) {
    return null;
  }

  len = 1 / len;
  x *= len;
  y *= len;
  z *= len;
  s = Math.sin(rad);
  c = Math.cos(rad);
  t = 1 - c;
  a00 = a[0];
  a01 = a[1];
  a02 = a[2];
  a03 = a[3];
  a10 = a[4];
  a11 = a[5];
  a12 = a[6];
  a13 = a[7];
  a20 = a[8];
  a21 = a[9];
  a22 = a[10];
  a23 = a[11]; // Construct the elements of the rotation matrix

  b00 = x * x * t + c;
  b01 = y * x * t + z * s;
  b02 = z * x * t - y * s;
  b10 = x * y * t - z * s;
  b11 = y * y * t + c;
  b12 = z * y * t + x * s;
  b20 = x * z * t + y * s;
  b21 = y * z * t - x * s;
  b22 = z * z * t + c; // Perform rotation-specific matrix multiplication

  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22;

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }

  return out;
}
/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateX(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateY(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateZ(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c + a10 * s;
  out[1] = a01 * c + a11 * s;
  out[2] = a02 * c + a12 * s;
  out[3] = a03 * c + a13 * s;
  out[4] = a10 * c - a00 * s;
  out[5] = a11 * c - a01 * s;
  out[6] = a12 * c - a02 * s;
  out[7] = a13 * c - a03 * s;
  return out;
}
/**
 * Generates a frustum matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {mat4} out
 */

function frustum(out, left, right, bottom, top, near, far) {
  var rl = 1 / (right - left);
  var tb = 1 / (top - bottom);
  var nf = 1 / (near - far);
  out[0] = near * 2 * rl;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = near * 2 * tb;
  out[6] = 0;
  out[7] = 0;
  out[8] = (right + left) * rl;
  out[9] = (top + bottom) * tb;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = far * near * 2 * nf;
  out[15] = 0;
  return out;
}

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */

function create$4() {
  var out = new ARRAY_TYPE(3);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}
/**
 * Calculates the length of a vec3
 *
 * @param {ReadonlyVec3} a vector to calculate length of
 * @returns {Number} length of a
 */

function length(a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  return Math.hypot(x, y, z);
}
/**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */

function fromValues$4(x, y, z) {
  var out = new ARRAY_TYPE(3);
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to normalize
 * @returns {vec3} out
 */

function normalize(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len = x * x + y * y + z * z;

  if (len > 0) {
    //TODO: evaluate use of glm_invsqrt here?
    len = 1 / Math.sqrt(len);
  }

  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}
/**
 * Calculates the dot product of two vec3's
 *
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {Number} dot product of a and b
 */

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function cross(out, a, b) {
  var ax = a[0],
      ay = a[1],
      az = a[2];
  var bx = b[0],
      by = b[1],
      bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
/**
 * Alias for {@link vec3.length}
 * @function
 */

var len = length;
/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

var forEach = function () {
  var vec = create$4();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 3;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }

    return a;
  };
}();

/**
 * 4 Dimensional Vector
 * @module vec4
 */

/**
 * Creates a new, empty vec4
 *
 * @returns {vec4} a new 4D vector
 */

function create$5() {
  var out = new ARRAY_TYPE(4);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }

  return out;
}
/**
 * Normalize a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {ReadonlyVec4} a vector to normalize
 * @returns {vec4} out
 */

function normalize$1(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var w = a[3];
  var len = x * x + y * y + z * z + w * w;

  if (len > 0) {
    len = 1 / Math.sqrt(len);
  }

  out[0] = x * len;
  out[1] = y * len;
  out[2] = z * len;
  out[3] = w * len;
  return out;
}
/**
 * Perform some operation over an array of vec4s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec4s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

var forEach$1 = function () {
  var vec = create$5();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 4;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      vec[3] = a[i + 3];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
      a[i + 3] = vec[3];
    }

    return a;
  };
}();

/**
 * Quaternion
 * @module quat
 */

/**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */

function create$6() {
  var out = new ARRAY_TYPE(4);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  out[3] = 1;
  return out;
}
/**
 * Sets a quat from the given angle and rotation axis,
 * then returns it.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyVec3} axis the axis around which to rotate
 * @param {Number} rad the angle in radians
 * @returns {quat} out
 **/

function setAxisAngle(out, axis, rad) {
  rad = rad * 0.5;
  var s = Math.sin(rad);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(rad);
  return out;
}
/**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat} out
 */

function slerp(out, a, b, t) {
  // benchmarks:
  //    http://jsperf.com/quaternion-slerp-implementations
  var ax = a[0],
      ay = a[1],
      az = a[2],
      aw = a[3];
  var bx = b[0],
      by = b[1],
      bz = b[2],
      bw = b[3];
  var omega, cosom, sinom, scale0, scale1; // calc cosine

  cosom = ax * bx + ay * by + az * bz + aw * bw; // adjust signs (if necessary)

  if (cosom < 0.0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  } // calculate coefficients


  if (1.0 - cosom > EPSILON) {
    // standard case (slerp)
    omega = Math.acos(cosom);
    sinom = Math.sin(omega);
    scale0 = Math.sin((1.0 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    // "from" and "to" quaternions are very close
    //  ... so we can do a linear interpolation
    scale0 = 1.0 - t;
    scale1 = t;
  } // calculate final values


  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
}
/**
 * Creates a quaternion from the given 3x3 rotation matrix.
 *
 * NOTE: The resultant quaternion is not normalized, so you should be sure
 * to renormalize the quaternion yourself where necessary.
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyMat3} m rotation matrix
 * @returns {quat} out
 * @function
 */

function fromMat3(out, m) {
  // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
  // article "Quaternion Calculus and Fast Animation".
  var fTrace = m[0] + m[4] + m[8];
  var fRoot;

  if (fTrace > 0.0) {
    // |w| > 1/2, may as well choose w > 1/2
    fRoot = Math.sqrt(fTrace + 1.0); // 2w

    out[3] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot; // 1/(4w)

    out[0] = (m[5] - m[7]) * fRoot;
    out[1] = (m[6] - m[2]) * fRoot;
    out[2] = (m[1] - m[3]) * fRoot;
  } else {
    // |w| <= 1/2
    var i = 0;
    if (m[4] > m[0]) i = 1;
    if (m[8] > m[i * 3 + i]) i = 2;
    var j = (i + 1) % 3;
    var k = (i + 2) % 3;
    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1.0);
    out[i] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
  }

  return out;
}
/**
 * Normalize a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a quaternion to normalize
 * @returns {quat} out
 * @function
 */

var normalize$2 = normalize$1;
/**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {ReadonlyVec3} a the initial vector
 * @param {ReadonlyVec3} b the destination vector
 * @returns {quat} out
 */

var rotationTo = function () {
  var tmpvec3 = create$4();
  var xUnitVec3 = fromValues$4(1, 0, 0);
  var yUnitVec3 = fromValues$4(0, 1, 0);
  return function (out, a, b) {
    var dot$$1 = dot(a, b);

    if (dot$$1 < -0.999999) {
      cross(tmpvec3, xUnitVec3, a);
      if (len(tmpvec3) < 0.000001) cross(tmpvec3, yUnitVec3, a);
      normalize(tmpvec3, tmpvec3);
      setAxisAngle(out, tmpvec3, Math.PI);
      return out;
    } else if (dot$$1 > 0.999999) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      out[3] = 1;
      return out;
    } else {
      cross(tmpvec3, a, b);
      out[0] = tmpvec3[0];
      out[1] = tmpvec3[1];
      out[2] = tmpvec3[2];
      out[3] = 1 + dot$$1;
      return normalize$2(out, out);
    }
  };
}();
/**
 * Performs a spherical linear interpolation with two control points
 *
 * @param {quat} out the receiving quaternion
 * @param {ReadonlyQuat} a the first operand
 * @param {ReadonlyQuat} b the second operand
 * @param {ReadonlyQuat} c the third operand
 * @param {ReadonlyQuat} d the fourth operand
 * @param {Number} t interpolation amount, in the range [0-1], between the two inputs
 * @returns {quat} out
 */

var sqlerp = function () {
  var temp1 = create$6();
  var temp2 = create$6();
  return function (out, a, b, c, d, t) {
    slerp(temp1, a, d, t);
    slerp(temp2, b, c, t);
    slerp(out, temp1, temp2, 2 * t * (1 - t));
    return out;
  };
}();
/**
 * Sets the specified quaternion with values corresponding to the given
 * axes. Each axis is a vec3 and is expected to be unit length and
 * perpendicular to all other specified axes.
 *
 * @param {ReadonlyVec3} view  the vector representing the viewing direction
 * @param {ReadonlyVec3} right the vector representing the local "right" direction
 * @param {ReadonlyVec3} up    the vector representing the local "up" direction
 * @returns {quat} out
 */

var setAxes = function () {
  var matr = create$2();
  return function (out, view, right, up) {
    matr[0] = right[0];
    matr[3] = right[1];
    matr[6] = right[2];
    matr[1] = up[0];
    matr[4] = up[1];
    matr[7] = up[2];
    matr[2] = -view[0];
    matr[5] = -view[1];
    matr[8] = -view[2];
    return normalize$2(out, fromMat3(out, matr));
  };
}();

/**
 * 2 Dimensional Vector
 * @module vec2
 */

/**
 * Creates a new, empty vec2
 *
 * @returns {vec2} a new 2D vector
 */

function create$8() {
  var out = new ARRAY_TYPE(2);

  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
  }

  return out;
}
/**
 * Perform some operation over an array of vec2s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

var forEach$2 = function () {
  var vec = create$8();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 2;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
    }

    return a;
  };
}();

class BaseRenderer {
    constructor() {
        this.mMMatrix = create$3();
        this.mVMatrix = create$3();
        this.mMVPMatrix = create$3();
        this.mProjMatrix = create$3();
        this.matOrtho = create$3();
        this.m_boundTick = this.tick.bind(this);
        this.isWebGL2 = false;
        this.viewportWidth = 0;
        this.viewportHeight = 0;
    }
    /** Getter for current WebGL context. */
    get gl() {
        if (this.m_gl === undefined) {
            throw new Error("No WebGL context");
        }
        return this.m_gl;
    }
    /** Logs last GL error to console */
    logGLError() {
        var err = this.gl.getError();
        if (err !== this.gl.NO_ERROR) {
            console.warn(`WebGL error # + ${err}`);
        }
    }
    /**
     * Binds 2D texture.
     *
     * @param textureUnit A texture unit to use
     * @param texture A texture to be used
     * @param uniform Shader's uniform ID
     */
    setTexture2D(textureUnit, texture, uniform) {
        this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.uniform1i(uniform, textureUnit);
    }
    /**
     * Binds cubemap texture.
     *
     * @param textureUnit A texture unit to use
     * @param texture A texture to be used
     * @param uniform Shader's uniform ID
     */
    setTextureCubemap(textureUnit, texture, uniform) {
        this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
        this.gl.bindTexture(this.gl.TEXTURE_CUBE_MAP, texture);
        this.gl.uniform1i(uniform, textureUnit);
    }
    /**
     * Calculates FOV for matrix.
     *
     * @param matrix Output matrix
     * @param fovY Vertical FOV in degrees
     * @param aspect Aspect ratio of viewport
     * @param zNear Near clipping plane distance
     * @param zFar Far clipping plane distance
     */
    setFOV(matrix, fovY, aspect, zNear, zFar) {
        const fH = Math.tan(fovY / 360.0 * Math.PI) * zNear;
        const fW = fH * aspect;
        frustum(matrix, -fW, fW, -fH, fH, zNear, zFar);
    }
    /**
     * Calculates MVP matrix. Saved in this.mMVPMatrix
     */
    calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        identity$3(this.mMMatrix);
        rotate$3(this.mMMatrix, this.mMMatrix, 0, [1, 0, 0]);
        translate$2(this.mMMatrix, this.mMMatrix, [tx, ty, tz]);
        scale$3(this.mMMatrix, this.mMMatrix, [sx, sy, sz]);
        rotateX(this.mMMatrix, this.mMMatrix, rx);
        rotateY(this.mMMatrix, this.mMMatrix, ry);
        rotateZ(this.mMMatrix, this.mMMatrix, rz);
        multiply$3(this.mMVPMatrix, this.mVMatrix, this.mMMatrix);
        multiply$3(this.mMVPMatrix, this.mProjMatrix, this.mMVPMatrix);
    }
    /** Perform each frame's draw calls here. */
    drawScene() {
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
    /** Called on each frame. */
    tick() {
        requestAnimationFrame(this.m_boundTick);
        this.resizeCanvas();
        this.drawScene();
        this.animate();
    }
    /**
     * Initializes WebGL context.
     *
     * @param canvas Canvas to initialize WebGL.
     */
    initGL(canvas) {
        const gl = canvas.getContext("webgl", { alpha: false });
        if (gl === null) {
            throw new Error("Cannot initialize WebGL context");
        }
        // this.isETC1Supported = !!gl.getExtension('WEBGL_compressed_texture_etc1');
        return gl;
    }
    ;
    /**
     * Initializes WebGL 2 context
     *
     * @param canvas Canvas to initialize WebGL 2.
     */
    initGL2(canvas) {
        let gl = canvas.getContext("webgl2", { alpha: false });
        if (gl === null) {
            console.warn('Could not initialise WebGL 2, falling back to WebGL 1');
            return this.initGL(canvas);
        }
        return gl;
    }
    ;
    /**
     * Initializes WebGL and calls all callbacks.
     *
     * @param canvasID ID of canvas element to initialize WebGL.
     * @param requestWebGL2 Set to `true` to initialize WebGL 2 context.
     */
    init(canvasID, requestWebGL2 = false) {
        this.onBeforeInit();
        this.canvas = document.getElementById(canvasID);
        if (this.canvas === null) {
            throw new Error("Cannot find canvas element");
        }
        this.viewportWidth = this.canvas.width;
        this.viewportHeight = this.canvas.height;
        this.m_gl = !!requestWebGL2 ? this.initGL2(this.canvas) : this.initGL(this.canvas);
        if (this.m_gl) {
            this.resizeCanvas();
            this.onAfterInit();
            this.initShaders();
            this.loadData();
            this.m_boundTick();
        }
        else {
            this.onInitError();
        }
    }
    /** Adjusts viewport according to resizing of canvas. */
    resizeCanvas() {
        if (this.canvas === undefined) {
            return;
        }
        const cssToRealPixels = window.devicePixelRatio || 1;
        const displayWidth = Math.floor(this.canvas.clientWidth * cssToRealPixels);
        const displayHeight = Math.floor(this.canvas.clientHeight * cssToRealPixels);
        if (this.canvas.width != displayWidth || this.canvas.height != displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
        }
    }
    /**
     * Logs GL error to console.
     *
     * @param operation Operation name.
     */
    checkGlError(operation) {
        let error;
        while ((error = this.gl.getError()) !== this.gl.NO_ERROR) {
            console.error(`${operation}: glError ${error}`);
        }
    }
    /** @inheritdoc */
    unbindBuffers() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
    }
    /** @inheritdoc */
    getMVPMatrix() {
        return this.mMVPMatrix;
    }
    /** @inheritdoc */
    getOrthoMatrix() {
        return this.matOrtho;
    }
    /** @inheritdoc */
    getModelMatrix() {
        return this.mMMatrix;
    }
    /** @inheritdoc */
    getViewMatrix() {
        return this.mVMatrix;
    }
}

class CombinedAnimation {
    constructor(frames) {
        this.frames = frames;
        this.start = 0;
        this.end = 0;
        this.currentCoeff = 0;
    }
    getStart() {
        return this.start;
    }
    getEnd() {
        return this.end;
    }
    getFramesCount() {
        return this.frames;
    }
    getCurrentCoeff() {
        return this.currentCoeff;
    }
    clamp(i, low, high) {
        return Math.max(Math.min(i, high), low);
    }
    animate(coeff) {
        const clampedCoeff = this.clamp(coeff, 0.0, 1.0);
        this.start = Math.trunc(clampedCoeff * (this.frames - 1));
        if (this.start == this.frames - 1)
            this.start = this.frames - 2;
        this.end = this.start + 1;
        this.currentCoeff = (clampedCoeff * (this.frames - 1)) - this.start;
    }
}

class DiffuseShader extends BaseShader {
    /** @inheritdoc */
    fillCode() {
        this.vertexShaderCode = 'uniform mat4 view_proj_matrix;\n' +
            'attribute vec4 rm_Vertex;\n' +
            'attribute vec2 rm_TexCoord0;\n' +
            'varying vec2 vTextureCoord;\n' +
            '\n' +
            'void main() {\n' +
            '  gl_Position = view_proj_matrix * rm_Vertex;\n' +
            '  vTextureCoord = rm_TexCoord0;\n' +
            '}';
        this.fragmentShaderCode = 'precision mediump float;\n' +
            'varying vec2 vTextureCoord;\n' +
            'uniform sampler2D sTexture;\n' +
            '\n' +
            'void main() {\n' +
            '  gl_FragColor = texture2D(sTexture, vTextureCoord);\n' +
            '}';
    }
    /** @inheritdoc */
    fillUniformsAttributes() {
        this.view_proj_matrix = this.getUniform('view_proj_matrix');
        this.rm_Vertex = this.getAttrib('rm_Vertex');
        this.rm_TexCoord0 = this.getAttrib('rm_TexCoord0');
        this.sTexture = this.getUniform('sTexture');
    }
    /** @inheritdoc */
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined || this.rm_TexCoord0 === undefined || this.view_proj_matrix === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        gl.enableVertexAttribArray(this.rm_Vertex);
        gl.enableVertexAttribArray(this.rm_TexCoord0);
        gl.vertexAttribPointer(this.rm_Vertex, 3, gl.FLOAT, false, 4 * (3 + 2), 0);
        gl.vertexAttribPointer(this.rm_TexCoord0, 2, gl.FLOAT, false, 4 * (3 + 2), 4 * 3);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.view_proj_matrix, false, renderer.getMVPMatrix());
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("DiffuseShader glDrawElements");
    }
}

/**
 * Common utilities
 * @module glMatrix
 */
// Configuration Constants
var EPSILON$1 = 0.000001;
var ARRAY_TYPE$1 = typeof Float32Array !== 'undefined' ? Float32Array : Array;
if (!Math.hypot) Math.hypot = function () {
  var y = 0,
      i = arguments.length;

  while (i--) {
    y += arguments[i] * arguments[i];
  }

  return Math.sqrt(y);
};

/**
 * 4x4 Matrix<br>Format: column-major, when typed out it looks like row-major<br>The matrices are being post multiplied.
 * @module mat4
 */

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */

function create() {
  var out = new ARRAY_TYPE$1(16);

  if (ARRAY_TYPE$1 != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
  }

  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
/**
 * Creates a new mat4 initialized with values from an existing matrix
 *
 * @param {ReadonlyMat4} a matrix to clone
 * @returns {mat4} a new 4x4 matrix
 */

function clone(a) {
  var out = new ARRAY_TYPE$1(16);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  out[9] = a[9];
  out[10] = a[10];
  out[11] = a[11];
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */

function identity(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the source matrix
 * @returns {mat4} out
 */

function invert(out, a) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3];
  var a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7];
  var a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11];
  var a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15];
  var b00 = a00 * a11 - a01 * a10;
  var b01 = a00 * a12 - a02 * a10;
  var b02 = a00 * a13 - a03 * a10;
  var b03 = a01 * a12 - a02 * a11;
  var b04 = a01 * a13 - a03 * a11;
  var b05 = a02 * a13 - a03 * a12;
  var b06 = a20 * a31 - a21 * a30;
  var b07 = a20 * a32 - a22 * a30;
  var b08 = a20 * a33 - a23 * a30;
  var b09 = a21 * a32 - a22 * a31;
  var b10 = a21 * a33 - a23 * a31;
  var b11 = a22 * a33 - a23 * a32; // Calculate the determinant

  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

  if (!det) {
    return null;
  }

  det = 1.0 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
/**
 * Multiplies two mat4s
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the first operand
 * @param {ReadonlyMat4} b the second operand
 * @returns {mat4} out
 */

function multiply(out, a, b) {
  var a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3];
  var a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7];
  var a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11];
  var a30 = a[12],
      a31 = a[13],
      a32 = a[14],
      a33 = a[15]; // Cache only the current line of the second matrix

  var b0 = b[0],
      b1 = b[1],
      b2 = b[2],
      b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to translate
 * @param {ReadonlyVec3} v vector to translate by
 * @returns {mat4} out
 */

function translate(out, a, v) {
  var x = v[0],
      y = v[1],
      z = v[2];
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;

  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  } else {
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11];
    out[0] = a00;
    out[1] = a01;
    out[2] = a02;
    out[3] = a03;
    out[4] = a10;
    out[5] = a11;
    out[6] = a12;
    out[7] = a13;
    out[8] = a20;
    out[9] = a21;
    out[10] = a22;
    out[11] = a23;
    out[12] = a00 * x + a10 * y + a20 * z + a[12];
    out[13] = a01 * x + a11 * y + a21 * z + a[13];
    out[14] = a02 * x + a12 * y + a22 * z + a[14];
    out[15] = a03 * x + a13 * y + a23 * z + a[15];
  }

  return out;
}
/**
 * Scales the mat4 by the dimensions in the given vec3 not using vectorization
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to scale
 * @param {ReadonlyVec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/

function scale(out, a, v) {
  var x = v[0],
      y = v[1],
      z = v[2];
  out[0] = a[0] * x;
  out[1] = a[1] * x;
  out[2] = a[2] * x;
  out[3] = a[3] * x;
  out[4] = a[4] * y;
  out[5] = a[5] * y;
  out[6] = a[6] * y;
  out[7] = a[7] * y;
  out[8] = a[8] * z;
  out[9] = a[9] * z;
  out[10] = a[10] * z;
  out[11] = a[11] * z;
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
/**
 * Rotates a mat4 by the given angle around the given axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {ReadonlyVec3} axis the axis to rotate around
 * @returns {mat4} out
 */

function rotate(out, a, rad, axis) {
  var x = axis[0],
      y = axis[1],
      z = axis[2];
  var len = Math.hypot(x, y, z);
  var s, c, t;
  var a00, a01, a02, a03;
  var a10, a11, a12, a13;
  var a20, a21, a22, a23;
  var b00, b01, b02;
  var b10, b11, b12;
  var b20, b21, b22;

  if (len < EPSILON$1) {
    return null;
  }

  len = 1 / len;
  x *= len;
  y *= len;
  z *= len;
  s = Math.sin(rad);
  c = Math.cos(rad);
  t = 1 - c;
  a00 = a[0];
  a01 = a[1];
  a02 = a[2];
  a03 = a[3];
  a10 = a[4];
  a11 = a[5];
  a12 = a[6];
  a13 = a[7];
  a20 = a[8];
  a21 = a[9];
  a22 = a[10];
  a23 = a[11]; // Construct the elements of the rotation matrix

  b00 = x * x * t + c;
  b01 = y * x * t + z * s;
  b02 = z * x * t - y * s;
  b10 = x * y * t - z * s;
  b11 = y * y * t + c;
  b12 = z * y * t + x * s;
  b20 = x * z * t + y * s;
  b21 = y * z * t - x * s;
  b22 = z * z * t + c; // Perform rotation-specific matrix multiplication

  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22;

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }

  return out;
}
/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateX$1(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateY$1(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a20 = a[8];
  var a21 = a[9];
  var a22 = a[10];
  var a23 = a[11];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged rows
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
}
/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {ReadonlyMat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */

function rotateZ$1(out, a, rad) {
  var s = Math.sin(rad);
  var c = Math.cos(rad);
  var a00 = a[0];
  var a01 = a[1];
  var a02 = a[2];
  var a03 = a[3];
  var a10 = a[4];
  var a11 = a[5];
  var a12 = a[6];
  var a13 = a[7];

  if (a !== out) {
    // If the source and destination differ, copy the unchanged last row
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  } // Perform axis-specific matrix multiplication


  out[0] = a00 * c + a10 * s;
  out[1] = a01 * c + a11 * s;
  out[2] = a02 * c + a12 * s;
  out[3] = a03 * c + a13 * s;
  out[4] = a10 * c - a00 * s;
  out[5] = a11 * c - a01 * s;
  out[6] = a12 * c - a02 * s;
  out[7] = a13 * c - a03 * s;
  return out;
}
/**
 * Returns the translation vector component of a transformation
 *  matrix. If a matrix is built with fromRotationTranslation,
 *  the returned vector will be the same as the translation vector
 *  originally supplied.
 * @param  {vec3} out Vector to receive translation component
 * @param  {ReadonlyMat4} mat Matrix to be decomposed (input)
 * @return {vec3} out
 */

function getTranslation(out, mat) {
  out[0] = mat[12];
  out[1] = mat[13];
  out[2] = mat[14];
  return out;
}
/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis.
 * If you want a matrix that actually makes an object look at another object, you should use targetTo instead.
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {ReadonlyVec3} eye Position of the viewer
 * @param {ReadonlyVec3} center Point the viewer is looking at
 * @param {ReadonlyVec3} up vec3 pointing up
 * @returns {mat4} out
 */

function lookAt(out, eye, center, up) {
  var x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
  var eyex = eye[0];
  var eyey = eye[1];
  var eyez = eye[2];
  var upx = up[0];
  var upy = up[1];
  var upz = up[2];
  var centerx = center[0];
  var centery = center[1];
  var centerz = center[2];

  if (Math.abs(eyex - centerx) < EPSILON$1 && Math.abs(eyey - centery) < EPSILON$1 && Math.abs(eyez - centerz) < EPSILON$1) {
    return identity(out);
  }

  z0 = eyex - centerx;
  z1 = eyey - centery;
  z2 = eyez - centerz;
  len = 1 / Math.hypot(z0, z1, z2);
  z0 *= len;
  z1 *= len;
  z2 *= len;
  x0 = upy * z2 - upz * z1;
  x1 = upz * z0 - upx * z2;
  x2 = upx * z1 - upy * z0;
  len = Math.hypot(x0, x1, x2);

  if (!len) {
    x0 = 0;
    x1 = 0;
    x2 = 0;
  } else {
    len = 1 / len;
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }

  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;
  len = Math.hypot(y0, y1, y2);

  if (!len) {
    y0 = 0;
    y1 = 0;
    y2 = 0;
  } else {
    len = 1 / len;
    y0 *= len;
    y1 *= len;
    y2 *= len;
  }

  out[0] = x0;
  out[1] = y0;
  out[2] = z0;
  out[3] = 0;
  out[4] = x1;
  out[5] = y1;
  out[6] = z1;
  out[7] = 0;
  out[8] = x2;
  out[9] = y2;
  out[10] = z2;
  out[11] = 0;
  out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
  out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
  out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
  out[15] = 1;
  return out;
}

/**
 * 3 Dimensional Vector
 * @module vec3
 */

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */

function create$1() {
  var out = new ARRAY_TYPE$1(3);

  if (ARRAY_TYPE$1 != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }

  return out;
}
/**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the first operand
 * @param {ReadonlyVec3} b the second operand
 * @returns {vec3} out
 */

function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}
/**
 * Scales a vec3 by a scalar number
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec3} out
 */

function scale$1(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  return out;
}
/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a vector to normalize
 * @returns {vec3} out
 */

function normalize$3(out, a) {
  var x = a[0];
  var y = a[1];
  var z = a[2];
  var len = x * x + y * y + z * z;

  if (len > 0) {
    //TODO: evaluate use of glm_invsqrt here?
    len = 1 / Math.sqrt(len);
  }

  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}
/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {ReadonlyVec3} a the vector to transform
 * @param {ReadonlyMat4} m matrix to transform with
 * @returns {vec3} out
 */

function transformMat4(out, a, m) {
  var x = a[0],
      y = a[1],
      z = a[2];
  var w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1.0;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}
/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */

var forEach$3 = function () {
  var vec = create$1();
  return function (a, stride, offset, count, fn, arg) {
    var i, l;

    if (!stride) {
      stride = 3;
    }

    if (!offset) {
      offset = 0;
    }

    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }

    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }

    return a;
  };
}();

class DiffuseColoredShader extends DiffuseShader {
    constructor() {
        super(...arguments);
        this._color = [1, 1, 0, 0];
    }
    // Attributes are numbers.
    // rm_Vertex: number | undefined;
    fillCode() {
        super.fillCode();
        this.fragmentShaderCode = `precision mediump float;
            varying vec2 vTextureCoord;
            uniform sampler2D sTexture;
            uniform vec4 color;

            void main() {
                gl_FragColor = texture2D(sTexture, vTextureCoord) * color;
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.color = this.getUniform("color");
    }
    setColor(r, g, b, a) {
        this._color = [r, g, b, a];
    }
    drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.rm_Vertex === undefined || this.view_proj_matrix === undefined || this.color === undefined) {
            return;
        }
        const gl = renderer.gl;
        gl.uniform4f(this.color, this._color[0], this._color[1], this._color[2], this._color[3]);
        super.drawModel(renderer, model, tx, ty, tz, rx, ry, rz, sx, sy, sz);
    }
}

class DiffuseAnimatedShader extends BaseShader {
    fillCode() {
        this.vertexShaderCode = "uniform highp mat4 uMVPMatrix;\n" +
            "attribute highp vec4 aPosition1;\n" +
            "attribute highp vec4 aPosition2;\n" +
            "uniform float m;\n" +
            "attribute highp vec2 aTextureCoord;\n" +
            "varying mediump vec2 vTextureCoord;\n" +
            "void main() {\n" +
            "  gl_Position = uMVPMatrix * mix(aPosition1, aPosition2, m);\n" +
            "  vTextureCoord = aTextureCoord;\n" +
            "}\n";
        this.fragmentShaderCode = "precision mediump float;\n" +
            "varying mediump vec2 vTextureCoord;\n" +
            "uniform sampler2D sTexture;\n" +
            "void main() {\n" +
            "  vec4 base = texture2D(sTexture, vTextureCoord);\n" +
            "  gl_FragColor = base;\n" +
            "}\n";
    }
    fillUniformsAttributes() {
        this.maPosition1Handle = this.getAttrib("aPosition1");
        this.maPosition2Handle = this.getAttrib("aPosition2");
        this.maTextureHandle = this.getAttrib("aTextureCoord");
        this.muMVPMatrixHandle = this.getUniform("uMVPMatrix");
        this.msTextureHandle = this.getUniform("sTexture");
        this.mMHandle = this.getUniform("m");
    }
    clamp(i, low, high) {
        return Math.max(Math.min(i, high), low);
    }
    drawModel(renderer, model, frames, frame1, frame2, m, tx, ty, tz, rx, ry, rz, sx, sy, sz) {
        if (this.muMVPMatrixHandle === undefined || this.msTextureHandle === undefined || this.mMHandle === undefined || this.maPosition1Handle === undefined || this.maPosition2Handle === undefined || this.maTextureHandle === undefined) {
            return;
        }
        const gl = renderer.gl;
        model.bindBuffers(gl);
        const stride = (2 + frames * 3) * 4;
        const offsetUV = (frames * 3) * 4;
        gl.enableVertexAttribArray(this.maPosition1Handle);
        gl.enableVertexAttribArray(this.maPosition2Handle);
        gl.enableVertexAttribArray(this.maTextureHandle);
        gl.vertexAttribPointer(this.maPosition1Handle, 3, gl.FLOAT, false, stride, 3 * (frame1) * 4);
        gl.vertexAttribPointer(this.maPosition2Handle, 3, gl.FLOAT, false, stride, 3 * (frame2) * 4);
        gl.vertexAttribPointer(this.maTextureHandle, 2, gl.FLOAT, false, stride, offsetUV);
        renderer.calculateMVPMatrix(tx, ty, tz, rx, ry, rz, sx, sy, sz);
        gl.uniformMatrix4fv(this.muMVPMatrixHandle, false, renderer.getMVPMatrix());
        gl.uniform1f(this.mMHandle, this.clamp(m, 0.0, 1.0));
        gl.drawElements(gl.TRIANGLES, model.getNumIndices() * 3, gl.UNSIGNED_SHORT, 0);
        renderer.checkGlError("glDrawElements");
    }
}

class DiffuseATColoredAnimatedShader extends DiffuseAnimatedShader {
    fillCode() {
        super.fillCode();
        this.fragmentShaderCode = "precision mediump float;\n" +
            "varying mediump vec2 vTextureCoord;\n" +
            "uniform sampler2D sTexture;\n" +
            "uniform vec4 color;\n" +
            "void main() {\n" +
            "  vec4 base = texture2D(sTexture, vTextureCoord);\n" +
            "  if (base.a < 0.95) {\n" +
            "    discard;\n" +
            "  } else {\n" +
            "    gl_FragColor = base * color;\n" +
            "  }\n" +
            "}\n";
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.color = this.getUniform("color");
    }
}

var CameraMode;
(function (CameraMode) {
    CameraMode[CameraMode["Rotating"] = 0] = "Rotating";
    CameraMode[CameraMode["Random"] = 1] = "Random";
})(CameraMode || (CameraMode = {}));

class TerrainShader extends DiffuseShader {
    static getInstance(gl, lightmapIndex) {
        TerrainShader.lightmapIndex = lightmapIndex;
        return new TerrainShader(gl);
    }
    fillCode() {
        this.vertexShaderCode = `uniform mat4 view_proj_matrix;
            attribute vec4 rm_Vertex;
            attribute vec2 rm_TexCoord0;
            varying vec2 vTextureCoord;

            uniform float fogDistance;
            uniform float fogStartDistance;
            varying float vFogAmount;

            const float ZERO = 0.0;
            const float ONE = 1.0;

            void main() {
                gl_Position = view_proj_matrix * rm_Vertex;
                vTextureCoord = rm_TexCoord0;
                vFogAmount = clamp((length(gl_Position) - fogStartDistance) / fogDistance, ZERO, ONE);
            }`;
        this.fragmentShaderCode = `precision mediump float;
            varying vec2 vTextureCoord;
            uniform sampler2D sTexture;
            uniform sampler2D sLM;
            uniform sampler2D sGradient;

            varying float vFogAmount;
            uniform vec4 uFogColor;

            const float ZERO = 0.0;

            void main() {
                vec4 lmTexture = texture2D(sLM, vTextureCoord);
                float lmAmount = lmTexture[` + TerrainShader.lightmapIndex.toString() + `];
                vec4 lm = texture2D(sGradient, vec2(lmAmount, ZERO));
                vec4 diffuse = texture2D(sTexture, vTextureCoord);
                diffuse *= lm;
                gl_FragColor = mix(diffuse, uFogColor, vFogAmount);
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.sGradient = this.getUniform("sGradient");
        this.uFogColor = this.getUniform("uFogColor");
        this.fogStartDistance = this.getUniform("fogStartDistance");
        this.fogDistance = this.getUniform("fogDistance");
        this.sLM = this.getUniform("sLM");
    }
}
TerrainShader.lightmapIndex = 0;

class TerrainWaterShader extends TerrainShader {
    static getInstance(gl, lightmapIndex) {
        TerrainWaterShader.lightmapIndexWater = lightmapIndex;
        return new TerrainWaterShader(gl);
    }
    fillCode() {
        this.vertexShaderCode = `uniform mat4 view_proj_matrix;
            attribute vec4 rm_Vertex;
            attribute vec2 rm_TexCoord0;
            varying vec2 vTextureCoord;

            uniform float fogDistance;
            uniform float fogStartDistance;
            varying float vFogAmount;

            uniform mat4 model_matrix;
            varying vec3 FragPos;

            const float ZERO = 0.0;
            const float ONE = 1.0;

            void main() {
                gl_Position = view_proj_matrix * rm_Vertex;
                vTextureCoord = rm_TexCoord0;
                vFogAmount = clamp((length(gl_Position) - fogStartDistance) / fogDistance, ZERO, ONE);

                FragPos = vec3(model_matrix * rm_Vertex);
            }`;
        this.fragmentShaderCode = `precision highp float;
            varying vec2 vTextureCoord;
            uniform sampler2D sTexture;
            uniform sampler2D sLM;
            uniform sampler2D sGradient;

            varying float vFogAmount;
            uniform vec4 uFogColor;

            uniform vec3 viewPos; // Camera position
            uniform vec3 lightPos; // Sun position
            uniform vec4 lightColor; // Sun color
            uniform float specularStrength;
            varying vec3 FragPos;

            const float SPECULAR_POWER = 12.0;
            const float ZERO = 0.0;
            const vec3 NORMAL = vec3(0.0, 0.0, 1.0);

            void main() {
                vec3 viewDir = normalize(viewPos - FragPos);
                vec3 lightDir = normalize(lightPos - FragPos);
                vec3 reflectDir = reflect(-lightDir, NORMAL);
                float spec = pow(max(dot(viewDir, reflectDir), ZERO), SPECULAR_POWER);
                vec4 specularColor = specularStrength * spec * lightColor;

                vec4 lmTexture = texture2D(sLM, vTextureCoord);
                float lmAmount = lmTexture[` + TerrainWaterShader.lightmapIndexWater.toString() + `];
                vec4 lm = texture2D(sGradient, vec2(lmAmount, ZERO));
                vec4 diffuse = texture2D(sTexture, vTextureCoord);
                diffuse *= lm;
                vec4 waterColor = specularColor + diffuse;
                float water = lmTexture.b;
                gl_FragColor = mix(diffuse, waterColor, water);
                gl_FragColor = mix(gl_FragColor, uFogColor, vFogAmount);
                // gl_FragColor *= 0.001; gl_FragColor += texture2D(sTexture, vTextureCoord); // diffuse only
                // gl_FragColor *= 0.001; gl_FragColor += lmAmount; // greyscale lightmap
                // gl_FragColor *= 0.001; gl_FragColor += lm; // colored lightmap
                // gl_FragColor *= 0.001; gl_FragColor += diffuse; // diffuse w/ colored lightmap
                // gl_FragColor *= 0.001; gl_FragColor += waterColor; // specular w/o map
                // gl_FragColor *= 0.001; gl_FragColor += waterColor * water; // specular w/ map
            }`;
    }
    fillUniformsAttributes() {
        super.fillUniformsAttributes();
        this.model_matrix = this.getUniform("model_matrix");
        this.viewPos = this.getUniform("viewPos");
        this.lightPos = this.getUniform("lightPos");
        this.lightColor = this.getUniform("lightColor");
        this.specularStrength = this.getUniform("specularStrength");
    }
}
TerrainWaterShader.lightmapIndexWater = 0;

class CameraPositionInterpolator {
    constructor() {
        this._speed = 0;
        this.duration = 0;
        this._minDuration = 3000;
        this._timer = 0;
        this.lastTime = 0;
        this._reverse = false;
        this._cameraPosition = create$1();
        this._cameraRotation = create$1();
        this._matrix = create();
    }
    get cameraPosition() {
        return this._cameraPosition;
    }
    get cameraRotation() {
        return this._cameraRotation;
    }
    set reverse(value) {
        this._reverse = value;
    }
    set minDuration(value) {
        this._minDuration = value;
    }
    get matrix() {
        return this._matrix;
    }
    get speed() {
        return this._speed;
    }
    set speed(value) {
        this._speed = value;
    }
    get position() {
        return this._position;
    }
    set position(value) {
        this._position = value;
        this.duration = Math.max(this.getLength() / this.speed, this._minDuration);
    }
    get timer() {
        return this._timer;
    }
    getLength() {
        if (this.position === undefined) {
            return 0;
        }
        const start = this.position.start.position;
        const end = this.position.end.position;
        return Math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2 + (end[2] - start[2]) ** 2);
    }
    iterate(timeNow) {
        if (this.lastTime != 0) {
            const elapsed = timeNow - this.lastTime;
            this._timer += elapsed / this.duration;
            if (this._timer > 1.0) {
                this._timer = 1.0;
            }
        }
        this.lastTime = timeNow;
        this.updateMatrix();
    }
    reset() {
        this._timer = 0;
        this.updateMatrix();
    }
    updateMatrix() {
        if (this._position === undefined) {
            return;
        }
        const start = this._reverse ? this._position.end : this._position.start;
        const end = this._reverse ? this._position.start : this._position.end;
        this._cameraPosition[0] = start.position[0] + this._timer * (end.position[0] - start.position[0]);
        this._cameraPosition[1] = start.position[1] + this._timer * (end.position[1] - start.position[1]);
        this._cameraPosition[2] = start.position[2] + this._timer * (end.position[2] - start.position[2]);
        this._cameraRotation[0] = start.rotation[0] + this._timer * (end.rotation[0] - start.rotation[0]);
        this._cameraRotation[1] = start.rotation[1] + this._timer * (end.rotation[1] - start.rotation[1]);
        this._cameraRotation[2] = start.rotation[2] + this._timer * (end.rotation[2] - start.rotation[2]);
        identity(this.matrix);
        rotateX$1(this.matrix, this.matrix, this._cameraRotation[0] - Math.PI / 2.0);
        rotateZ$1(this.matrix, this.matrix, this._cameraRotation[1]);
        rotateY$1(this.matrix, this.matrix, this._cameraRotation[2]);
        translate(this.matrix, this.matrix, [-this._cameraPosition[0], -this._cameraPosition[1], -this._cameraPosition[2]]);
    }
}

const FOV_LANDSCAPE = 60.0; // FOV for landscape
const FOV_PORTRAIT = 70.0; // FOV for portrait
const YAW_COEFF_NORMAL = 200.0; // camera rotation time
const TERRAIN_SCALE = 1000;
class MountainsRenderer extends BaseRenderer {
    constructor() {
        super();
        this.lastTime = 0;
        this.angleYaw = 0;
        this.loaded = false;
        this.fmSky = new FullModel();
        this.fmSmoke = new FullModel();
        this.fmSun = new FullModel();
        this.fmBird = new FullModel();
        this.fmTerrain = new FullModel();
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
        this.animationBird = new CombinedAnimation(5);
        this.cameraMode = CameraMode.Random;
        this.currentRandomCamera = 0;
        this.matViewInverted = create();
        this.matViewInvertedTransposed = create();
        this.matTemp = create();
        this.cameraPosition = create$1();
        this.cameraRotation = create$1();
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
        this.cameraPositionInterpolator = new CameraPositionInterpolator();
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
        this.shaderDiffuse = new DiffuseShader(this.gl);
        this.shaderDiffuseColored = new DiffuseColoredShader(this.gl);
        this.shaderAnimated = new DiffuseATColoredAnimatedShader(this.gl);
        this.shaderTerrain = TerrainShader.getInstance(this.gl, 0);
        this.shaderTerrainOpposite = TerrainShader.getInstance(this.gl, 1);
        this.shaderTerrainWater = TerrainWaterShader.getInstance(this.gl, 0);
        this.shaderTerrainWaterOpposite = TerrainWaterShader.getInstance(this.gl, 1);
    }
    async loadData() {
        var _a, _b;
        await Promise.all([
            this.fmSky.load("data/models/sky", this.gl),
            this.fmSmoke.load("data/models/cloud", this.gl),
            this.fmSun.load("data/models/sun_flare", this.gl),
            this.fmBird.load("data/models/bird-anim-uv", this.gl),
            this.fmTerrain.load("data/models/iceland", this.gl),
        ]);
        [
            this.skyTexture,
            this.textureTerrainGradient,
            this.textureCloud,
            this.textureSunFlare,
            this.textureBird,
            this.textureTerrainDiffuse,
            this.textureTerrainLM
        ] = await Promise.all([
            UncompressedTextureLoader.load("data/textures/" + this.preset.SKY, this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/" + this.preset.LM_GRADIENT + ".png", this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/smoke.png", this.gl),
            UncompressedTextureLoader.load("data/textures/sun_flare.png", this.gl),
            UncompressedTextureLoader.load("data/textures/bird2.png", this.gl),
            UncompressedTextureLoader.load("data/textures/diffuse.webp", this.gl),
            UncompressedTextureLoader.load("data/textures/" + this.preset.LM + ".webp", this.gl, undefined, undefined, true)
        ]);
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
            UncompressedTextureLoader.load("data/textures/" + this.PRESETS[newPreset].SKY, this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/" + this.PRESETS[newPreset].LM_GRADIENT + ".png", this.gl, undefined, undefined, true),
            UncompressedTextureLoader.load("data/textures/" + this.PRESETS[newPreset].LM + ".webp", this.gl, undefined, undefined, true),
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
        if (this.cameraMode === CameraMode.Random) {
            this.mVMatrix = this.cameraPositionInterpolator.matrix;
            this.cameraPosition[0] = this.cameraPositionInterpolator.cameraPosition[0];
            this.cameraPosition[1] = this.cameraPositionInterpolator.cameraPosition[1];
            this.cameraPosition[2] = this.cameraPositionInterpolator.cameraPosition[2];
        }
        else {
            this.cameraPosition[0] = 0;
            this.cameraPosition[1] = 0;
            this.cameraPosition[2] = 200;
            lookAt(this.mVMatrix, this.cameraPosition, // eye
            [1000, 0, 0], // center
            [0, 0, 1] // up vector
            );
            rotate(this.mVMatrix, this.mVMatrix, (this.angleYaw + 280) / 160.0 * 6.2831852, [0, 0, 1]);
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
        identity(this.mMMatrix);
        translate(this.mMMatrix, this.mMMatrix, [tx, ty, tz]);
        scale(this.mMMatrix, this.mMMatrix, [sx, sy, sz]);
        multiply(this.mMVPMatrix, this.mVMatrix, this.mMMatrix);
        this.resetMatrixRotations(this.mMVPMatrix);
        rotateZ$1(this.mMVPMatrix, this.mMVPMatrix, rotation);
        multiply(this.mMVPMatrix, this.mProjMatrix, this.mMVPMatrix);
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

/**
 * A Flying Camera allows free motion around the scene using FPS style controls (WASD + mouselook)
 * This type of camera is good for displaying large scenes
 */
class FpsCamera {
    constructor(options) {
        var _a, _b;
        this._dirty = true;
        this._angles = create$1();
        this._position = create$1();
        this.speed = 100;
        this.rotationSpeed = 0.025;
        this._cameraMat = create();
        this._viewMat = create();
        this.projectionMat = create();
        this.pressedKeys = new Array();
        this.canvas = options.canvas;
        this.speed = (_a = options.movementSpeed) !== null && _a !== void 0 ? _a : 100;
        this.rotationSpeed = (_b = options.rotationSpeed) !== null && _b !== void 0 ? _b : 0.025;
        // Set up the appropriate event hooks
        let moving = false;
        let lastX, lastY;
        window.addEventListener("keydown", event => this.pressedKeys[event.keyCode] = true);
        window.addEventListener("keyup", event => this.pressedKeys[event.keyCode] = false);
        this.canvas.addEventListener('contextmenu', event => event.preventDefault());
        this.canvas.addEventListener('mousedown', event => {
            if (event.which === 3) {
                moving = true;
            }
            lastX = event.pageX;
            lastY = event.pageY;
        });
        this.canvas.addEventListener('mousemove', event => {
            if (moving) {
                let xDelta = event.pageX - lastX;
                let yDelta = event.pageY - lastY;
                lastX = event.pageX;
                lastY = event.pageY;
                this.angles[1] += xDelta * this.rotationSpeed;
                while (this.angles[1] < 0) {
                    this.angles[1] += Math.PI * 2;
                }
                while (this.angles[1] >= Math.PI * 2) {
                    this.angles[1] -= Math.PI * 2;
                }
                this.angles[0] += yDelta * this.rotationSpeed;
                while (this.angles[0] < -Math.PI * 0.5) {
                    this.angles[0] = -Math.PI * 0.5;
                }
                while (this.angles[0] > Math.PI * 0.5) {
                    this.angles[0] = Math.PI * 0.5;
                }
                this._dirty = true;
            }
        });
        this.canvas.addEventListener('mouseup', event => moving = false);
    }
    get angles() {
        return this._angles;
    }
    set angles(value) {
        this._angles = value;
        this._dirty = true;
    }
    get position() {
        return this._position;
    }
    set position(value) {
        this._position = value;
        this._dirty = true;
    }
    get viewMat() {
        if (this._dirty) {
            var mv = this._viewMat;
            identity(mv);
            rotateX$1(mv, mv, this.angles[0] - Math.PI / 2.0);
            rotateZ$1(mv, mv, this.angles[1]);
            rotateY$1(mv, mv, this.angles[2]);
            translate(mv, mv, [-this.position[0], -this.position[1], -this.position[2]]);
            this._dirty = false;
        }
        return this._viewMat;
    }
    update(frameTime) {
        const dir = create$1();
        let speed = (this.speed / 1000) * frameTime;
        if (this.pressedKeys[16]) { // Shift, speed up
            speed *= 5;
        }
        // This is our first person movement code. It's not really pretty, but it works
        if (this.pressedKeys['W'.charCodeAt(0)]) {
            dir[1] += speed;
        }
        if (this.pressedKeys['S'.charCodeAt(0)]) {
            dir[1] -= speed;
        }
        if (this.pressedKeys['A'.charCodeAt(0)]) {
            dir[0] -= speed;
        }
        if (this.pressedKeys['D'.charCodeAt(0)]) {
            dir[0] += speed;
        }
        if (this.pressedKeys[32]) { // Space, moves up
            dir[2] += speed;
        }
        if (this.pressedKeys['C'.charCodeAt(0)]) { // C, moves down
            dir[2] -= speed;
        }
        if (dir[0] !== 0 || dir[1] !== 0 || dir[2] !== 0) {
            let cam = this._cameraMat;
            identity(cam);
            rotateX$1(cam, cam, this.angles[0]);
            rotateZ$1(cam, cam, this.angles[1]);
            invert(cam, cam);
            transformMat4(dir, dir, cam);
            // Move the camera in the direction we are facing
            add(this.position, this.position, dir);
            this._dirty = true;
        }
    }
}

var MovementMode;
(function (MovementMode) {
    MovementMode[MovementMode["Free"] = 0] = "Free";
    MovementMode[MovementMode["Predefined"] = 1] = "Predefined";
})(MovementMode || (MovementMode = {}));
class FreeMovement {
    constructor(renderer, options) {
        this.renderer = renderer;
        this.options = options;
        this.matCamera = create();
        this.matInvCamera = new Float32Array(16);
        this.vec3Eye = new Float32Array(3);
        this.vec3Rotation = new Float32Array(3);
        this.mode = MovementMode.Predefined;
        this.setupControls();
    }
    setupControls() {
        document.addEventListener("keypress", (event) => {
            var _a;
            if (event.code === "Enter") {
                if (this.mode === MovementMode.Predefined) {
                    this.matCamera = clone(this.renderer.getViewMatrix());
                    this.renderer.setCustomCamera(this.matCamera);
                    this.mode = MovementMode.Free;
                    invert(this.matInvCamera, this.matCamera);
                    getTranslation(this.vec3Eye, this.matInvCamera);
                    normalize$3(this.vec3Rotation, this.vec3Eye);
                    scale$1(this.vec3Rotation, this.vec3Rotation, -1);
                    this.fpsCamera = (_a = this.fpsCamera) !== null && _a !== void 0 ? _a : new FpsCamera(this.options);
                    this.fpsCamera.position = this.vec3Eye;
                    const callback = (time) => {
                        if (this.mode !== MovementMode.Free) {
                            return;
                        }
                        this.fpsCamera.update(16);
                        this.matCamera = this.fpsCamera.viewMat;
                        this.renderer.setCustomCamera(this.matCamera, this.fpsCamera.position, this.fpsCamera.angles);
                        requestAnimationFrame(callback);
                    };
                    callback();
                }
                else {
                    this.renderer.resetCustomCamera();
                    this.mode = MovementMode.Predefined;
                }
            }
        });
    }
    ;
}

function ready(fn) {
    if (document.readyState !== "loading") {
        fn();
    }
    else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}
ready(() => {
    const renderer = new MountainsRenderer();
    renderer.init("canvasGL", true);
    const canvas = document.getElementById("canvasGL");
    new FreeMovement(renderer, {
        canvas,
        movementSpeed: 1200,
        rotationSpeed: 0.006
    });
    const fullScreenUtils = new FullScreenUtils();
    const toggleFullscreenElement = document.getElementById("toggleFullscreen");
    toggleFullscreenElement.addEventListener("click", () => {
        if (document.body.classList.contains("fs")) {
            fullScreenUtils.exitFullScreen();
        }
        else {
            fullScreenUtils.enterFullScreen();
        }
        fullScreenUtils.addFullScreenListener(function () {
            if (fullScreenUtils.isFullScreen()) {
                document.body.classList.add("fs");
            }
            else {
                document.body.classList.remove("fs");
            }
        });
    });
    canvas.addEventListener("click", () => renderer.changeTimeOfDay());
});
//# sourceMappingURL=index.js.map
