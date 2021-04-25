"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerrainWaterShader = void 0;
const TerrainShader_1 = require("./TerrainShader");
class TerrainWaterShader extends TerrainShader_1.TerrainShader {
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
exports.TerrainWaterShader = TerrainWaterShader;
TerrainWaterShader.lightmapIndexWater = 0;
//# sourceMappingURL=TerrainWaterShader.js.map