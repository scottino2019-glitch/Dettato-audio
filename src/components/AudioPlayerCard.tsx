import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Volume2,
  VolumeX,
  FileAudio,
  CheckCircle2,
} from 'lucide-react';
import { SegmentTiming, formatDuration, formatBytes } from '../services/audioService';

interface AudioPlayerCardProps {
  mp3Blob: Blob | null;
  totalDuration: number;
  timings: SegmentTiming[];
  fileName: string;
  onFileNameChange: (name: string) => void;
}

export const AudioPlayerCard: React.FC<AudioPlayerCardProps> = ({
  mp3Blob,
  totalDuration,
  timings,
  fileName,
  onFileNameChange,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);

  useEffect(() => {
    if (!mp3Blob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(mp3Blob);
    setAudioUrl(url);
    setCurrentTime(0);
    setIsPlaying(false);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [mp3Blob]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => console.error(e));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleRewind = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const handleDownload = () => {
    if (!mp3Blob) return;
    const cleanName = (fileName.trim() || 'dettato').replace(/[^a-zA-Z0-9_-]/g, '_');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(mp3Blob);
    link.download = `${cleanName}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);

    setIsDownloaded(true);
    setTimeout(() => setIsDownloaded(false), 4000);
  };

  const activeTiming = timings.find(
    (t) => currentTime >= t.startTime && currentTime <= t.endTime
  );

  if (!mp3Blob || !audioUrl) {
    return null;
  }

  const durationToDisplay = totalDuration || (audioRef.current?.duration ?? 0);

  return (
    <div className="bg-white border-2 border-amber-500/30 rounded-2xl p-6 shadow-sm space-y-5">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
            <FileAudio className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-base">File Audio MP3 Pronto</h3>
            <p className="text-xs text-stone-500">
              Durata totale: {formatDuration(durationToDisplay)} • Dimensione: {formatBytes(mp3Blob.size)}
            </p>
          </div>
        </div>

        {isDownloaded && (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            File scaricato!
          </span>
        )}
      </div>

      {/* Visualizer box showing the word being read */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
          {activeTiming ? (
            <span className="text-amber-700">Ripetizione {activeTiming.repetitionIndex + 1}</span>
          ) : isPlaying ? (
            <span className="text-stone-500">Pausa per scrivere sul quaderno</span>
          ) : (
            <span>Ascolta l'anteprima</span>
          )}
        </div>
        <div className="text-xl sm:text-2xl font-bold text-stone-800 min-h-[2rem] flex items-center justify-center">
          {activeTiming ? (
            <span className="text-amber-800 underline decoration-amber-400 underline-offset-4">
              {activeTiming.text}
            </span>
          ) : (
            <span className="text-stone-400 text-sm font-normal">
              {isPlaying ? '✏️ Tempo di scrittura...' : 'Premi Play per ascoltare o Scarica l\'MP3 qui sotto'}
            </span>
          )}
        </div>
      </div>

      {/* Scrub bar */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={durationToDisplay || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
        />
        <div className="flex justify-between text-xs text-stone-500 font-mono">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(durationToDisplay)}</span>
        </div>
      </div>

      {/* Play Controls & Download button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRewind}
            title="Riavvolgi all'inizio"
            className="p-2.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-sm transition-colors"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pausa</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Ascolta</span>
              </>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition-transform active:scale-[0.99]"
        >
          <Download className="w-4 h-4" />
          <span>Scarica File MP3</span>
        </button>
      </div>

      {/* File name rename line */}
      <div className="pt-3 border-t border-stone-100 flex items-center gap-2 text-xs text-stone-600">
        <span>Nome del file:</span>
        <input
          type="text"
          value={fileName}
          onChange={(e) => onFileNameChange(e.target.value)}
          className="font-medium text-stone-800 border border-stone-200 rounded px-2 py-1 bg-stone-50 focus:bg-white focus:outline-none focus:border-amber-500"
        />
        <span className="text-stone-400 font-mono">.mp3</span>
      </div>
    </div>
  );
};
