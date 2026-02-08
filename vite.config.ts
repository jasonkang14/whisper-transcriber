import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    base: "/whisper-transcriber/",
    plugins: [react()],
    optimizeDeps: {
        exclude: ["@huggingface/transformers"],
    },
    worker: {
        format: "es",
    },
});
