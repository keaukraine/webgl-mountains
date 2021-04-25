import { TerrainShader } from "./TerrainShader";
export declare class TerrainWaterShader extends TerrainShader {
    private static lightmapIndexWater;
    model_matrix: WebGLUniformLocation | undefined;
    viewPos: WebGLUniformLocation | undefined;
    lightPos: WebGLUniformLocation | undefined;
    lightColor: WebGLUniformLocation | undefined;
    specularStrength: WebGLUniformLocation | undefined;
    static getInstance(gl: WebGLRenderingContext | WebGL2RenderingContext, lightmapIndex: number): TerrainWaterShader;
    fillCode(): void;
    fillUniformsAttributes(): void;
}
