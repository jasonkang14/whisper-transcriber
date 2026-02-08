import { pipeline } from "@huggingface/transformers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;

self.addEventListener("message", async (event: MessageEvent) => {
    const { type } = event.data;
    if (type === "load") await loadModel(event.data);
    if (type === "transcribe") await runTranscription(event.data);
});

async function loadModel({
    model,
    device,
}: {
    model: string;
    device: string;
}) {
    try {
        post({ type: "loading" });

        transcriber = await pipeline(
            "automatic-speech-recognition",
            model,
            {
                device: device as "webgpu" | "wasm",
                dtype: device === "webgpu" ? "fp32" : "q8",
                progress_callback: (info: Record<string, unknown>) => {
                    if (info.status === "progress") {
                        post({
                            type: "progress",
                            file: info.file as string,
                            progress: info.progress as number,
                        });
                    }
                },
            },
        );

        post({ type: "ready" });
    } catch (err) {
        post({ type: "error", message: String(err) });
    }
}

async function runTranscription({ audio }: { audio: Float32Array }) {
    if (!transcriber) {
        post({ type: "error", message: "Model not loaded" });
        return;
    }

    try {
        post({ type: "transcribing" });

        const result = await transcriber(audio, {
            top_k: 0,
            do_sample: false,
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true,
            force_full_sequences: false,

            // Stream partial text as tokens are generated
            callback_function: (output: { output_token_ids: number[] }[]) => {
                try {
                    const text = transcriber.tokenizer.decode(
                        output[0].output_token_ids,
                        { skip_special_tokens: true },
                    );
                    post({ type: "partial", text });
                } catch {
                    // tokenizer access may fail in some model configurations — skip silently
                }
            },
        });

        post({ type: "complete", data: result });
    } catch (err) {
        post({ type: "error", message: String(err) });
    }
}

function post(msg: Record<string, unknown>) {
    self.postMessage(msg);
}
