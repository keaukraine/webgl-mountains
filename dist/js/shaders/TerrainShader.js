"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerrainShader = void 0;
const webgl_framework_1 = require("webgl-framework");
class TerrainShader extends webgl_framework_1.DiffuseShader {
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
exports.TerrainShader = TerrainShader;
TerrainShader.lightmapIndex = 0;
//# sourceMappingURL=TerrainShader.js.map