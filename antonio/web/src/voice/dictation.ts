import { api } from "../lib/api";

/**
 * Dictée « appuyer pour parler » : enregistrement local (MediaRecorder) puis
 * transcription par le serveur (gpt-transcribe). Rien n'est conservé.
 */
export class Dictation {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private started = 0;
  private stream: MediaStream | null = null;

  get recording() {
    return this.rec?.state === "recording";
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
    this.started = Date.now();
  }

  async stop(): Promise<string> {
    const rec = this.rec;
    if (!rec) return "";
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.stop();
    await done;
    this.stream?.getTracks().forEach((t) => t.stop());
    const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
    const seconds = Math.ceil((Date.now() - this.started) / 1000);
    this.rec = null;
    const r = await api<{ text: string }>(`/api/voice/transcribe?seconds=${seconds}`, { method: "POST", raw: blob, headers: { "Content-Type": blob.type.split(";")[0] } });
    return r.text;
  }

  cancel() {
    this.rec?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.rec = null;
  }
}

/** Lecture à voix haute locale (synthèse du navigateur, gratuite) pour l'onboarding. */
export function speakLocally(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}
