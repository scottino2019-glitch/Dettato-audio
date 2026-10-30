/**
 * Audio synthesis, stitching and MP3 encoding service for dictation audio files.
 * Works entirely client-side using Web Audio API and LAME MP3 encoder.
 */
import { Mp3Encoder } from '@breezystack/lamejs';

export interface DictationSegment {
  id: string;
  text: string;
  repeatCount: number; // e.g. 1, 2, 3
}

export interface SegmentTiming {
  segmentId: string;
  text: string;
  repetitionIndex: number; // 0, 1, 2
  startTime: number;
  endTime: number;
}

export interface DictationConfig {
  segments: DictationSegment[];
  lang: string; // e.g. 'it', 'ru', 'zh-CN', 'ja', 'en'
  speed: number; // 0.5 to 1.2
  repetitionCount: number; // 1, 2, 3
  pauseBetweenRepetitions: number; // in seconds
  pauseBetweenWords: number; // in seconds
  playChime: boolean; // optional chime
}

// Global cached AudioContext for decoding
let cachedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!cachedAudioCtx || cachedAudioCtx.state === 'closed') {
    cachedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return cachedAudioCtx;
}

// In-memory cache for decoded AudioBuffers so identical words are decoded once
const bufferCache = new Map<string, AudioBuffer>();

/**
 * Fetch and decode TTS audio for a word/phrase
 */
export async function fetchTtsAudioBuffer(
  text: string,
  lang: string,
  speed: number
): Promise<AudioBuffer> {
  const audioCtx = getAudioContext();
  const trimmed = text.trim();
  const cacheKey = `${lang}:${speed <= 0.8 ? 'slow' : 'normal'}:${trimmed}`;

  if (bufferCache.has(cacheKey)) {
    return bufferCache.get(cacheKey)!;
  }

  // Google TTS speed parameter: 0.3 for slow articulation, 1.0 for normal
  const googleSpeed = speed <= 0.8 ? '0.3' : '1.0';
  const url = `/api/tts?q=${encodeURIComponent(trimmed)}&tl=${encodeURIComponent(lang)}&ttsspeed=${googleSpeed}`;

  let response: Response;
  try {
    response = await fetch(url);
    if (!response.ok) {
      // Retry once after brief pause if server was warming up
      await new Promise((resolve) => setTimeout(resolve, 300));
      response = await fetch(url);
    }
  } catch (err: any) {
    // Retry once on network blip
    await new Promise((resolve) => setTimeout(resolve, 300));
    response = await fetch(url);
  }

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      if (errJson?.error) {
        errorDetail = errJson.details ? `${errJson.error} (${errJson.details})` : errJson.error;
      }
    } catch {
      // ignore JSON parse fail
    }
    throw new Error(
      `Impossibile ottenere l'audio per "${trimmed}" (errore ${response.status}${errorDetail ? ': ' + errorDetail : ''}). Controlla la lingua selezionata o riprova.`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  // Native Web Audio API decoding
  const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  // Store in cache
  if (bufferCache.size > 300) {
    const firstKey = bufferCache.keys().next().value;
    if (firstKey) bufferCache.delete(firstKey);
  }
  bufferCache.set(cacheKey, decodedBuffer);

  return decodedBuffer;
}

/**
 * Synthesizes a soft acoustic chime tone
 */
function createChimeBuffer(sampleRate = 44100): AudioBuffer {
  const duration = 0.4;
  const numSamples = Math.floor(sampleRate * duration);
  const audioCtx = getAudioContext();
  const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
  const channelData = buffer.getChannelData(0);

  const freq1 = 880; // A5
  const freq2 = 1760;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.01);
    const decay = Math.exp(-t * 9.0);
    const envelope = attack * decay;
    const wave = 0.7 * Math.sin(2 * Math.PI * freq1 * t) + 0.3 * Math.sin(2 * Math.PI * freq2 * t);
    channelData[i] = wave * envelope * 0.25;
  }
  return buffer;
}

/**
 * Assembles and renders the entire dictation audio with exact timing.
 * Uses Web Audio API's native playbackRate for pristine resampling with zero skipped words!
 */
