import type { TranscriptionResult } from "./useWhisper";

interface Props {
    result: TranscriptionResult;
}

export function Transcript({ result }: Props) {
    const copyText = () => {
        navigator.clipboard.writeText(result.text);
    };

    const downloadTxt = () => {
        download(result.text, "transcription.txt", "text/plain");
    };

    const downloadSrt = () => {
        const lines: string[] = [];
        result.chunks.forEach((c, i) => {
            const [s, e] = c.timestamp;
            lines.push(String(i + 1));
            lines.push(`${srtTime(s)} --> ${srtTime(e)}`);
            lines.push(c.text.trim());
            lines.push("");
        });
        download(lines.join("\n"), "transcription.srt", "text/srt");
    };

    return (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
            <div className="result-bar">
                <span className="result-meta">
                    {result.chunks.length} segment
                    {result.chunks.length !== 1 && "s"}
                </span>
                <div className="result-actions">
                    <button className="act-btn" onClick={copyText}>
                        Copy
                    </button>
                    <button className="act-btn" onClick={downloadTxt}>
                        TXT
                    </button>
                    <button className="act-btn" onClick={downloadSrt}>
                        SRT
                    </button>
                </div>
            </div>
            <div className="result-text">{result.text}</div>
            {result.chunks.length > 0 && (
                <details className="seg-toggle">
                    <summary>Timestamps</summary>
                    <div className="seg-list">
                        {result.chunks.map((c, i) => (
                            <div className="seg-row" key={i}>
                                <span className="seg-time">
                                    {fmtTime(c.timestamp[0])} &ndash;{" "}
                                    {fmtTime(c.timestamp[1])}
                                </span>
                                <span>{c.text.trim()}</span>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}

function fmtTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1).padStart(4, "0");
    return `${m}:${sec}`;
}

function srtTime(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(h)}:${p(m)}:${p(sec)},${String(ms).padStart(3, "0")}`;
}

function download(content: string, filename: string, mime: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}
