/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Volume2,
  FileAudio,
  Download,
  Loader2,
  AlertCircle,
  Globe,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { AudioPlayerCard } from './components/AudioPlayerCard';
import {
  renderDictationAudio,
  fetchTtsAudioBuffer,
  SegmentTiming,
  formatDuration,
} from './services/audioService';
import { parseTextIntoSegments, SegmentationMode } from './utils/textParser';
import { LANGUAGES, LanguageOption } from './constants/languages';

export default function App() {
  // Lingua selezionata (default: Italiano)
  const [selectedLangCode, setSelectedLangCode] = useState<string>('it');
  const [categoryFilter, setCategoryFilter] = useState<'tutte' | 'occidentali' | 'slave' | 'orientali'>('tutte');

  // Modalità di divisione del testo
  const [segmentMode, setSegmentMode] = useState<SegmentationMode>('commas');

  // Testo del dettato
  const [inputText, setInputText] = useState(
    'palla, stella, cassetto, cappello, gatto, penna, sasso, collana, notte, carrello'
  );

  // Impostazioni dettato
  const [speed, setSpeed] = useState<number>(0.75); // Lenta di default
  const [repetitionCount, setRepetitionCount] = useState<number>(2); // 2 o 3 volte
  const [pauseBetweenWords, setPauseBetweenWords] = useState<number>(5.0); // 5 secondi per scrivere
  const [pauseBetweenReps, setPauseBetweenReps] = useState<number>(2.0); // 2 secondi tra ripetizioni
  const [fileName, setFileName] = useState('dettato_audio');

  // Stato generazione
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Risultato generato
  const [mp3Blob, setMp3Blob] = useState<Blob | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [timings, setTimings] = useState<SegmentTiming[]>([]);

  // Preview singola parola
  const [previewingWord, setPreviewingWord] = useState<string | null>(null);

  // Lingua corrente
  const currentLang = useMemo(() => {
    return LANGUAGES.find((l) => l.code === selectedLangCode) || LANGUAGES[0];
  }, [selectedLangCode]);

  // Filtra lingue
  const filteredLanguages = useMemo(() => {
    if (categoryFilter === 'tutte') return LANGUAGES;
    return LANGUAGES.filter((l) => l.category === categoryFilter);
  }, [categoryFilter]);

  // Segmentazione del testo
  const parsedSegments = useMemo(() => {
    return parseTextIntoSegments(inputText, segmentMode, repetitionCount, selectedLangCode);
  }, [inputText, segmentMode, repetitionCount, selectedLangCode]);

  // Stima durata totale in secondi
  const estimatedSeconds = useMemo(() => {
    if (parsedSegments.length === 0) return 0;
    const wordDuration = 1.6 / (speed || 0.75);
    let total = 0.6;
    for (let i = 0; i < parsedSegments.length; i++) {
      total += repetitionCount * wordDuration;
      total += (repetitionCount - 1) * pauseBetweenReps;
      if (i < parsedSegments.length - 1) {
        total += pauseBetweenWords;
      }
    }
    return Math.round(total + 1.2);
  }, [parsedSegments, speed, repetitionCount, pauseBetweenWords, pauseBetweenReps]);

  // Rileva se il testo digitato appartiene a un alfabeto diverso dalla lingua impostata
  const detectedMismatch = useMemo(() => {
    if (!inputText.trim()) return null;
    if (/[\u4e00-\u9fa5]/.test(inputText) && !selectedLangCode.startsWith('zh')) {
      return { code: 'zh-CN', label: 'Cinese Mandarino 🇨🇳' };
    }
    if (/[\u3040-\u30ff]/.test(inputText) && selectedLangCode !== 'ja') {
      return { code: 'ja', label: 'Giapponese 🇯🇵' };
    }
    if (/[\uac00-\ud7af]/.test(inputText) && selectedLangCode !== 'ko') {
      return { code: 'ko', label: 'Coreano 🇰🇷' };
    }
    if (/[\u0400-\u04ff]/.test(inputText) && !['ru', 'uk', 'bg', 'sr'].includes(selectedLangCode)) {
      return { code: 'ru', label: 'Russo 🇷🇺' };
    }
    if (/[\u0600-\u06ff]/.test(inputText) && selectedLangCode !== 'ar') {
      return { code: 'ar', label: 'Arabo 🇸🇦' };
    }
    return null;
  }, [inputText, selectedLangCode]);

  // Test rapido pronuncia di una parola
  const handleQuickListen = async (word: string) => {
    try {
      setPreviewingWord(word);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const buffer = await fetchTtsAudioBuffer(word, selectedLangCode, speed);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed <= 0.8 ? speed / 0.75 : speed;
      source.connect(audioCtx.destination);
      source.start();
      source.onended = () => setPreviewingWord(null);
    } catch (err) {
      console.warn('TTS fetch preview failed, trying Web Speech fallback:', err);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(word);
          utterance.lang = selectedLangCode;
          utterance.rate = speed;
          utterance.onend = () => setPreviewingWord(null);
          utterance.onerror = () => setPreviewingWord(null);
          window.speechSynthesis.speak(utterance);
          return;
        } catch {
          // ignore
        }
      }
      setPreviewingWord(null);
    }
  };

  // Esempio rapido quando si cambia lingua
  const handleLangChange = (newCode: string) => {
    setSelectedLangCode(newCode);
    setMp3Blob(null);

    // Esempi opzionali per testare subito la pronuncia nelle varie lingue
    if (newCode === 'ru') {
      setInputText('яблоко, собака, кошка, солнце, книга, школа');
      setFileName('diktant_russkij');
    } else if (newCode === 'pl') {
      setInputText('jabłko, słońce, szkoła, kot, pies, książka');
      setFileName('dyktando_polski');
    } else if (newCode === 'zh-CN') {
      setInputText('苹果，小猫，太阳，学校，朋友，老师');
      setFileName('tingxie_zhongwen');
    } else if (newCode === 'ja') {
      setInputText('りんご、ねこ、たいよう、がっこう、ともだち');
      setFileName('kakitori_nihongo');
    } else if (newCode === 'ar') {
      setInputText('شمس, كتاب, مدرسة, صديق, قلم, تفاحة');
      setFileName('imlaa_arabi');
    } else if (newCode === 'en' || newCode === 'en-US') {
      setInputText('apple, dog, cat, sunshine, school, friend');
      setFileName('dictation_english');
    } else if (newCode === 'it') {
      setInputText('palla, stella, cassetto, cappello, gatto, penna');
      setFileName('dettato_italiano');
    }
  };

  // Generazione del file MP3
  const handleGenerate = async () => {
    if (parsedSegments.length === 0) {
      setErrorMessage('Inserisci almeno una parola nel riquadro di testo prima di generare.');
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMessage(null);
      setGenerationProgress(10);
      setGenerationStatus(`Connessione alle voci Google & Android in ${currentLang.name}...`);

      const result = await renderDictationAudio(
        {
          segments: parsedSegments,
          lang: selectedLangCode,
          speed,
          repetitionCount,
          pauseBetweenRepetitions: pauseBetweenReps,
          pauseBetweenWords,
          playChime: false,
        },
        (progress, status) => {
          setGenerationProgress(progress);
          setGenerationStatus(status);
        }
      );

      setMp3Blob(result.mp3Blob);
      setTotalDuration(result.totalDuration);
      setTimings(result.timings);

      setTimeout(() => {
        document.getElementById('risultato-mp3')?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err?.message || 'Si è verificato un errore durante la creazione del file audio.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans pb-16">
      {/* Header pulito e compatto */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-stone-900 leading-tight">
                Generatore Dettati Audio MP3
              </h1>
              <p className="text-xs text-stone-500">Voci Google & Android • Occidentali, Slave e Orientali</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
            Salvataggio MP3 Locale
          </span>
        </div>
      </header>

      {/* Scheda Principale in 4 Passaggi */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-6">

          {/* PASSO 1: SCELTA DELLA LINGUA (Occidentali, Slave, Orientali) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                <span>Scegli la lingua del dettato:</span>
              </label>
              <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                {currentLang.flag} {currentLang.name}
              </span>
            </div>

            {/* Categorie filtri */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setCategoryFilter('tutte')}
                className={`px-3 py-1 rounded-lg border font-medium transition-colors ${
                  categoryFilter === 'tutte'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                Tutte le lingue ({LANGUAGES.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('occidentali')}
                className={`px-3 py-1 rounded-lg border font-medium transition-colors ${
                  categoryFilter === 'occidentali'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                🌍 Occidentali
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('slave')}
                className={`px-3 py-1 rounded-lg border font-medium transition-colors ${
                  categoryFilter === 'slave'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                🏛️ Slave (Russo, Polacco, Ucraino...)
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('orientali')}
                className={`px-3 py-1 rounded-lg border font-medium transition-colors ${
                  categoryFilter === 'orientali'
                    ? 'border-amber-600 bg-amber-600 text-white'
                    : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                }`}
              >
                🌏 Orientali (Cinese, Giapponese, Arabo...)
              </button>
            </div>

            {/* Menu a tendina completo con gruppi */}
            <div className="relative">
              <select
                value={selectedLangCode}
                onChange={(e) => handleLangChange(e.target.value)}
                className="w-full rounded-xl border border-stone-300 p-2.5 text-sm bg-white text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 cursor-pointer"
              >
                {categoryFilter === 'tutte' ? (
                  <>
                    <optgroup label="🌍 Lingue Occidentali">
                      {LANGUAGES.filter((l) => l.category === 'occidentali').map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.flag} {l.name} ({l.nativeName})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🏛️ Lingue Slave">
                      {LANGUAGES.filter((l) => l.category === 'slave').map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.flag} {l.name} ({l.nativeName})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="🌏 Lingue Orientali & Mediorientali">
                      {LANGUAGES.filter((l) => l.category === 'orientali').map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.flag} {l.name} ({l.nativeName})
                        </option>
                      ))}
                    </optgroup>
                  </>
                ) : (
                  filteredLanguages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name} ({l.nativeName})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* PASSO 2: TESTO DEL DETTATO & MODALITÀ DI DIVISIONE (Nessuna parola saltata!) */}
          <div className="space-y-3 pt-4 border-t border-stone-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold">
                  2
                </span>
                <span>Inserisci il testo da dettare:</span>
              </label>

              {/* Selettore modalità di divisione */}
              <div className="flex items-center gap-1 text-xs">
                <span className="text-stone-400 mr-1 hidden sm:inline">Dividi per:</span>
                <button
                  type="button"
                  onClick={() => setSegmentMode('commas')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    segmentMode === 'commas'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                  title="Ideale per liste di parole separate da virgola"
                >
                  Virgole
                </button>
                <button
                  type="button"
                  onClick={() => setSegmentMode('words')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    segmentMode === 'words'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                  title="Ogni singola parola viene detta e ripetuta"
                >
                  Parole
                </button>
                <button
                  type="button"
                  onClick={() => setSegmentMode('sentences')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    segmentMode === 'sentences'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                  title="Frase per frase (separa per punti)"
                >
                  Frasi
                </button>
                <button
                  type="button"
                  onClick={() => setSegmentMode('lines')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    segmentMode === 'lines'
                      ? 'bg-amber-600 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                  title="Ogni riga a capo"
                >
                  Righe
                </button>
              </div>
            </div>

            {detectedMismatch && (
              <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 animate-fadeIn">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Hai inserito caratteri di <strong>{detectedMismatch.label}</strong> mentre la lingua è {currentLang.name}.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLangCode(detectedMismatch.code)}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
                >
                  Imposta {detectedMismatch.label}
                </button>
              </div>
            )}

            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Scrivi le parole separate da virgola (es: palla, stella, cassetto) oppure digita una frase..."
              className="w-full rounded-xl border border-stone-300 p-3.5 text-base text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 leading-relaxed resize-y"
            />

            {/* Sequenza parole individuate con ascolto rapido per garantire che NESSUNA parola venga saltata */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span className="font-semibold text-stone-700">
                  Sequenza dettato ({parsedSegments.length} {parsedSegments.length === 1 ? 'elemento' : 'elementi'} in ordine):
                </span>
                <span className="text-[11px] text-stone-400">
                  Tutte le parole incluse • Clicca per ascoltare
                </span>
              </div>

              {parsedSegments.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {parsedSegments.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleQuickListen(item.text)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        previewingWord === item.text
                          ? 'border-amber-600 bg-amber-100 text-amber-900 animate-pulse'
                          : 'border-stone-200 bg-white hover:bg-stone-100 text-stone-800'
                      }`}
                      title="Clicca per testare la pronuncia"
                    >
                      <span className="text-stone-400 text-[10px] font-mono">{idx + 1}.</span>
                      <span className="font-semibold">{item.text}</span>
                      <Volume2 className="w-3 h-3 text-amber-600" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-400 italic">
                  Nessuna parola trovata nel testo inserito.
                </p>
              )}
            </div>
          </div>

          {/* PASSO 3: VELOCITÀ DI LETTURA (LENTA IN QUESTO CASO) */}
          <div className="space-y-2.5 pt-4 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold">
                  3
                </span>
                <span>Velocità di lettura (lenta):</span>
              </label>
              <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {speed.toFixed(2)}x {speed <= 0.65 ? '(Molto lenta)' : speed <= 0.8 ? '(Lenta dettato)' : '(Normale)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setSpeed(0.6)}
                className={`py-3 px-3 rounded-xl border text-left transition-all ${
                  speed === 0.6
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500/20 shadow-xs'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                }`}
              >
                <div className="text-sm font-bold">Molto lenta (0.60x)</div>
                <div className="text-xs text-stone-500 font-normal">Per primi anni o DSA</div>
              </button>

              <button
                type="button"
                onClick={() => setSpeed(0.75)}
                className={`py-3 px-3 rounded-xl border text-left transition-all ${
                  speed === 0.75
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500/20 shadow-xs'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                }`}
              >
                <div className="text-sm font-bold flex items-center justify-between">
                  <span>Lenta (0.75x)</span>
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-semibold">
                    Consigliata ⭐
                  </span>
                </div>
                <div className="text-xs text-stone-500 font-normal">Ideale per dettati</div>
              </button>

              <button
                type="button"
                onClick={() => setSpeed(1.0)}
                className={`py-3 px-3 rounded-xl border text-left transition-all ${
                  speed === 1.0
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500/20 shadow-xs'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                }`}
              >
                <div className="text-sm font-bold">Normale (1.00x)</div>
                <div className="text-xs text-stone-500 font-normal">Velocità naturale</div>
              </button>
            </div>
          </div>

          {/* PASSO 4: RIPETIZIONI (2 O 3 VOLTE) E PAUSA SCRITTURA */}
          <div className="space-y-3 pt-4 border-t border-stone-100">
            <label className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs flex items-center justify-center font-bold">
                4
              </span>
              <span>Ripeti la parola due o tre volte:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setRepetitionCount(2)}
                className={`py-3 px-3 rounded-xl border text-left transition-all ${
                  repetitionCount === 2
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500/20 shadow-xs'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                }`}
              >
                <div className="text-sm font-bold flex items-center justify-between">
                  <span>Ripeti 2 volte</span>
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-semibold">
                    Standard
                  </span>
                </div>
                <div className="text-xs text-stone-500 font-normal">Ogni parola ripetuta 2 volte</div>
              </button>

              <button
                type="button"
                onClick={() => setRepetitionCount(3)}
                className={`py-3 px-3 rounded-xl border text-left transition-all ${
                  repetitionCount === 3
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500/20 shadow-xs'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                }`}
              >
                <div className="text-sm font-bold">Ripeti 3 volte</div>
                <div className="text-xs text-stone-500 font-normal">Per bambini e ortografia</div>
              </button>

              <button
                type="button"
                onClick={() => setRepetitionCount(1)}
                className={`py-3 px-3 rounded-xl border text-left transition-all ${
                  repetitionCount === 1
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500/20 shadow-xs'
                    : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
                }`}
              >
                <div className="text-sm font-bold">1 volta sola</div>
                <div className="text-xs text-stone-500 font-normal">Nessuna ripetizione</div>
              </button>
            </div>

            {/* Pausa per scrivere */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-stone-600">Pausa per scrivere tra una parola e l'altra:</span>
              <div className="flex items-center gap-1.5">
                {[3, 5, 8].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setPauseBetweenWords(sec)}
                    className={`px-3 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                      pauseBetweenWords === sec
                        ? 'border-amber-600 bg-amber-100 text-amber-900'
                        : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {sec} secondi {sec === 5 && '(consigliata)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Errore eventuale */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Progresso generazione */}
          {isGenerating && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  <span>{generationStatus}</span>
                </div>
                <span>{generationProgress}%</span>
              </div>
              <div className="w-full bg-amber-200/50 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* PULSANTE CREA FILE MP3 */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || parsedSegments.length === 0}
              className="w-full py-4 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-sm transition-transform active:scale-[0.99] cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creazione audio del dettato ({generationProgress}%)...</span>
                </>
              ) : (
                <>
                  <FileAudio className="w-5 h-5" />
                  <span>
                    Crea File Audio MP3 ({parsedSegments.length} parole • ~{formatDuration(estimatedSeconds)})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Player e Download MP3 locale */}
        <div id="risultato-mp3">
          {mp3Blob && (
            <AudioPlayerCard
              mp3Blob={mp3Blob}
              totalDuration={totalDuration}
              timings={timings}
              fileName={fileName}
              onFileNameChange={setFileName}
            />
          )}
        </div>
      </main>
    </div>
  );
}
