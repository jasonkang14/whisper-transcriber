/// <reference types="vite/client" />

// WebGPU types (not yet in all TS lib versions)
interface GPU {
    requestAdapter(): Promise<GPUAdapter | null>;
}
interface GPUAdapter {}
interface Navigator {
    gpu?: GPU;
}
