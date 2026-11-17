/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Square, Play, RotateCcw, Volume2, Check, X, Sliders, Activity, Radio, Music, Upload, FileAudio,
  BookmarkPlus, Trash2, Brain, Cpu, Bot, Zap
} from 'lucide-react';
import { UserProfile, VoiceProfile, FormantFrequencies, SynthesisEngineMode, BankedPhraseAudio } from '../types/index.ts';
import { Language, translations } from '../i18n/translations.ts';
import { 
  analyzeRecordedAudioBlob, 
  blobToDataURL, 
  synthesizeClonedSpeech, 
  speakWithFormantSynthesizer,
  speakWithMLLPCSynthesizer,
  speakWithNeuralAISynthesizer,
  getRecommendedNeuralVoice,
  playPhysicalFormantChime,
  playVocalFormantSynthesizer,
  findBestMatchingVoice
} from '../utils/voiceCloner.ts';
import { DEFAULT_VOICE_PROFILE } from '../profileManager.ts';

interface VoiceCloningModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile: UserProfile;
  onSaveVoiceProfile: (updatedProfile: UserProfile) => void;
  currentLanguage?: Language;
}

export const VoiceCloningModal: React.FC<VoiceCloningModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
  onSaveVoiceProfile,
  currentLanguage = 'es',
}) => {
  const t = translations[currentLanguage].voiceCloning;

  const currentVoiceProfile: VoiceProfile = activeProfile.voiceProfile || { ...DEFAULT_VOICE_PROFILE };

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(currentVoiceProfile.recordedAudioUrl || null);
  const [audioSourceType, setAudioSourceType] = useState<'mic' | 'upload'>(currentVoiceProfile.audioSourceType || 'mic');
  const [audioFileName, setAudioFileName] = useState<string | undefined>(currentVoiceProfile.audioFileName);
  const [fundamentalFreqHz, setFundamentalFreqHz] = useState<number>(currentVoiceProfile.fundamentalFreqHz || 150);
  const [formants, setFormants] = useState<FormantFrequencies | undefined>(currentVoiceProfile.formants);
  const [spectralCentroidHz, setSpectralCentroidHz] = useState<number | undefined>(currentVoiceProfile.spectralCentroidHz);
  const [glottalHarmonics, setGlottalHarmonics] = useState<number[] | undefined>(currentVoiceProfile.glottalHarmonics);
  const [lpcCoefficients, setLpcCoefficients] = useState<number[] | undefined>(currentVoiceProfile.lpcCoefficients);
  const [vtlnWarpFactor, setVtlnWarpFactor] = useState<number | undefined>(currentVoiceProfile.vtlnWarpFactor);
  const [jitterPercent, setJitterPercent] = useState<number | undefined>(currentVoiceProfile.jitterPercent);
  const [shimmerPercent, setShimmerPercent] = useState<number | undefined>(currentVoiceProfile.shimmerPercent);
  const [brightnessEQ, setBrightnessEQ] = useState<number>(currentVoiceProfile.brightnessEQ ?? 0);
  const [synthesisEngine, setSynthesisEngine] = useState<SynthesisEngineMode>(currentVoiceProfile.synthesisEngine || 'neural-ai');
  const [neuralVoiceName, setNeuralVoiceName] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>(
    currentVoiceProfile.neuralVoiceName || getRecommendedNeuralVoice(currentVoiceProfile.fundamentalFreqHz, currentVoiceProfile.detectedTimbre)
  );
  const [neuralStylePrompt, setNeuralStylePrompt] = useState<string>(currentVoiceProfile.neuralStylePrompt || '');
  const [bankedPhrases, setBankedPhrases] = useState<BankedPhraseAudio[]>(currentVoiceProfile.bankedPhrases || []);
  const [pitchMultiplier, setPitchMultiplier] = useState<number>(currentVoiceProfile.pitchMultiplier || 1.0);
  const [speechRate, setSpeechRate] = useState<number>(currentVoiceProfile.speechRate || 0.95);
  const [volume, setVolume] = useState<number>(currentVoiceProfile.volume ?? 1.0);
  const [selectedVoiceUri, setSelectedVoiceUri] = useState<string>(currentVoiceProfile.voiceUri || '');
  const [detectedTimbre, setDetectedTimbre] = useState<string>(currentVoiceProfile.detectedTimbre || 'Medio');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(currentVoiceProfile.enabled);
  const [testPhrase, setTestPhrase] = useState<string>(t.testPhraseDefault);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingRecorded, setIsPlayingRecorded] = useState<boolean>(false);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [isPlayingFormantSpeech, setIsPlayingFormantSpeech] = useState<boolean>(false);
  const [isPlayingMLSpeech, setIsPlayingMLSpeech] = useState<boolean>(false);
  const [isPlayingNeuralSpeech, setIsPlayingNeuralSpeech] = useState<boolean>(false);
  const [isResonating, setIsResonating] = useState<boolean>(false);
  const [previewingVoiceUri, setPreviewingVoiceUri] = useState<string | null>(null);
  const [bankSavedToast, setBankSavedToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const vp = activeProfile.voiceProfile || { ...DEFAULT_VOICE_PROFILE };
      setRecordedAudioUrl(vp.recordedAudioUrl || null);
      setAudioSourceType(vp.audioSourceType || 'mic');
      setAudioFileName(vp.audioFileName);
      setFundamentalFreqHz(vp.fundamentalFreqHz || 150);
      setFormants(vp.formants);
      setSpectralCentroidHz(vp.spectralCentroidHz);
      setGlottalHarmonics(vp.glottalHarmonics);
      setLpcCoefficients(vp.lpcCoefficients);
      setVtlnWarpFactor(vp.vtlnWarpFactor);
      setJitterPercent(vp.jitterPercent);
      setShimmerPercent(vp.shimmerPercent);
      setBrightnessEQ(vp.brightnessEQ ?? 0);
      setSynthesisEngine(vp.synthesisEngine || 'neural-ai');
      setNeuralVoiceName(vp.neuralVoiceName || getRecommendedNeuralVoice(vp.fundamentalFreqHz, vp.detectedTimbre));
      setNeuralStylePrompt(vp.neuralStylePrompt || '');
      setBankedPhrases(vp.bankedPhrases || []);
      setPitchMultiplier(vp.pitchMultiplier || 1.0);
      setSpeechRate(vp.speechRate || 0.95);
      setVolume(vp.volume ?? 1.0);
      setSelectedVoiceUri(vp.voiceUri || '');
      setDetectedTimbre(vp.detectedTimbre || (currentLanguage === 'en' ? 'Medium' : 'Medio'));
      setIsVoiceEnabled(vp.enabled);
      setTestPhrase(t.testPhraseDefault);
      setErrorMessage(null);
    }
  }, [isOpen, activeProfile, currentLanguage, t.testPhraseDefault]);

  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = currentLanguage === 'en' ? 'en' : 'es';
        const filtered = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
        setAvailableVoices(filtered.length > 0 ? filtered : voices);
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [currentLanguage]);

  useEffect(() => {
    return () => {
      stopRecordingCleanup();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const stopRecordingCleanup = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
  };

  // Draw real-time low-fatigue oscilloscope waveform
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#121310';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2.0;
      ctx.strokeStyle = '#7FA68A'; // Botanical ophthalmic sage
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    render();
  };

  const handleStartRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsAnalyzing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const dataUrl = await blobToDataURL(audioBlob);
          setRecordedAudioUrl(dataUrl);
          setAudioSourceType('mic');
          setAudioFileName(undefined);

          const analysis = await analyzeRecordedAudioBlob(audioBlob);
          setFundamentalFreqHz(analysis.fundamentalFreqHz);
          setPitchMultiplier(analysis.pitchMultiplier);
          setSpeechRate(analysis.speechRate);
          setDetectedTimbre(analysis.timbreDescription);
          setFormants(analysis.formants);
          setSpectralCentroidHz(analysis.spectralCentroidHz);
          setGlottalHarmonics(analysis.glottalHarmonics);
          setLpcCoefficients(analysis.lpcCoefficients);
          setVtlnWarpFactor(analysis.vtlnWarpFactor);
          setJitterPercent(analysis.jitterPercent);
          setShimmerPercent(analysis.shimmerPercent);
          setIsVoiceEnabled(true);

          const recNeuralVoice = getRecommendedNeuralVoice(analysis.fundamentalFreqHz, analysis.timbreDescription);
          setNeuralVoiceName(recNeuralVoice);

          const bestVoice = findBestMatchingVoice(
            availableVoices,
            analysis.fundamentalFreqHz,
            analysis.timbreDescription,
            currentLanguage
          );
          if (bestVoice) {
            setSelectedVoiceUri(bestVoice.voiceURI);
          }
        } catch (err) {
          console.error('Error analyzing audio:', err);
          setErrorMessage(currentLanguage === 'en' ? 'Error decoding audio' : 'Error al decodificar audio');
        } finally {
          setIsAnalyzing(false);
          stopRecordingCleanup();
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      drawWaveform();
    } catch (err: any) {
      console.error('Microphone access error / denied:', err);
      setErrorMessage(t.micErrorNotice);
      stopRecordingCleanup();
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const dataUrl = await blobToDataURL(file);
      setRecordedAudioUrl(dataUrl);
      setAudioSourceType('upload');
      setAudioFileName(file.name);

      const analysis = await analyzeRecordedAudioBlob(file);
      setFundamentalFreqHz(analysis.fundamentalFreqHz);
      setPitchMultiplier(analysis.pitchMultiplier);
      setSpeechRate(analysis.speechRate);
      setDetectedTimbre(analysis.timbreDescription);
      setFormants(analysis.formants);
      setSpectralCentroidHz(analysis.spectralCentroidHz);
      setGlottalHarmonics(analysis.glottalHarmonics);
      setLpcCoefficients(analysis.lpcCoefficients);
      setVtlnWarpFactor(analysis.vtlnWarpFactor);
      setJitterPercent(analysis.jitterPercent);
      setShimmerPercent(analysis.shimmerPercent);
      setIsVoiceEnabled(true);

      const recNeuralVoice = getRecommendedNeuralVoice(analysis.fundamentalFreqHz, analysis.timbreDescription);
      setNeuralVoiceName(recNeuralVoice);

      const bestVoice = findBestMatchingVoice(
        availableVoices,
        analysis.fundamentalFreqHz,
        analysis.timbreDescription,
        currentLanguage
      );
      if (bestVoice) {
        setSelectedVoiceUri(bestVoice.voiceURI);
      }
    } catch (err: any) {
      console.error('Error analyzing uploaded audio:', err);
      setErrorMessage(currentLanguage === 'en' ? 'Could not decode audio file. Please try WAV, MP3, or OGG.' : 'Error al decodificar el archivo de audio. Utilice formatos WAV, MP3 u OGG.');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handlePlayOriginalAudio = () => {
    if (!recordedAudioUrl) return;

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    const audio = new Audio(recordedAudioUrl);
    audioElementRef.current = audio;
    setIsPlayingRecorded(true);

    audio.onended = () => setIsPlayingRecorded(false);
    audio.onerror = () => setIsPlayingRecorded(false);
    audio.play().catch(() => setIsPlayingRecorded(false));
  };

  const handleTestClonedSpeech = () => {
    if (!testPhrase.trim()) return;
    setIsSynthesizing(true);

    const testProfile: VoiceProfile = {
      enabled: true,
      pitchMultiplier,
      speechRate,
      volume,
      voiceUri: selectedVoiceUri || undefined,
      fundamentalFreqHz,
      formants,
      spectralCentroidHz,
      glottalHarmonics,
      brightnessEQ,
      synthesisEngine: 'system-tts',
      detectedTimbre,
      recordedAudioUrl: recordedAudioUrl || undefined,
    };

    synthesizeClonedSpeech(testPhrase, testProfile, currentLanguage, () => {
      setIsSynthesizing(false);
    });
  };

  const handleTestNeuralSpeech = async () => {
    if (!testPhrase.trim()) return;
    setIsPlayingNeuralSpeech(true);

    const testProfile: VoiceProfile = {
      enabled: true,
      synthesisEngine: 'neural-ai',
      neuralVoiceName,
      neuralStylePrompt: neuralStylePrompt.trim() || undefined,
      pitchMultiplier,
      speechRate,
      volume,
      voiceUri: selectedVoiceUri || undefined,
      fundamentalFreqHz,
      formants,
      spectralCentroidHz,
      glottalHarmonics,
      lpcCoefficients,
      vtlnWarpFactor,
      jitterPercent,
      shimmerPercent,
      brightnessEQ,
      detectedTimbre,
      recordedAudioUrl: recordedAudioUrl || undefined,
    };

    await speakWithNeuralAISynthesizer(testPhrase, testProfile, currentLanguage, () => {
      setIsPlayingNeuralSpeech(false);
    });
  };

  const handleTestMLSpeech = () => {
    if (!testPhrase.trim()) return;
    setIsPlayingMLSpeech(true);

    const testProfile: VoiceProfile = {
      enabled: true,
      pitchMultiplier,
      speechRate,
      volume,
      voiceUri: selectedVoiceUri || undefined,
      fundamentalFreqHz,
      formants,
      spectralCentroidHz,
      glottalHarmonics,
      lpcCoefficients,
      vtlnWarpFactor,
      jitterPercent,
      shimmerPercent,
      brightnessEQ,
      synthesisEngine: 'ml-lpc',
      detectedTimbre,
      recordedAudioUrl: recordedAudioUrl || undefined,
    };

    speakWithMLLPCSynthesizer(testPhrase, testProfile, currentLanguage, () => {
      setIsPlayingMLSpeech(false);
    });
  };

  const handleTestFormantSpeech = () => {
    if (!testPhrase.trim()) return;
    setIsPlayingFormantSpeech(true);

    const testProfile: VoiceProfile = {
      enabled: true,
      pitchMultiplier,
      speechRate,
      volume,
      voiceUri: selectedVoiceUri || undefined,
      fundamentalFreqHz,
      formants,
      spectralCentroidHz,
      glottalHarmonics,
      lpcCoefficients,
      vtlnWarpFactor,
      jitterPercent,
      shimmerPercent,
      brightnessEQ,
      synthesisEngine: 'formant-acoustic',
      detectedTimbre,
      recordedAudioUrl: recordedAudioUrl || undefined,
    };

    speakWithFormantSynthesizer(testPhrase, testProfile, currentLanguage, () => {
      setIsPlayingFormantSpeech(false);
    });
  };

  const handlePreviewVoice = (voiceUri: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setPreviewingVoiceUri(voiceUri);

    const matched = availableVoices.find(v => v.voiceURI === voiceUri);
    const sample = currentLanguage === 'en'
      ? 'Voice preview calibrated with your pitch and cadence.'
      : 'Prueba de voz del sistema calibrada con su tono y cadencia.';

    const utt = new SpeechSynthesisUtterance(sample);
    if (matched) utt.voice = matched;
    utt.pitch = Math.max(0.2, Math.min(2.0, pitchMultiplier));
    utt.rate = Math.max(0.5, Math.min(1.8, speechRate));
    utt.volume = volume;
    utt.onend = () => setPreviewingVoiceUri(null);
    utt.onerror = () => setPreviewingVoiceUri(null);
    window.speechSynthesis.speak(utt);
  };

  const handleBankCurrentAudio = () => {
    if (!recordedAudioUrl || !testPhrase.trim()) return;
    const cleanPhrase = testPhrase.trim();
    const newBankItem: BankedPhraseAudio = {
      id: 'bp_' + Date.now(),
      phrase: cleanPhrase,
      audioUrl: recordedAudioUrl,
      recordedAt: Date.now(),
    };

    const existingIdx = bankedPhrases.findIndex(
      bp => bp.phrase.trim().toLowerCase() === cleanPhrase.toLowerCase()
    );
    let updated: BankedPhraseAudio[];
    if (existingIdx >= 0) {
      updated = [...bankedPhrases];
      updated[existingIdx] = newBankItem;
    } else {
      updated = [...bankedPhrases, newBankItem];
    }
    setBankedPhrases(updated);
    setBankSavedToast(cleanPhrase);
    setTimeout(() => setBankSavedToast(null), 3000);
  };

  const handleRemoveBankedPhrase = (id: string) => {
    setBankedPhrases(prev => prev.filter(bp => bp.id !== id));
  };

  const handlePlayBankedPhrase = (bp: BankedPhraseAudio) => {
    const audio = new Audio(bp.audioUrl);
    audio.volume = volume;
    audio.play().catch(() => {});
  };

  const handlePlayFormantChime = () => {
    playPhysicalFormantChime(fundamentalFreqHz, 0.9);
  };

  const handlePlayVocalResonator = () => {
    setIsResonating(true);
    playVocalFormantSynthesizer(fundamentalFreqHz, formants, 1.2);
    setTimeout(() => {
      setIsResonating(false);
    }, 1250);
  };

  const handleResetDefaults = () => {
    setPitchMultiplier(1.0);
    setSpeechRate(0.95);
    setVolume(1.0);
    setSelectedVoiceUri('');
    setFundamentalFreqHz(150);
    setFormants(undefined);
    setSpectralCentroidHz(undefined);
    setGlottalHarmonics(undefined);
    setLpcCoefficients(undefined);
    setVtlnWarpFactor(1.0);
    setJitterPercent(undefined);
    setShimmerPercent(undefined);
    setBrightnessEQ(0);
    setSynthesisEngine('neural-ai');
    setNeuralVoiceName('Kore');
    setNeuralStylePrompt('');
    setAudioSourceType('mic');
    setAudioFileName(undefined);
    setDetectedTimbre(currentLanguage === 'en' ? 'Medium' : 'Medio');
    setIsVoiceEnabled(false);
    setRecordedAudioUrl(null);
    setBankedPhrases([]);
  };

  const handleSave = () => {
    const updatedVoiceProfile: VoiceProfile = {
      enabled: isVoiceEnabled,
      synthesisEngine,
      neuralVoiceName,
      neuralStylePrompt: neuralStylePrompt.trim() || undefined,
      recordedAudioUrl: recordedAudioUrl || undefined,
      audioSourceType,
      audioFileName,
      fundamentalFreqHz,
      formants,
      spectralCentroidHz,
      glottalHarmonics,
      lpcCoefficients,
      vtlnWarpFactor,
      jitterPercent,
      shimmerPercent,
      brightnessEQ,
      pitchMultiplier,
      speechRate,
      volume,
      voiceUri: selectedVoiceUri || undefined,
      detectedTimbre,
      bankedPhrases,
      nlpProsodyEnabled: true,
      recordedAt: Date.now(),
    };

    const updatedUserProfile: UserProfile = {
      ...activeProfile,
      voiceProfile: updatedVoiceProfile,
      updatedAt: Date.now(),
    };

    onSaveVoiceProfile(updatedUserProfile);
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10006] flex items-center justify-center p-3 sm:p-6 bg-[var(--bg-canvas)]/92 backdrop-blur-md animate-in fade-in duration-150 select-none text-[var(--text-primary)]">
      <div 
        className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                  {t.modalTitle}
                </h2>
                <span className="text-xs text-[var(--text-muted)] font-mono">·</span>
                <span className="text-[11px] font-mono text-[var(--accent-primary)]">
                  {t.serverlessBadge}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                {t.modalSubtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            data-dwell-id="voice-modal-close"
            className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CONTENT BODY */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[var(--text-secondary)] font-sans">

          {errorMessage && (
            <div className="p-3 bg-[var(--bg-canvas)] border border-[var(--accent-urgent)] rounded-xl text-[var(--accent-urgent)] flex items-center justify-between">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="underline text-xs">Cerrar</button>
            </div>
          )}

          {/* STEP 1: RECORDING STUDIO */}
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[var(--accent-primary)]" />
                  {t.step1Title}
                </h3>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  {t.step1Desc}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer font-mono text-xs">
                  <input
                    type="checkbox"
                    checked={isVoiceEnabled}
                    onChange={(e) => setIsVoiceEnabled(e.target.checked)}
                    className="accent-[var(--accent-primary)] rounded cursor-pointer w-4 h-4"
                  />
                  <span className={isVoiceEnabled ? 'text-[var(--accent-primary)] font-semibold' : 'text-[var(--text-muted)]'}>
                    {isVoiceEnabled ? 'Voz Personalizada Activa' : 'Voz Estándar'}
                  </span>
                </label>
              </div>
            </div>

            {/* PROMPT PHRASE BOX */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-center font-medium text-[var(--text-primary)]">
              {t.promptText}
            </div>

            {/* LIVE OSCILLOSCOPE CANVAS */}
            <div className="relative w-full h-28 bg-[#121310] rounded-xl border border-[var(--border-hairline)] overflow-hidden flex items-center justify-center">
              <canvas ref={canvasRef} width={640} height={112} className="w-full h-full object-cover" />
              {!isRecording && !isAnalyzing && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#121310]/60 text-[var(--text-muted)] font-mono text-[11px] gap-2">
                  <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Osciloscopio acústico en espera de captura</span>
                </div>
              )}
              {isRecording && (
                <div className="absolute top-2.5 left-3 flex items-center gap-2 bg-[var(--bg-surface)] border border-[var(--accent-urgent)] px-2.5 py-0.5 rounded-md text-[11px] text-[var(--accent-urgent)] font-mono tabular-nums">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-urgent)]" />
                  <span>{t.recordingStatus} ({recordingSeconds}s)</span>
                </div>
              )}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-[var(--bg-canvas)]/90 flex flex-col items-center justify-center gap-2 text-[var(--accent-primary)] font-mono text-xs animate-in fade-in">
                  <Activity className="w-5 h-5" />
                  <span>{t.analyzingVoice}</span>
                </div>
              )}
            </div>

            {/* RECORDING & UPLOAD ACTION BUTTONS */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="audio/*,.wav,.mp3,.ogg,.m4a,.webm,.flac" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
              {!isRecording ? (
                <button
                  onClick={handleStartRecording}
                  data-dwell-id="btn-voice-start-rec"
                  className="px-4 py-2.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold rounded-xl flex items-center gap-2 transition-colors text-xs"
                >
                  <Mic className="w-4 h-4" />
                  {t.startRecording}
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  data-dwell-id="btn-voice-stop-rec"
                  className="px-4 py-2.5 bg-[var(--accent-urgent)] text-white font-semibold rounded-xl flex items-center gap-2 transition-colors text-xs"
                >
                  <Square className="w-4 h-4" />
                  {t.stopRecording}
                </button>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRecording || isAnalyzing}
                data-dwell-id="btn-voice-upload-file"
                className="px-4 py-2.5 bg-[var(--bg-surface)] hover:border-[var(--border-active)] text-[var(--text-primary)] border border-[var(--border-hairline)] font-medium rounded-xl flex items-center gap-2 transition-colors text-xs disabled:opacity-50"
                title={t.uploadDesc}
              >
                <Upload className="w-4 h-4 text-[var(--accent-primary)]" />
                {t.uploadButton}
              </button>

              {audioFileName && (
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-primary)] font-mono bg-[var(--bg-surface)] border border-[var(--border-hairline)] px-3 py-1.5 rounded-lg">
                  <FileAudio className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                  <span className="truncate max-w-[220px]">{audioFileName}</span>
                  <span className="text-[var(--text-muted)] text-[10px]">({t.audioSourceFile})</span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: ACOUSTIC METRICS & DERIVED ML/TTS PARAMETERS */}
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Brain className="w-4 h-4 text-[var(--accent-primary)]" />
                {t.analysisTitle}
              </h3>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[var(--text-muted)]">
                <span>LPC-16 Levinson-Durbin</span>
                <span>·</span>
                <span>Prosodia G2P</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-[var(--text-muted)]">{t.fundamentalFreq}</span>
                <strong className="text-base font-semibold text-[var(--accent-primary)] mt-0.5">{fundamentalFreqHz} Hz</strong>
                <span className="text-[10px] text-[var(--text-muted)]">Autocorrelación F₀</span>
              </div>
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-[var(--text-muted)]">{t.vtlnLabel}</span>
                <strong className="text-base font-semibold text-[var(--text-primary)] mt-0.5">{(vtlnWarpFactor ?? 1.0).toFixed(2)}x</strong>
                <span className="text-[10px] text-[var(--text-muted)]">Tracto Vocal</span>
              </div>
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-[var(--text-muted)]">{t.humanizationLabel}</span>
                <strong className="text-base font-semibold text-[var(--accent-amber)] mt-0.5">
                  {(jitterPercent ?? 0.85).toFixed(1)}% / {(shimmerPercent ?? 2.6).toFixed(1)}%
                </strong>
                <span className="text-[10px] text-[var(--text-muted)]">Jitter · Shimmer</span>
              </div>
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-[10px] text-[var(--text-muted)]">{t.detectedTimbre}</span>
                <strong className="text-base font-semibold text-[var(--text-primary)] mt-0.5">{detectedTimbre}</strong>
                <span className="text-[10px] text-[var(--text-muted)]">Espectro Acústico</span>
              </div>
            </div>

            {formants && (
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex items-center justify-between flex-wrap gap-2 text-[var(--text-secondary)] font-mono text-[11px] tabular-nums">
                <div className="flex items-center gap-2 flex-wrap">
                  <Music className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
                  <span className="font-semibold text-[var(--text-primary)]">{t.formantsLabel}</span>
                  <span>F₁ {Math.round(formants.f1)} Hz</span>
                  <span>·</span>
                  <span>F₂ {Math.round(formants.f2)} Hz</span>
                  <span>·</span>
                  <span>F₃ {Math.round(formants.f3)} Hz</span>
                </div>
                {lpcCoefficients && lpcCoefficients.length > 0 && (
                  <div className="text-[var(--text-muted)] text-[10px] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0" />
                    <span>LPC-16 · 16 polos AR</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 3: SIDE-BY-SIDE SOUND COMPARISON */}
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-[var(--accent-primary)]" />
                {t.comparisonTitle}
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                F₀ {fundamentalFreqHz} Hz · VTLN {(vtlnWarpFactor ?? 1.0).toFixed(2)}x
              </span>
            </div>

            {/* EDITABLE TEST PHRASE & QUICK PRESETS */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-[var(--text-muted)] flex items-center justify-between">
                <span>{t.testPhraseLabel}</span>
                <span className="text-[10px]">Frases clínicas de prueba:</span>
              </label>
              <input
                type="text"
                value={testPhrase}
                onChange={(e) => setTestPhrase(e.target.value)}
                className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl px-3.5 py-2 text-[var(--text-primary)] font-sans text-xs outline-none focus:border-[var(--border-active)] transition-colors"
                placeholder={t.testPhrasePlaceholder}
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {(currentLanguage === 'en' 
                  ? ['Yes', 'No', 'I am in pain', 'Water please', 'Restroom', 'Thank you'] 
                  : ['Sí', 'No', 'Tengo dolor', 'Agua por favor', 'Necesito ir al baño', 'Gracias']
                ).map((phrase) => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => setTestPhrase(phrase)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-mono bg-[var(--bg-surface)] hover:border-[var(--border-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-colors"
                  >
                    «{phrase}»
                  </button>
                ))}
              </div>
            </div>

            {/* ACOUSTIC MORPHING & RESEMBLANCE FINE-TUNER */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {t.matchSimilarityLabel}
                </span>
                <span className="text-[10px] text-[var(--accent-primary)] font-mono">
                  {t.acousticMatchingBadge}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                {t.matchSimilarityDesc}
              </p>

              {/* SLIDERS FOR DIRECT PITCH (F0) & FORMANT VTLN ALIGNMENT */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 tabular-nums">
                <div className="space-y-1 bg-[var(--bg-canvas)] p-2.5 rounded-lg border border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-secondary)] font-medium">{t.fundamentalFreq}</span>
                    <strong className="text-[var(--accent-primary)] font-mono">{Math.round(fundamentalFreqHz)} Hz</strong>
                  </div>
                  <input
                    type="range"
                    min="65"
                    max="280"
                    step="1"
                    value={fundamentalFreqHz}
                    onChange={(e) => {
                      const newF0 = Number(e.target.value);
                      setFundamentalFreqHz(newF0);
                      setPitchMultiplier(Math.round((newF0 / 150) * 100) / 100);
                      setNeuralVoiceName(getRecommendedNeuralVoice(newF0, detectedTimbre));
                    }}
                    className="w-full accent-[var(--accent-primary)] h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono">
                    <span>Grave (70Hz)</span>
                    <span>Medio (150Hz)</span>
                    <span>Agudo (260Hz)</span>
                  </div>
                </div>

                <div className="space-y-1 bg-[var(--bg-canvas)] p-2.5 rounded-lg border border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-secondary)] font-medium">{t.vtlnLabel}</span>
                    <strong className="text-[var(--text-primary)] font-mono">{(vtlnWarpFactor ?? 1.0).toFixed(2)}x</strong>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.25"
                    step="0.01"
                    value={vtlnWarpFactor ?? 1.0}
                    onChange={(e) => setVtlnWarpFactor(Number(e.target.value))}
                    className="w-full accent-[var(--accent-primary)] h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono">
                    <span>Laringe Larga</span>
                    <span>Estándar (1.0x)</span>
                    <span>Laringe Corta</span>
                  </div>
                </div>

                <div className="space-y-1 bg-[var(--bg-canvas)] p-2.5 rounded-lg border border-[var(--border-hairline)]">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--text-secondary)] font-medium">{t.brightnessSlider}</span>
                    <strong className="text-[var(--accent-amber)] font-mono">{brightnessEQ > 0 ? `+${brightnessEQ}` : brightnessEQ} dB</strong>
                  </div>
                  <input
                    type="range"
                    min="-6"
                    max="6"
                    step="0.5"
                    value={brightnessEQ}
                    onChange={(e) => setBrightnessEQ(Number(e.target.value))}
                    className="w-full accent-[var(--accent-amber)] h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] text-[var(--text-muted)] font-mono">
                    <span>Cálido</span>
                    <span>Plano (0 dB)</span>
                    <span>Presencia</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PLAYBACK ACTION BUTTONS */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={handleTestNeuralSpeech}
                disabled={isPlayingNeuralSpeech}
                data-dwell-id="btn-play-neural-speech"
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors ${
                  isPlayingNeuralSpeech
                    ? 'bg-[var(--accent-amber)] text-[var(--accent-contrast)] border-[var(--accent-amber)]'
                    : 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                }`}
              >
                <Bot className="w-4 h-4" />
                {t.playNeuralSpeech}
              </button>

              {recordedAudioUrl && (
                <button
                  onClick={handlePlayOriginalAudio}
                  disabled={isPlayingRecorded}
                  data-dwell-id="btn-play-original-audio"
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 border transition-colors ${
                    isPlayingRecorded
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                      : 'bg-[var(--bg-surface)] hover:border-[var(--border-active)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  {t.playOriginalAudio}
                </button>
              )}

              <button
                onClick={handleTestMLSpeech}
                disabled={isPlayingMLSpeech}
                data-dwell-id="btn-play-ml-speech"
                className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 border transition-colors ${
                  isPlayingMLSpeech
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                    : 'bg-[var(--bg-surface)] hover:border-[var(--border-active)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                {t.playMlSpeech}
              </button>

              <button
                onClick={handleTestFormantSpeech}
                disabled={isPlayingFormantSpeech}
                data-dwell-id="btn-play-formant-speech"
                className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 border transition-colors ${
                  isPlayingFormantSpeech
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                    : 'bg-[var(--bg-surface)] hover:border-[var(--border-active)] text-[var(--text-primary)] border-[var(--border-hairline)]'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                {t.playPhysicalSpeech}
              </button>

              <button
                onClick={handleTestClonedSpeech}
                disabled={isSynthesizing}
                data-dwell-id="btn-play-imitated-speech"
                className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 border transition-colors ${
                  isSynthesizing
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                    : 'bg-[var(--bg-surface)] hover:border-[var(--border-active)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                {t.playImitatedSpeech}
              </button>

              <button
                onClick={handlePlayFormantChime}
                data-dwell-id="btn-play-formant-chime"
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[var(--bg-surface)] hover:border-[var(--border-active)] text-[var(--text-secondary)] border border-[var(--border-hairline)] flex items-center gap-1.5 transition-colors"
              >
                <Music className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                {t.playFormantChime}
              </button>

              <button
                onClick={handlePlayVocalResonator}
                disabled={isResonating}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-[var(--bg-surface)] hover:border-[var(--border-active)] text-[var(--text-secondary)] border border-[var(--border-hairline)] flex items-center gap-1.5 transition-colors"
              >
                <Radio className="w-3.5 h-3.5 text-[var(--accent-amber)]" />
                {t.playVocalResonator}
              </button>
            </div>
          </div>

          {/* STEP 3.5: PRIMARY SYNTHESIS ENGINE MODE */}
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Radio className="w-4 h-4 text-[var(--accent-primary)]" />
              {t.engineModeLabel}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2.5">
              {[
                {
                  id: 'neural-ai' as SynthesisEngineMode,
                  title: t.engineNeuralAi,
                  tag: '24kHz Studio',
                  desc: 'Sintetizador neuronal profundo con entonación humana natural y baja fatiga auditiva.',
                },
                {
                  id: 'hybrid' as SynthesisEngineMode,
                  title: t.engineHybrid,
                  tag: 'Banco + IA',
                  desc: 'Prioriza sus grabaciones reales almacenadas y emplea síntesis neuronal para frases nuevas.',
                },
                {
                  id: 'ml-lpc' as SynthesisEngineMode,
                  title: t.engineMl,
                  tag: 'Local ML',
                  desc: 'Modelo autorregresivo LPC-16 del tracto vocal con prosodia fonética Fujisaki.',
                },
                {
                  id: 'formant-acoustic' as SynthesisEngineMode,
                  title: t.engineFormant,
                  tag: 'Físico',
                  desc: 'Emulación acústica mediante serie armónica glotal y resonadores Biquad F₁-F₃.',
                },
                {
                  id: 'system-tts' as SynthesisEngineMode,
                  title: t.engineTts,
                  tag: 'Nativo OS',
                  desc: 'Ajusta el tono y la cadencia de la voz instalada en el navegador.',
                },
              ].map((eng) => {
                const active = synthesisEngine === eng.id;
                return (
                  <div
                    key={eng.id}
                    onClick={() => setSynthesisEngine(eng.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-colors flex flex-col justify-between ${
                      active
                        ? 'bg-[var(--bg-elevated)] border-[var(--border-active)]'
                        : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] hover:border-[var(--border-active)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5 gap-1">
                        <span className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${active ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'}`} />
                          {eng.title}
                        </span>
                        <span className="text-[9px] font-mono text-[var(--accent-primary)] shrink-0">
                          {eng.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        {eng.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* NEURAL AI PERSONA & STYLE CONTROLS */}
            {(synthesisEngine === 'neural-ai' || synthesisEngine === 'hybrid') && (
              <div className="mt-3 pt-3 border-t border-[var(--border-hairline)] space-y-3 bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-hairline)]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {t.neuralVoiceLabel}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {t.neuralPersonaDesc}
                  </span>
                </div>

                {/* PERSONAS GRID */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {[
                    { id: 'Kore', name: 'Kore', role: currentLanguage === 'en' ? 'Warm / Empathetic' : 'Cálida / Empática', gender: 'F/N', pitchDesc: '> 175 Hz' },
                    { id: 'Puck', name: 'Puck', role: currentLanguage === 'en' ? 'Youthful / Dynamic' : 'Juvenil / Dinámica', gender: 'M/N', pitchDesc: '135-170 Hz' },
                    { id: 'Charon', name: 'Charon', role: currentLanguage === 'en' ? 'Deep Baritone' : 'Barítono Cálido', gender: 'M', pitchDesc: '< 135 Hz' },
                    { id: 'Fenrir', name: 'Fenrir', role: currentLanguage === 'en' ? 'Deep Resonant' : 'Grave Resonante', gender: 'M', pitchDesc: '< 115 Hz' },
                    { id: 'Zephyr', name: 'Zephyr', role: currentLanguage === 'en' ? 'Calm / Balanced' : 'Serena / Equilibrada', gender: 'F/N', pitchDesc: '150-175 Hz' },
                  ].map((p) => {
                    const isSelected = neuralVoiceName === p.id;
                    const isRecommended = getRecommendedNeuralVoice(fundamentalFreqHz, detectedTimbre) === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setNeuralVoiceName(p.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition-colors relative ${
                          isSelected
                            ? 'bg-[var(--bg-elevated)] border-[var(--border-active)]'
                            : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] hover:border-[var(--border-active)]'
                        }`}
                      >
                        {isRecommended && (
                          <span className="absolute -top-2 right-2 px-1.5 py-0.5 text-[8px] font-mono font-semibold rounded bg-[var(--accent-amber)] text-[var(--accent-contrast)] uppercase">
                            F₀ Match
                          </span>
                        )}
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'}`} />
                            {p.name}
                          </span>
                          <span className="text-[9px] font-mono text-[var(--text-muted)]">
                            {p.gender}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] font-medium leading-tight">
                          {p.role}
                        </p>
                        <p className="text-[9px] text-[var(--text-muted)] mt-1 font-mono tabular-nums">
                          {p.pitchDesc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* EXPRESSIVE STYLE PROMPT & PRESETS */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-[var(--accent-primary)]" />
                      {t.neuralStyleLabel}
                    </label>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {currentLanguage === 'en' ? 'Modulates prosody and human warmth' : 'Modula prosodia, entonación y calidez humana'}
                    </span>
                  </div>
                  <input
                    type="text"
                    value={neuralStylePrompt}
                    onChange={(e) => setNeuralStylePrompt(e.target.value)}
                    placeholder={currentLanguage === 'en' 
                      ? 'e.g. Natural, calm human voice with gentle cadence for ALS communication' 
                      : 'ej. Voz humana natural, cálida y pausada para paciente con ELA'}
                    className="w-full bg-[var(--bg-canvas)] border border-[var(--border-hairline)] focus:border-[var(--border-active)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {(currentLanguage === 'en' ? [
                      'Calm and reassuring for ALS assistance',
                      'Expressive and warm human conversation',
                      'Clear, articulated and gentle cadence'
                    ] : [
                      'Pausada y reconfortante para paciente con ELA',
                      'Expresiva y afectuosa con entonación humana natural',
                      'Clara, articulada y con cadencia tranquila'
                    ]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNeuralStylePrompt(preset)}
                        className="px-2.5 py-0.5 rounded-lg text-[10px] bg-[var(--bg-canvas)] hover:border-[var(--border-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] transition-colors"
                      >
                        «{preset}»
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3.6: PERSONAL VOICE BANKING */}
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <BookmarkPlus className="w-4 h-4 text-[var(--accent-primary)]" />
                  {t.bankPhraseTitle}
                </h3>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  Guarde grabaciones reales con su propia voz asociadas a las frases frecuentes del comunicador.
                </p>
              </div>

              <button
                onClick={handleBankCurrentAudio}
                disabled={!recordedAudioUrl || !testPhrase.trim()}
                data-dwell-id="btn-bank-current-phrase"
                className="px-3.5 py-1.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] disabled:opacity-40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                {t.bankCurrentAudioBtn}
              </button>
            </div>

            {bankSavedToast && (
              <div className="p-2.5 bg-[var(--bg-surface)] border border-[var(--border-active)] rounded-xl text-[var(--accent-primary)] text-xs flex items-center gap-2 animate-in fade-in">
                <Check className="w-4 h-4" />
                <span>Frase guardada en su banco de voz: <strong>«{bankSavedToast}»</strong></span>
              </div>
            )}

            {bankedPhrases.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                <div className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                  {bankedPhrases.length} {t.bankedCountLabel}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bankedPhrases.map((bp) => (
                    <div 
                      key={bp.id}
                      className="p-2.5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={() => handlePlayBankedPhrase(bp)}
                          className="p-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--accent-primary)] border border-[var(--border-hairline)] shrink-0"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                          {bp.phrase}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBankedPhrase(bp.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--accent-urgent)] transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[var(--bg-surface)] border border-dashed border-[var(--border-hairline)] rounded-xl text-center text-[var(--text-muted)] text-xs">
                No hay frases almacenadas en el banco aún. Grabe o suba un audio con su voz y pulse «{t.bankCurrentAudioBtn}».
              </div>
            )}
          </div>

          {/* STEP 4: FINE-TUNING SLIDERS & BROWSER VOICE SELECTION */}
          <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--accent-primary)]" />
              {t.fineTuneTitle}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 tabular-nums">
              {/* PITCH SLIDER */}
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--text-primary)]">{t.pitchSlider}</span>
                  <strong className="text-[var(--accent-primary)] font-mono">{pitchMultiplier.toFixed(2)}x</strong>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.8"
                  step="0.05"
                  value={pitchMultiplier}
                  onChange={(e) => setPitchMultiplier(Number(e.target.value))}
                  className="accent-[var(--accent-primary)] cursor-pointer w-full"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                  <span>Grave (0.4x)</span>
                  <span>Normal (1.0x)</span>
                  <span>Agudo (1.8x)</span>
                </div>
              </div>

              {/* RATE SLIDER */}
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--text-primary)]">{t.rateSlider}</span>
                  <strong className="text-[var(--accent-primary)] font-mono">{speechRate.toFixed(2)}x</strong>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.5"
                  step="0.05"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(Number(e.target.value))}
                  className="accent-[var(--accent-primary)] cursor-pointer w-full"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                  <span>Pausado (0.6x)</span>
                  <span>Normal (1.0x)</span>
                  <span>Rápido (1.5x)</span>
                </div>
              </div>

              {/* BRIGHTNESS / PRESENCE EQ SLIDER */}
              <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--text-primary)]">{t.brightnessSlider}</span>
                  <strong className="text-[var(--accent-amber)] font-mono">{brightnessEQ > 0 ? `+${brightnessEQ}` : brightnessEQ} dB</strong>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="6"
                  step="1"
                  value={brightnessEQ}
                  onChange={(e) => setBrightnessEQ(Number(e.target.value))}
                  className="accent-[var(--accent-amber)] cursor-pointer w-full"
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                  <span>Cálido (-6dB)</span>
                  <span>Neutro (0)</span>
                  <span>Presencia (+6dB)</span>
                </div>
              </div>
            </div>

            {/* BASE SYSTEM VOICE SELECTION */}
            {availableVoices.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-[var(--text-secondary)] font-medium">
                    {t.systemVoiceLabel}
                  </label>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    Seleccione una voz base del sistema
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={selectedVoiceUri}
                    onChange={(e) => setSelectedVoiceUri(e.target.value)}
                    className="bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl px-3 py-2 text-xs outline-none font-mono flex-1"
                  >
                    <option value="">{t.autoVoiceOption}</option>
                    {availableVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>

                  {selectedVoiceUri && (
                    <button
                      type="button"
                      onClick={() => handlePreviewVoice(selectedVoiceUri)}
                      disabled={previewingVoiceUri === selectedVoiceUri}
                      className="px-3.5 py-2 bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      {t.previewVoiceBtn}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="px-6 py-4 bg-[var(--bg-canvas)] border-t border-[var(--border-hairline)] flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={handleResetDefaults}
            data-dwell-id="btn-voice-reset"
            className="px-3.5 py-2 bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-[var(--border-hairline)]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t.resetButton}
          </button>

          <div className="flex items-center gap-3">
            {showSavedToast && (
              <span className="text-[var(--accent-primary)] font-mono text-xs flex items-center gap-1 animate-in fade-in">
                <Check className="w-4 h-4" />
                {t.savedToast}
              </span>
            )}

            <button
              onClick={handleSave}
              data-dwell-id="btn-voice-save-profile"
              className="px-6 py-2.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold rounded-xl text-xs flex items-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              {t.saveButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
