import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
    onRecordingComplete: (blob: Blob) => void;
}

export function Recorder({ onRecordingComplete }: Props) {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);

    const mediaRecRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
    const startRef = useRef(0);

    const stop = useCallback(() => {
        if (mediaRecRef.current?.state !== "inactive") {
            mediaRecRef.current?.stop();
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animRef.current);
        clearInterval(timerRef.current);
        setRecording(false);

        // Clear canvas
        const cvs = canvasRef.current;
        if (cvs) {
            const ctx = cvs.getContext("2d");
            ctx?.clearRect(0, 0, cvs.width, cvs.height);
        }
    }, []);

    const start = useCallback(async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        streamRef.current = stream;
        chunksRef.current = [];

        const rec = new MediaRecorder(stream);
        mediaRecRef.current = rec;

        rec.ondataavailable = (e) => chunksRef.current.push(e.data);
        rec.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            onRecordingComplete(blob);
        };

        // Audio analyser for waveform
        const ac = new AudioContext();
        const src = ac.createMediaStreamSource(stream);
        const analyser = ac.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;

        rec.start();
        setRecording(true);
        setSeconds(0);
        startRef.current = Date.now();

        timerRef.current = setInterval(() => {
            setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
        }, 250);

        drawWaveform();
    }, [onRecordingComplete]);

    const drawWaveform = useCallback(() => {
        const analyser = analyserRef.current;
        const cvs = canvasRef.current;
        if (!analyser || !cvs) return;

        const ctx = cvs.getContext("2d")!;
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const W = (cvs.width = cvs.offsetWidth * 2);
        const H = (cvs.height = 96);

        const loop = () => {
            animRef.current = requestAnimationFrame(loop);
            analyser.getByteTimeDomainData(buf);

            ctx.fillStyle = "rgba(9,9,11,0.4)";
            ctx.fillRect(0, 0, W, H);

            ctx.lineWidth = 2;
            ctx.strokeStyle = "#3b82f6";
            ctx.beginPath();
            const step = W / buf.length;
            for (let i = 0; i < buf.length; i++) {
                const y = (buf[i] / 128) * (H / 2);
                i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y);
            }
            ctx.lineTo(W, H / 2);
            ctx.stroke();
        };
        loop();
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cancelAnimationFrame(animRef.current);
            clearInterval(timerRef.current);
            streamRef.current?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    const toggle = () => (recording ? stop() : start());
    const mm = Math.floor(seconds / 60);
    const ss = seconds % 60;

    return (
        <div className="recorder">
            <button
                className={`rec-btn ${recording ? "active" : ""}`}
                onClick={toggle}
            >
                <div className="dot" />
            </button>
            <div className="rec-timer">
                {mm}:{String(ss).padStart(2, "0")}
            </div>
            <div className="rec-hint">
                {recording
                    ? "Click to stop"
                    : seconds > 0
                      ? "Recording ready"
                      : "Click to record"}
            </div>
            <canvas ref={canvasRef} className="waveform-canvas" />
        </div>
    );
}
