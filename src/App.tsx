import { useCallback, useEffect, useRef, useState } from "react";
import { useWhisper, type TranscriptionResult } from "./useWhisper";
import { Recorder } from "./Recorder";
import { Transcript } from "./Transcript";

const MODELS = [
    { id: "onnx-community/whisper-tiny", label: "whisper-tiny (41 MB)" },
    { id: "onnx-community/whisper-base", label: "whisper-base (77 MB)" },
    { id: "onnx-community/whisper-small", label: "whisper-small (249 MB)" },
    { id: "distil-whisper/distil-medium.en", label: "distil-medium.en (402 MB)" },
    { id: "distil-whisper/distil-large-v3", label: "distil-large-v3 (756 MB)" },
    { id: "onnx-community/whisper-large-v3-turbo", label: "whisper-large-v3-turbo (1.6 GB)" },
];

const HISTORY_KEY = "whisper_history";
const LAST_MODEL_KEY = "whisper_last_model";

interface LastModelEntry {
    model: string;
    device: "webgpu" | "wasm";
}

function loadLastModel(): LastModelEntry | null {
    try {
        const raw = localStorage.getItem(LAST_MODEL_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.model && MODELS.some((m) => m.id === parsed.model)) {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

function saveLastModel(model: string, device: "webgpu" | "wasm") {
    localStorage.setItem(LAST_MODEL_KEY, JSON.stringify({ model, device }));
}

interface HistoryEntry {
    text: string;
    chunks: { text: string; timestamp: [number, number] }[];
    ts: string;
}

function loadHistory(): HistoryEntry[] {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveHistory(entries: HistoryEntry[]) {
    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(entries.slice(0, 50)),
    );
}

export function App() {
    const whisper = useWhisper();

    const [device, setDevice] = useState<"webgpu" | "wasm">(() => loadLastModel()?.device ?? "wasm");
    const [model, setModel] = useState(() => loadLastModel()?.model ?? MODELS[1].id);
    const [tab, setTab] = useState<"record" | "upload">("record");
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
    const [viewingResult, setViewingResult] =
        useState<TranscriptionResult | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // On mount: auto-load saved model, or detect WebGPU for first-time users
    useEffect(() => {
        const saved = loadLastModel();
        if (saved) {
            whisper.loadModel(saved.model, saved.device);
            return;
        }
        (async () => {
            try {
                const adapter = await navigator.gpu?.requestAdapter();
                if (adapter) setDevice("webgpu");
            } catch {
                /* no WebGPU */
            }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Save last-used model when loading completes
    useEffect(() => {
        if (whisper.modelState === "ready" && whisper.loadedModel) {
            saveLastModel(whisper.loadedModel, device);
        }
    }, [whisper.modelState, whisper.loadedModel, device]);

    // When a new result arrives, save to history
    useEffect(() => {
        if (whisper.result) {
            const entry: HistoryEntry = {
                text: whisper.result.text,
                chunks: whisper.result.chunks,
                ts: new Date().toISOString(),
            };
            const updated = [entry, ...history];
            setHistory(updated);
            saveHistory(updated);
            setViewingResult(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [whisper.result]);

    const handleLoad = () => whisper.loadModel(model, device);

    const handleRecording = useCallback((blob: Blob) => {
        setAudioBlob(blob);
        setUploadedFile(null);
    }, []);

    const handleFile = (file: File) => {
        setUploadedFile(file);
        setAudioBlob(null);
    };

    const handleTranscribe = async () => {
        const blob = uploadedFile || audioBlob;
        if (!blob) return;

        const arrayBuf = await blob.arrayBuffer();
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        const pcm = decoded.getChannelData(0); // mono, 16 kHz
        whisper.transcribe(pcm);
    };

    const clearHistory = () => {
        setHistory([]);
        saveHistory([]);
    };

    const modelReady = whisper.modelState === "ready";
    const isLoading = whisper.modelState === "loading";
    const isBusy = whisper.transcribeState === "busy";
    const hasAudio = !!(audioBlob || uploadedFile);
    const canTranscribe = modelReady && hasAudio && !isBusy;
    const selectedIsDifferent = whisper.loadedModel !== model;
    const canLoad = !isLoading && !isBusy && (selectedIsDifferent || !modelReady);
    const activeResult = viewingResult || whisper.result;
    const progressEntries = Object.entries(whisper.progress);

    return (
        <div className="app">
            <header className="header">
                <h1>Whisper Transcriber</h1>
                <p>In-browser speech-to-text with WebGPU</p>
            </header>

            {/* ── Model setup ── */}
            <div className="card model-bar">
                <label htmlFor="model-select">Model</label>
                <select
                    id="model-select"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={isLoading || isBusy}
                >
                    {MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.label}
                            {whisper.loadedModel === m.id ? " (loaded)" : ""}
                        </option>
                    ))}
                </select>
                <span className={`device-tag ${device}`}>
                    {device === "webgpu" ? "WebGPU" : "WASM"}
                </span>
                <button
                    className="load-btn"
                    onClick={handleLoad}
                    disabled={!canLoad}
                >
                    {isLoading
                        ? "Loading..."
                        : modelReady && selectedIsDifferent
                          ? "Switch Model"
                          : modelReady
                            ? "Loaded"
                            : "Load Model"}
                </button>
            </div>

            {/* ── Loading progress ── */}
            {progressEntries.length > 0 && (
                <div className="progress-section">
                    {progressEntries.map(([file, pct]) => (
                        <div className="progress-row" key={file}>
                            <span className="name">
                                {file.split("/").pop()}
                            </span>
                            <div className="progress-track">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="pct">{Math.round(pct)}%</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Status ── */}
            {modelReady && (
                <div className="status ready">
                    {whisper.loadedModel?.split("/").pop()} loaded — ready to transcribe
                </div>
            )}
            {whisper.error && (
                <div className="status error">{whisper.error}</div>
            )}

            {/* ── Input area ── */}
            <div className={`card ${modelReady ? "" : "locked"}`}>
                <div className="tabs">
                    <button
                        className={`tab-btn ${tab === "record" ? "active" : ""}`}
                        onClick={() => setTab("record")}
                    >
                        Record
                    </button>
                    <button
                        className={`tab-btn ${tab === "upload" ? "active" : ""}`}
                        onClick={() => setTab("upload")}
                    >
                        Upload File
                    </button>
                </div>

                {tab === "record" && (
                    <div className="tab-panel">
                        <Recorder onRecordingComplete={handleRecording} />
                    </div>
                )}

                {tab === "upload" && (
                    <div className="tab-panel">
                        <div
                            className={`drop-zone ${dragOver ? "over" : ""}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOver(true);
                            }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(false);
                                if (e.dataTransfer.files.length) {
                                    handleFile(e.dataTransfer.files[0]);
                                }
                            }}
                        >
                            <p>
                                <span className="hl">Click to browse</span>{" "}
                                or drag & drop
                            </p>
                            <p
                                style={{
                                    marginTop: "0.25rem",
                                    fontSize: "0.78rem",
                                }}
                            >
                                WAV, MP3, M4A, FLAC, OGG, WebM
                            </p>
                        </div>
                        {uploadedFile && (
                            <div className="file-tag">
                                {uploadedFile.name} (
                                {(uploadedFile.size / 1048576).toFixed(1)} MB)
                            </div>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".wav,.mp3,.m4a,.flac,.ogg,.webm,.mp4"
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    handleFile(e.target.files[0]);
                                }
                            }}
                        />
                    </div>
                )}
            </div>

            {/* ── Transcribe ── */}
            <button
                className="primary-btn"
                disabled={!canTranscribe}
                onClick={handleTranscribe}
            >
                {isBusy ? "Transcribing..." : "Transcribe"}
            </button>

            {/* ── Processing indicator ── */}
            {isBusy && (
                <>
                    <div className="spinner-area">
                        <div className="spinner" />
                        <p>Processing audio...</p>
                    </div>
                    {whisper.partialText && (
                        <div className="partial">{whisper.partialText}</div>
                    )}
                </>
            )}

            {/* ── Result ── */}
            {activeResult && <Transcript result={activeResult} />}

            {/* ── History ── */}
            <div className="history-header">
                <h2>History</h2>
                <span className="count-badge">{history.length}</span>
                {history.length > 0 && (
                    <button className="clear-btn" onClick={clearHistory}>
                        Clear
                    </button>
                )}
            </div>
            {history.length === 0 ? (
                <div className="empty">No transcriptions yet</div>
            ) : (
                history.map((entry, i) => (
                    <div
                        className="hist-item"
                        key={entry.ts + i}
                        onClick={() =>
                            setViewingResult({
                                text: entry.text,
                                chunks: entry.chunks,
                            })
                        }
                    >
                        <div className="hist-date">
                            {entry.ts.replace("T", " ").slice(0, 19)}
                        </div>
                        <div className="hist-preview">{entry.text}</div>
                    </div>
                ))
            )}
        </div>
    );
}
