import { DiffuseShader } from "webgl-framework";
export declare class TerrainShader extends DiffuseShader {
    private static lightmapIndex;
    sGradient: WebGLUniformLocation | undefined;
    sLM: WebGLUniformLocation | undefined;
    uFogColor: WebGLUniformLocation | undefined;
    fogStartDistance: WebGLUniformLocation | undefined;
    fogDistance: WebGLUniformLocation | undefined;
    static getInstance(gl: WebGLRenderingContext | WebGL2RenderingContext, lightmapIndex: number): TerrainShader;
    fillCode(): void;
    fillUniformsAttributes(): void;
}
