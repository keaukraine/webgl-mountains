import { MountainsRenderer } from "./MountainsRenderer";
import { FpsCameraOptions } from "./FpsCamera";
export declare class FreeMovement {
    private renderer;
    private options;
    private mode;
    private matCamera;
    private matInvCamera;
    private vec3Eye;
    private vec3Rotation;
    private fpsCamera;
    constructor(renderer: MountainsRenderer, options: FpsCameraOptions);
    private setupControls;
}
