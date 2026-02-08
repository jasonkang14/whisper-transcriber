import { useCallback, useEffect, useRef, useState } from "react";

export interface Chunk {
    text: string;
    timestamp: [number, number];
}

export interface TranscriptionResult {
    text: string;
    chunks: Chunk[];
}

type ModelState = "idle" | "loading" | "ready" | "error";
type TranscribeState = "idle" | "busy";

export function useWhisper() {
    const workerRef = useRef<Worker | null>(null);

    const [modelState, setModelState] = useState<ModelState>("idle");
    const [transcribeState, setTranscribeState] =
        useState<TranscribeState>("idle");
    const [progress, setProgress] = useState<Record<string, number>>({});
    const [partialText, setPartialText] = useState("");
    const [result, setResult] = useState<TranscriptionResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Create worker once
    useEffect(() => {
        const w = new Worker(
            new URL("./whisper.worker.ts", import.meta.url),
            { type: "module" },
        );
        workerRef.current = w;

        w.addEventListener("message", (e: MessageEvent) => {
            const msg = e.data;

            switch (msg.type) {
                case "loading":
                    setModelState("loading");
                    setProgress({});
                    break;

                case "progress":
                    setProgress((prev) => ({
                        ...prev,
                        [msg.file]: msg.progress,
                    }));
                    break;

                case "ready":
                    setModelState("ready");
                    setProgress({});
                    break;

                case "transcribing":
                    setTranscribeState("busy");
                    setPartialText("");
                    setResult(null);
                    break;

                case "partial":
                    setPartialText(msg.text ?? "");
                    break;

                case "complete":
                    setTranscribeState("idle");
                    setPartialText("");
                    setResult(msg.data as TranscriptionResult);
                    break;

                case "error":
                    setModelState((s) => (s === "loading" ? "error" : s));
                    setTranscribeState("idle");
                    setError(msg.message);
                    break;
            }
        });

        return () => w.terminate();
    }, []);

    const loadModel = useCallback((model: string, device: string) => {
        setError(null);
        workerRef.current?.postMessage({ type: "load", model, device });
    }, []);

    const transcribe = useCallback((audio: Float32Array) => {
        setError(null);
        workerRef.current?.postMessage(
            { type: "transcribe", audio },
            [audio.buffer],
        );
    }, []);

    return {
        modelState,
        transcribeState,
        progress,
        partialText,
        result,
        error,
        loadModel,
        transcribe,
    };
}
