# Whisper Transcriber

Free, in-browser speech-to-text transcription powered by OpenAI Whisper and WebGPU. No server, no uploads — your audio never leaves your device.

**Live demo:** [whisper.kangsium.com](https://whisper.kangsium.com)

## Features

- **Runs entirely in your browser** — no backend, no API keys, no data sent anywhere
- **WebGPU accelerated** — fast inference on supported browsers, falls back to WASM
- **Record or upload** — use your microphone or drag & drop audio files (WAV, MP3, M4A, FLAC, OGG, WebM)
- **Timestamped segments** — see exactly when each phrase was spoken
- **Export** — copy text, download as TXT, or export as SRT subtitles
- **Multiple models** — choose between tiny (41 MB), base (77 MB), or small (249 MB)
- **History** — past transcriptions saved locally in your browser

## Getting Started

```bash
git clone https://github.com/jasonkang14/whisper-transcriber.git
cd whisper-transcriber
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## How It Works

1. Select a Whisper model and click **Load Model** (downloaded once and cached by the browser)
2. Record audio or upload a file
3. Click **Transcribe**
4. View results with timestamps, copy, or download

The app uses [Transformers.js](https://huggingface.co/docs/transformers.js) to run ONNX-converted Whisper models directly in a Web Worker. WebGPU is used for inference when available, with WASM as a fallback.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** — build tooling and dev server
- **@huggingface/transformers** — client-side ML inference
- **Web Workers** — off-main-thread model loading and transcription
- **WebGPU / WASM** — hardware-accelerated inference

## Deploy

The app is deployed to GitHub Pages via the `gh-pages` branch:

```bash
npm run deploy
```

## License

MIT