export async function renderDictationAudio(
  config: DictationConfig,
  onProgress?: (percent: number, status: string) => void
): Promise<{
  mp3Blob: Blob;
  totalDuration: number;
  timings: SegmentTiming[];
}> {
  const {
    segments,
    lang,
    speed,
    repetitionCount,
    pauseBetweenRepetitions,
    pauseBetweenWords,
    playChime,
  } = config;

  if (segments.length === 0) {
    throw new Error('Nessun testo inserito per il dettato.');
  }

  onProgress?.(5, 'Inizializzazione voci Google & Android...');

  const sampleRate = 44100;
  const chimeBuffer = playChime ? createChimeBuffer(sampleRate) : null;
  const chimeDuration = chimeBuffer ? chimeBuffer.duration + 0.15 : 0;

  // 1. Fetch audio buffers for all segments without skipping any
  const segmentBuffers = new Map<string, AudioBuffer>();
  const totalItems = segments.length;

  for (let i = 0; i < totalItems; i++) {
    const seg = segments[i];
    const progressPct = 5 + Math.round(((i + 1) / totalItems) * 50);
    onProgress?.(progressPct, `Caricamento voce per "${seg.text}" (${i + 1}/${totalItems})...`);

    if (!segmentBuffers.has(seg.text)) {
      const buf = await fetchTtsAudioBuffer(seg.text, lang, speed);
      segmentBuffers.set(seg.text, buf);
    }
  }

  onProgress?.(60, 'Calcolo perfetto delle pause e ripetizioni...');

  // Fine playbackRate multiplier if speed was fine-tuned
  // Google TTS at ttsspeed=0.3 is already speaking slowly (approx 0.75x)
  let playbackRate = 1.0;
  if (speed <= 0.8) {
    playbackRate = Math.max(0.7, Math.min(1.3, speed / 0.75));
  } else {
    playbackRate = Math.max(0.8, Math.min(1.2, speed));
  }

  // 2. Build exact timeline
  const timings: SegmentTiming[] = [];
  let currentTime = 0.6; // Lead-in silence

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const buf = segmentBuffers.get(seg.text);
    if (!buf) continue;

    const reps = seg.repeatCount > 0 ? seg.repeatCount : repetitionCount;
    const wordDuration = buf.duration / playbackRate;

    if (playChime) {
      currentTime += chimeDuration;
    }

    for (let r = 0; r < reps; r++) {
      const startTime = currentTime;
      const endTime = startTime + wordDuration;
      timings.push({
        segmentId: seg.id,
        text: seg.text,
        repetitionIndex: r,
        startTime,
        endTime,
      });

      currentTime = endTime;

      // Add pause between repetitions of the same word
      if (r < reps - 1) {
        currentTime += Math.max(0.5, pauseBetweenRepetitions);
      }
    }

    // Add pause between different words for writing
    if (i < segments.length - 1) {
      currentTime += Math.max(1.0, pauseBetweenWords);
    }
  }

  // Trailing silence
  currentTime += 1.2;
  const totalDuration = currentTime;
  const totalSamples = Math.ceil(totalDuration * sampleRate);

  onProgress?.(70, 'Sintesi audio multitraccia ad alta fedeltà...');

  // 3. Render all segments using OfflineAudioContext (44.1 kHz)
  const offlineCtx = new OfflineAudioContext(1, totalSamples, sampleRate);

  let timingIndex = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const buf = segmentBuffers.get(seg.text);
    if (!buf) continue;

    const reps = seg.repeatCount > 0 ? seg.repeatCount : repetitionCount;

    // Optional Chime
    if (playChime && chimeBuffer) {
      const firstRep = timings[timingIndex];
      const chimeStartTime = Math.max(0, firstRep.startTime - chimeDuration);
      const chimeNode = offlineCtx.createBufferSource();
      chimeNode.buffer = chimeBuffer;
      chimeNode.connect(offlineCtx.destination);
      chimeNode.start(chimeStartTime);
    }

    for (let r = 0; r < reps; r++) {
      const t = timings[timingIndex];
      const source = offlineCtx.createBufferSource();
      source.buffer = buf;
      source.playbackRate.value = playbackRate;
      source.connect(offlineCtx.destination);
      source.start(t.startTime);
      timingIndex++;
    }
  }

  // Render audio
  const renderedBuffer = await offlineCtx.startRendering();

  onProgress?.(85, 'Codifica del file in formato MP3 nativo...');

  // 4. Encode to MP3
  const mp3Blob = audioBufferToMp3(renderedBuffer, 128);

  onProgress?.(100, 'Dettato completato!');

  return {
    mp3Blob,
    totalDuration,
    timings,
  };
}

/**
 * Converts AudioBuffer to high quality MP3 Blob using lamejs
 */
export function audioBufferToMp3(audioBuffer: AudioBuffer, kbps = 128): Blob {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const mp3encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  const mp3Data: Uint8Array[] = [];

  const channelData = audioBuffer.getChannelData(0);
  const pcm16 = floatTo16BitPCM(channelData);

  const sampleBlockSize = 1152;
  for (let i = 0; i < pcm16.length; i += sampleBlockSize) {
    const chunk = pcm16.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.length));
    }
  }

  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf.buffer, mp3buf.byteOffset, mp3buf.length));
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

function floatTo16BitPCM(floatSamples: Float32Array): Int16Array {
  const int16Samples = new Int16Array(floatSamples.length);
  for (let i = 0; i < floatSamples.length; i++) {
    const s = Math.max(-1, Math.min(1, floatSamples[i]));
    int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Samples;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
