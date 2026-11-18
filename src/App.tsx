/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Camera, Eye, SunMedium } from 'lucide-react';
import { UserProfile, EyeTrackingData, CalibrationAlgorithm, OcularTheme, CursorControlMode } from './types/index.ts';
import { BrowserAIEyeTracker } from './eyeTracker.ts';
import { fitCalibrationModel } from './utils/calibration.ts';
import { BayesianTargetDecoder, collectVisibleDwellTargets, invalidateDwellTargetsCache } from './utils/bayesianTargetDecoder.ts';
import { OcularTrackballController, TwoStageLoupeController, TwoStageLoupeState } from './utils/cursorPositioning.ts';
import { 
  loadProfiles, saveProfiles, getDefaultProfile, 
  exportProfilesJSON, importProfilesJSON, hydrateProfilesAudioFromIndexedDB 
} from './profileManager.ts';
import { playDwellChime, playKeySnapTick, playKeyTypeChime, playAutocompleteChime, playEmergencySosSiren } from './utils/audio.ts';
import { getAiAutocompleteSuggestion, recordLearnedUserPhrase } from './utils/predictive.ts';
import { useSpeechSynthesizer } from './hooks/useSpeechSynthesizer.ts';

import { HeaderBar } from './components/HeaderBar.tsx';
import { AdvancedPanel } from './components/AdvancedPanel.tsx';
import { RecentSpeechBanner } from './components/RecentSpeechBanner.tsx';
import { ALSQuickBoard } from './components/ALSQuickBoard.tsx';
import { VirtualKeyboard } from './components/VirtualKeyboard.tsx';
import { GazeReticle } from './components/GazeReticle.tsx';
import { GridCalibrationWizard } from './components/GridCalibrationWizard.tsx';
import { OnboardingSetupModal } from './components/OnboardingSetupModal.tsx';
import { ProfileManagementModal } from './components/ProfileManagementModal.tsx';
import { ScientificPaperModal } from './components/ScientificPaperModal.tsx';
import { VoiceCloningModal } from './components/VoiceCloningModal.tsx';
import { ClinicalCommercialModal } from './components/ClinicalCommercialModal.tsx';
import { ManualAimingHud } from './components/ManualAimingHud.tsx';
import { Language, translations } from './i18n/translations.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'eye-comm' | 'virtual-keyboard'>('eye-comm');
  
  // Profiles state
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  const [isGridWizardOpen, setIsGridWizardOpen] = useState<boolean>(false);
  const isGridWizardOpenRef = useRef<boolean>(false);
  isGridWizardOpenRef.current = isGridWizardOpen;
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isPaperModalOpen, setIsPaperModalOpen] = useState<boolean>(false);
  const [isVoiceCloningModalOpen, setIsVoiceCloningModalOpen] = useState<boolean>(false);
  const [isClinicalModalOpen, setIsClinicalModalOpen] = useState<boolean>(false);
  const [kioskWakeLockActive, setKioskWakeLockActive] = useState<boolean>(true);
  const wakeLockSentinelRef = useRef<any>(null);
  const [isManualAimingMode, setIsManualAimingMode] = useState<boolean>(false);
  const isManualAimingModeRef = useRef<boolean>(false);
  isManualAimingModeRef.current = isManualAimingMode;
  const [isDraggingReticle, setIsDraggingReticle] = useState<boolean>(false);
  const isDraggingReticleRef = useRef<boolean>(false);
  isDraggingReticleRef.current = isDraggingReticle;
  const [lastLearnedTimestamp, setLastLearnedTimestamp] = useState<number | null>(null);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0] || getDefaultProfile();
  const currentLanguage: Language = activeProfile.language || 'es';
  const currentLanguageRef = useRef<Language>(currentLanguage);
  currentLanguageRef.current = currentLanguage;

  // Ophthalmic Spectrum Theme & Ocular Sanctuary Rest Mode
  const [ocularTheme, setOcularTheme] = useState<OcularTheme>(activeProfile.ocularTheme || 'warm-obsidian');
  const [isOcularRestMode, setIsOcularRestMode] = useState<boolean>(false);
  const isOcularRestModeRef = useRef<boolean>(false);
  isOcularRestModeRef.current = isOcularRestMode;
  const [isRestingInSanctuary, setIsRestingInSanctuary] = useState<boolean>(false);
  const isRestingInSanctuaryRef = useRef<boolean>(false);

  const [gazeX, setGazeX] = useState<number>(typeof window !== 'undefined' ? window.innerWidth / 2 : 500);
  const [gazeY, setGazeY] = useState<number>(typeof window !== 'undefined' ? window.innerHeight / 2 : 400);
  const [trackingMode, setTrackingMode] = useState<'webcam' | 'mouse'>('webcam');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [trackingInfo, setTrackingInfo] = useState<EyeTrackingData | null>(null);
  const [isTrackingPaused, setIsTrackingPaused] = useState<boolean>(false);
  const isTrackingPausedRef = useRef<boolean>(false);

  // Sensitivity for subtle eye movements (independent X & Y)
  const [sensitivityX, setSensitivityX] = useState<number>(activeProfile.sensitivityX || 14.0);
  const [sensitivityY, setSensitivityY] = useState<number>(activeProfile.sensitivityY || 14.0);
  const [invertY, setInvertY] = useState<boolean>(activeProfile.invertY || false);
  const [smoothing, setSmoothing] = useState<number>(activeProfile.smoothing || 0.22);
  const [calibrationModel, setCalibrationModel] = useState<CalibrationAlgorithm>(activeProfile.calibrationModel || 'quadrant-matrix');
  const [cursorControlMode, setCursorControlMode] = useState<CursorControlMode>(activeProfile.cursorControlMode || 'bayesian-lock');
  const cursorControlModeRef = useRef<CursorControlMode>(cursorControlMode);
  cursorControlModeRef.current = cursorControlMode;
  const [sensorFusionEnabled, setSensorFusionEnabled] = useState<boolean>(activeProfile.sensorFusionEnabled ?? true);
  const [bayesianConfidence, setBayesianConfidence] = useState<number>(0);
  const lastReportedBayesConfRef = useRef<number>(0);
  const [loupeState, setLoupeState] = useState<TwoStageLoupeState | null>(null);
  const lastReportedLoupeStageRef = useRef<string>('coarse');

  const bayesianDecoderRef = useRef<BayesianTargetDecoder>(new BayesianTargetDecoder());
  const trackballControllerRef = useRef<OcularTrackballController>(new OcularTrackballController());
  const loupeControllerRef = useRef<TwoStageLoupeController>(new TwoStageLoupeController());

  const [ivtStabilizationEnabled, setIvtStabilizationEnabled] = useState<boolean>(activeProfile.ivtStabilizationEnabled ?? true);
  const [verticalGainMultiplier, setVerticalGainMultiplier] = useState<number>(activeProfile.verticalGainMultiplier || 1.15);
  const [dwellTimeMs, setDwellTimeMs] = useState<number>(activeProfile.dwellTimeMs || 1200);
  const [dwellProgress, setDwellProgress] = useState<number>(0);
  const [hoveredDwellId, setHoveredDwellId] = useState<string | null>(null);
  const [isAdaptiveDwellEnabled, setIsAdaptiveDwellEnabled] = useState<boolean>(activeProfile.isAdaptiveDwellEnabled ?? true);
  const [isAdvancedPanelOpen, setIsAdvancedPanelOpen] = useState<boolean>(false);
  
  const sessionSuccessCountRef = useRef<number>(0);
  const sessionCancelCountRef = useRef<number>(0);
  const sessionCharsTypedRef = useRef<number>(0);
  const sessionPhrasesSpokenRef = useRef<number>(0);
  
  const [typedMessage, setTypedMessage] = useState<string>('');

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const keyboardContainerRef = useRef<HTMLDivElement>(null);
  const neutralCenterRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });

  const aiSuggestion = useMemo(
    () => getAiAutocompleteSuggestion(typedMessage, currentLanguage, activeProfile.learnedPhraseCounts),
    [typedMessage, currentLanguage, activeProfile.learnedPhraseCounts]
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const eyeTrackerRef = useRef<BrowserAIEyeTracker | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorRingRef = useRef<SVGCircleElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeProfileRef = useRef<UserProfile>(activeProfile);
  activeProfileRef.current = activeProfile;
  const trackingInfoRef = useRef<EyeTrackingData | null>(trackingInfo);
  trackingInfoRef.current = trackingInfo;

  const {
    isAudioEnabled,
    setIsAudioEnabled,
    lastSpokenText,
    speakText,
  } = useSpeechSynthesizer({
    activeProfileRef,
    currentLanguageRef,
    initialLanguage: currentLanguage,
  });

  const dwellStartTimeRef = useRef<number | null>(null);
  const dwellTargetRef = useRef<string | null>(null);
  const dwellCooldownUntilRef = useRef<number>(0);
  const dwellTimeMsRef = useRef<number>(dwellTimeMs);
  const lastReportedProgRef = useRef<number>(0);
  const lastStateFlushRef = useRef<number>(0);
  const lastLoopTimeRef = useRef<number>(0);
  const invalidGazeElapsedRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Invalidate Bayesian target bounding-box cache when layout/modals/tabs change
  useEffect(() => {
    invalidateDwellTargetsCache();
  }, [
    activeTab,
    typedMessage,
    isOcularRestMode,
    isAdvancedPanelOpen,
    isGridWizardOpen,
    isOnboardingOpen,
    isProfileModalOpen,
    isPaperModalOpen,
    isVoiceCloningModalOpen,
    isClinicalModalOpen,
    isManualAimingMode,
  ]);

  // Wheelchair Kiosk Screen WakeLock management (prevents tablet/laptop sleep while patient communicates)
  useEffect(() => {
    let mounted = true;
    const requestWakeLock = async () => {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && kioskWakeLockActive) {
        try {
          wakeLockSentinelRef.current = await (navigator as any).wakeLock.request('screen');
        } catch {
          // WakeLock API may be restricted in non-visible tabs
        }
      }
    };
    if (kioskWakeLockActive) {
      void requestWakeLock();
    } else if (wakeLockSentinelRef.current) {
      wakeLockSentinelRef.current.release?.().catch(() => {});
      wakeLockSentinelRef.current = null;
    }
    const handleVisibilityChange = () => {
      if (mounted && document.visibilityState === 'visible' && kioskWakeLockActive) {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [kioskWakeLockActive]);

  const handleOnboardingComplete = (name: string, lang: Language = 'es') => {
    const newProf: UserProfile = {
      id: 'profile-' + Date.now(),
      name: name.trim(),
      language: lang,
      ocularTheme: 'warm-obsidian',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      samples: [],
      sensitivityX: 14.0,
      sensitivityY: 14.0,
      smoothing: 0.22,
      calibrationModel: 'quadrant-matrix',
      ivtStabilizationEnabled: true,
      verticalGainMultiplier: 1.15,
      baselineOffsetX: 0,
      baselineOffsetY: 0,
      invertY: false,
      dwellTimeMs: 1200,
      isAdaptiveDwellEnabled: true,
      isStickyKeyboardEnabled: false,
      kioskWakeLockEnabled: true,
    };
    const updated = [newProf];
    setProfiles(updated);
    setActiveProfileId(newProf.id);
    saveProfiles(updated);
    setIsOnboardingOpen(false);
    setTimeout(() => {
      setIsGridWizardOpen(true);
    }, 500);
  };

  // Load profiles on mount and hydrate IndexedDB voice audio blobs
  useEffect(() => {
    const loaded = loadProfiles();
    setProfiles(loaded);
    if (loaded.length === 0) {
      setIsOnboardingOpen(true);
    } else {
      setActiveProfileId(loaded[0].id);
      setSensitivityX(loaded[0].sensitivityX || 14.0);
      setSensitivityY(loaded[0].sensitivityY || 14.0);
      setInvertY(loaded[0].invertY || false);
      setSmoothing(loaded[0].smoothing);
      setCalibrationModel(loaded[0].calibrationModel || 'quadrant-matrix');
      setCursorControlMode(loaded[0].cursorControlMode || 'bayesian-lock');
      setSensorFusionEnabled(loaded[0].sensorFusionEnabled ?? true);
      setIvtStabilizationEnabled(loaded[0].ivtStabilizationEnabled ?? true);
      setVerticalGainMultiplier(loaded[0].verticalGainMultiplier || 1.15);
      setOcularTheme(loaded[0].ocularTheme || 'warm-obsidian');
      setDwellTimeMs(loaded[0].dwellTimeMs || 1200);
      setIsAdaptiveDwellEnabled(loaded[0].isAdaptiveDwellEnabled ?? true);

      void hydrateProfilesAudioFromIndexedDB(loaded).then((hydrated) => {
        if (hydrated !== loaded) {
          setProfiles(hydrated);
        }
      });
    }
  }, []);

  // Update profile parameters when active profile changes
  useEffect(() => {
    if (activeProfile) {
      setSensitivityX(activeProfile.sensitivityX || 14.0);
      setSensitivityY(activeProfile.sensitivityY || 14.0);
      setInvertY(activeProfile.invertY || false);
      setSmoothing(activeProfile.smoothing);
      setCalibrationModel(activeProfile.calibrationModel || 'quadrant-matrix');
      setCursorControlMode(activeProfile.cursorControlMode || 'bayesian-lock');
      setSensorFusionEnabled(activeProfile.sensorFusionEnabled ?? true);
      setIvtStabilizationEnabled(activeProfile.ivtStabilizationEnabled ?? true);
      setVerticalGainMultiplier(activeProfile.verticalGainMultiplier || 1.15);
      setOcularTheme(activeProfile.ocularTheme || 'warm-obsidian');
      if (typeof activeProfile.dwellTimeMs === 'number') {
        setDwellTimeMs(activeProfile.dwellTimeMs);
      }
      if (typeof activeProfile.isAdaptiveDwellEnabled === 'boolean') {
        setIsAdaptiveDwellEnabled(activeProfile.isAdaptiveDwellEnabled);
      }
      if (activeProfile.neutralCenter) {
        neutralCenterRef.current = { ...activeProfile.neutralCenter };
      }
      if (eyeTrackerRef.current) {
        const algo = activeProfile.calibrationModel || 'quadrant-matrix';
        const samples = activeProfile.samples || [];
        eyeTrackerRef.current.setSensitivity(activeProfile.sensitivityX || 14.0, activeProfile.sensitivityY || 14.0);
        eyeTrackerRef.current.setInvertY(activeProfile.invertY || false);
        eyeTrackerRef.current.setSensorFusionEnabled(activeProfile.sensorFusionEnabled ?? true);
        eyeTrackerRef.current.setIvtStabilization(activeProfile.ivtStabilizationEnabled ?? true);
        eyeTrackerRef.current.setVerticalGainMultiplier(activeProfile.verticalGainMultiplier || 1.15);
        eyeTrackerRef.current.setBaselineOffsets(
          samples.length > 0 ? 0 : (activeProfile.baselineOffsetX || 0),
          samples.length > 0 ? 0 : (activeProfile.baselineOffsetY || 0)
        );
        if (activeProfile.neutralCenter) {
          eyeTrackerRef.current.setNeutralCenter(activeProfile.neutralCenter.x, activeProfile.neutralCenter.y);
        }
        eyeTrackerRef.current.setCalibrationAlgorithm(algo);
        eyeTrackerRef.current.setCalibrationSamples(samples, algo);
        if (samples.length === 0) {
          eyeTrackerRef.current.setCalibrationMatrix(activeProfile.calibrationMatrix || null);
        }
      }
    }
  }, [activeProfileId, profiles]);

  useEffect(() => {
    dwellTimeMsRef.current = dwellTimeMs;
  }, [dwellTimeMs]);

  const recordPhraseAndSpeak = useCallback((phrase: string, onDone?: () => void) => {
    sessionPhrasesSpokenRef.current++;
    if (activeProfileRef.current) {
      const updatedLearned = recordLearnedUserPhrase(activeProfileRef.current.learnedPhraseCounts, phrase);
      const updatedProf = {
        ...activeProfileRef.current,
        learnedPhraseCounts: updatedLearned,
        updatedAt: Date.now(),
      };
      setProfiles(prev => {
        const list = prev.map(p => p.id === updatedProf.id ? updatedProf : p);
        saveProfiles(list);
        return list;
      });
    }
    speakText(phrase, onDone);
  }, [speakText]);

  const handleTriggerEmergencySos = useCallback(() => {
    if (activeProfileRef.current?.caregiverConfig?.sirenEnabled !== false) {
      playEmergencySosSiren();
    }
    const sosMsg = currentLanguageRef.current === 'en'
      ? 'Emergency SOS alert! Caregiver or nurse assistance required immediately.'
      : '¡Alerta de emergencia SOS! Necesito asistencia inmediata del cuidador o personal clínico.';
    setTimeout(() => {
      speakText(sosMsg);
    }, 650);
  }, [speakText]);

  const handleSpeakTypedMessage = useCallback(() => {
    if (typedMessage.trim()) {
      const messageToSpeak = typedMessage.trim();
      recordPhraseAndSpeak(messageToSpeak, () => {
        setTypedMessage('');
      });
    }
  }, [typedMessage, recordPhraseAndSpeak]);

  const [isBlinkSpeaking, setIsBlinkSpeaking] = useState<boolean>(false);
  const wasBlinkingRef = useRef<boolean>(false);
  const blinkStartTimeRef = useRef<number | null>(null);
  const lastBlinkSpeakTimeRef = useRef<number>(0);

  const handleApplyAiSuggestion = useCallback(() => {
    setIsBlinkSpeaking(true);
    playAutocompleteChime();
    setTypedMessage(aiSuggestion);
    recordPhraseAndSpeak(aiSuggestion, () => {
      setTypedMessage('');
      setIsBlinkSpeaking(false);
    });
    setTimeout(() => {
      setIsBlinkSpeaking(false);
    }, 1800);
  }, [aiSuggestion, recordPhraseAndSpeak]);

  const handleApplyAiSuggestionRef = useRef<() => void>(handleApplyAiSuggestion);
  useEffect(() => {
    handleApplyAiSuggestionRef.current = handleApplyAiSuggestion;
  }, [handleApplyAiSuggestion]);

  const handleKeyType = useCallback((char: string) => {
    sessionCharsTypedRef.current++;
    playKeyTypeChime();
    setTypedMessage(prev => prev + char);
  }, []);

  const handleToggleLanguage = useCallback((targetLang?: Language) => {
    const nextLang = targetLang || (currentLanguageRef.current === 'es' ? 'en' : 'es');
    if (activeProfileRef.current) {
      const updated = {
        ...activeProfileRef.current,
        language: nextLang,
        updatedAt: Date.now()
      };
      setProfiles(prev => {
        const updatedList = prev.map(p => p.id === updated.id ? updated : p);
        saveProfiles(updatedList);
        return updatedList;
      });
      speakText(nextLang === 'en' ? 'Language switched to English.' : 'Idioma cambiado a Español.');
    }
  }, [speakText]);

  // Safe, functional profile save callback
  const handleSaveProfile = useCallback((updatedProfile: UserProfile) => {
    setProfiles(prev => {
      const updated = prev.map(p => p.id === updatedProfile.id ? updatedProfile : p);
      saveProfiles(updated);
      return updated;
    });
  }, []);

  const handleChangeOcularTheme = useCallback((theme: OcularTheme) => {
    setOcularTheme(theme);
    if (activeProfileRef.current) {
      const updated = {
        ...activeProfileRef.current,
        ocularTheme: theme,
        updatedAt: Date.now(),
      };
      handleSaveProfile(updated);
    }
  }, [handleSaveProfile]);

  const handleToggleOcularRestMode = useCallback(() => {
    setIsOcularRestMode(prev => {
      const next = !prev;
      isOcularRestModeRef.current = next;
      dwellTargetRef.current = null;
      dwellStartTimeRef.current = null;
      setHoveredDwellId(null);
      setDwellProgress(0);
      if (next) {
        speakText(
          currentLanguageRef.current === 'en'
            ? 'Ocular rest mode enabled. Fixate on the central circle when you wish to resume.'
            : 'Modo de descanso ocular activado. Fije la mirada en el círculo central cuando desee reanudar.'
        );
      } else {
        speakText(
          currentLanguageRef.current === 'en'
            ? 'Interface resumed.'
            : 'Comunicador reanudado.'
        );
      }
      return next;
    });
  }, [speakText]);

  const handleToggleInvertY = useCallback(() => {
    setInvertY(prev => {
      const nextVal = !prev;
      if (eyeTrackerRef.current) {
        eyeTrackerRef.current.setInvertY(nextVal);
      }
      if (activeProfileRef.current) {
        const updated = { ...activeProfileRef.current, invertY: nextVal, updatedAt: Date.now() };
        handleSaveProfile(updated);
      }
      speakText(nextVal ? 'Eje vertical invertido.' : 'Eje vertical normal.');
      return nextVal;
    });
  }, [handleSaveProfile, speakText]);

  // Train online multimodal learning model when any button is successfully hit
  const trainAlgorithmOnSuccess = useCallback((targetElement: HTMLElement | null) => {
    if (!targetElement) return;
    const rect = targetElement.getBoundingClientRect();
    const targetCenterX = rect.left + rect.width / 2;
    const targetCenterY = rect.top + rect.height / 2;
    const curTracking = trackingInfoRef.current;
    const curProfile = activeProfileRef.current;

    if (eyeTrackerRef.current && curTracking && curProfile) {
      const headYaw = curTracking.headPose?.normYaw ?? 0;
      const headPitch = curTracking.headPose?.normPitch ?? 0;
      const headRoll = curTracking.headPose?.rollDeg ?? 0;

      const updatedSamples = eyeTrackerRef.current.recordSuccessfulInteraction(
        curTracking.rawGazeX,
        curTracking.rawGazeY,
        targetCenterX,
        targetCenterY,
        headYaw,
        headPitch,
        headRoll
      );
      const updatedProf = { ...curProfile, samples: updatedSamples, updatedAt: Date.now() };
      handleSaveProfile(updatedProf);
    }
  }, [handleSaveProfile]);

  const liveCursorPosRef = useRef<{ x: number; y: number }>({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
  });

  useEffect(() => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${liveCursorPosRef.current.x - 32}px, ${liveCursorPosRef.current.y - 32}px, 0)`;
    }
  }, [isManualAimingMode, activeTab]);

  const commitManualAimingToMl = useCallback((desiredScreenX: number, desiredScreenY: number) => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const clampedX = Math.min(screenW - 5, Math.max(5, desiredScreenX));
    const clampedY = Math.min(screenH - 5, Math.max(5, desiredScreenY));

    const curTracking = trackingInfoRef.current;
    const curProfile = activeProfileRef.current;
    const hasValidGaze = Boolean(
      curTracking &&
      curTracking.faceDetected &&
      curTracking.eyesDetected &&
      Number.isFinite(curTracking.rawGazeX) &&
      Number.isFinite(curTracking.rawGazeY)
    );

    const rawGazeX = hasValidGaze ? curTracking!.rawGazeX : Number.NaN;
    const rawGazeY = hasValidGaze ? curTracking!.rawGazeY : Number.NaN;
    const headYaw = hasValidGaze ? (curTracking!.headPose?.normYaw ?? 0) : 0;
    const headPitch = hasValidGaze ? (curTracking!.headPose?.normPitch ?? 0) : 0;
    const headRoll = hasValidGaze ? (curTracking!.headPose?.rollDeg ?? 0) : 0;

    if (eyeTrackerRef.current) {
      const result = eyeTrackerRef.current.applyManualCalibrationPoint(
        rawGazeX,
        rawGazeY,
        clampedX,
        clampedY,
        headYaw,
        headPitch,
        headRoll
      );

      if (curProfile) {
        const updatedProf: UserProfile = {
          ...curProfile,
          samples: result.samples,
          calibrationMatrix: result.matrix
            ? {
                modelType: curProfile.calibrationModel || 'quadrant-matrix',
                a: result.matrix.a,
                b: result.matrix.b,
                quadrantMatrix: result.matrix.quadrantMatrix,
                tps: result.matrix.tps,
                projective: result.matrix.projective,
                rbf: result.matrix.rbf,
                rmsePx: result.matrix.rmsePx,
                cvRmsePx: result.matrix.cvRmsePx,
                reliabilityScore: result.matrix.reliabilityScore,
                accuracyDeg: result.matrix.accuracyDeg,
              }
            : curProfile.calibrationMatrix,
          baselineOffsetX: result.offsetX,
          baselineOffsetY: result.offsetY,
          updatedAt: Date.now(),
        };
        handleSaveProfile(updatedProf);
      }
    } else if (curProfile) {
      const offsetX = screenW / 2 - clampedX;
      const offsetY = screenH / 2 - clampedY;
      if (hasValidGaze) {
        const nextSamples = [
          ...(curProfile.samples || []),
          {
            targetX: clampedX,
            targetY: clampedY,
            rawPupilX: rawGazeX,
            rawPupilY: rawGazeY,
            headYaw,
            headPitch,
            headRoll,
          },
        ];
        const algo = curProfile.calibrationModel || 'quadrant-matrix';
        const fitted = fitCalibrationModel(nextSamples, algo);
        const updatedProf: UserProfile = {
          ...curProfile,
          samples: nextSamples,
          calibrationMatrix: fitted
            ? {
                modelType: algo,
                a: fitted.a,
                b: fitted.b,
                quadrantMatrix: fitted.quadrantMatrix,
                tps: fitted.tps,
                projective: fitted.projective,
                rbf: fitted.rbf,
                rmsePx: fitted.rmsePx,
                cvRmsePx: fitted.cvRmsePx,
                reliabilityScore: fitted.reliabilityScore,
                accuracyDeg: fitted.accuracyDeg,
              }
            : curProfile.calibrationMatrix,
          baselineOffsetX: 0,
          baselineOffsetY: 0,
          updatedAt: Date.now(),
        };
        handleSaveProfile(updatedProf);
      } else {
        handleSaveProfile({
          ...curProfile,
          baselineOffsetX: offsetX,
          baselineOffsetY: offsetY,
          updatedAt: Date.now(),
        });
      }
    }

    liveCursorPosRef.current = { x: clampedX, y: clampedY };
    setGazeX(clampedX);
    setGazeY(clampedY);
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${clampedX - 32}px, ${clampedY - 32}px, 0)`;
    }
    playKeySnapTick();
    if (hasValidGaze) {
      setLastLearnedTimestamp(Date.now());
    }
  }, [handleSaveProfile]);

  const handleNudgeCursor = useCallback((dxPx: number, dyPx: number, teachMl = false) => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;

    if (eyeTrackerRef.current) {
      const nudged = eyeTrackerRef.current.nudgeAimingOffset(dxPx, dyPx);
      liveCursorPosRef.current = { x: nudged.screenX, y: nudged.screenY };
      setGazeX(nudged.screenX);
      setGazeY(nudged.screenY);
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${nudged.screenX - 32}px, ${nudged.screenY - 32}px, 0)`;
      }
      if (teachMl) {
        commitManualAimingToMl(nudged.screenX, nudged.screenY);
      } else if (activeProfileRef.current) {
        handleSaveProfile({
          ...activeProfileRef.current,
          baselineOffsetX: nudged.offsetX,
          baselineOffsetY: nudged.offsetY,
          updatedAt: Date.now(),
        });
      }
    } else {
      const nextX = Math.min(screenW - 5, Math.max(5, liveCursorPosRef.current.x + dxPx));
      const nextY = Math.min(screenH - 5, Math.max(5, liveCursorPosRef.current.y + dyPx));
      liveCursorPosRef.current = { x: nextX, y: nextY };
      setGazeX(nextX);
      setGazeY(nextY);
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${nextX - 32}px, ${nextY - 32}px, 0)`;
      }
      if (teachMl) {
        commitManualAimingToMl(nextX, nextY);
      } else if (activeProfileRef.current) {
        handleSaveProfile({
          ...activeProfileRef.current,
          baselineOffsetX: (activeProfileRef.current.baselineOffsetX || 0) - dxPx,
          baselineOffsetY: (activeProfileRef.current.baselineOffsetY || 0) - dyPx,
          updatedAt: Date.now(),
        });
      }
    }
    playKeySnapTick();
  }, [commitManualAimingToMl, handleSaveProfile]);

  const handleResetManualOffset = useCallback(() => {
    if (eyeTrackerRef.current) {
      eyeTrackerRef.current.setBaselineOffsets(0, 0);
    }
    if (activeProfileRef.current) {
      handleSaveProfile({
        ...activeProfileRef.current,
        baselineOffsetX: 0,
        baselineOffsetY: 0,
        updatedAt: Date.now(),
      });
    }
    speakText(
      currentLanguageRef.current === 'en'
        ? 'Manual offset reset.'
        : 'Desplazamiento manual restablecido.'
    );
  }, [handleSaveProfile, speakText]);

  const handleScreenDragStart = useCallback((clientX: number, clientY: number) => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const clampedX = Math.min(screenW - 5, Math.max(5, clientX));
    const clampedY = Math.min(screenH - 5, Math.max(5, clientY));

    setIsDraggingReticle(true);
    isDraggingReticleRef.current = true;
    dwellCooldownUntilRef.current = performance.now() + 8000;
    dwellTargetRef.current = null;
    dwellStartTimeRef.current = null;
    setHoveredDwellId(null);
    setDwellProgress(0);
    liveCursorPosRef.current = { x: clampedX, y: clampedY };
    setGazeX(clampedX);
    setGazeY(clampedY);
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${clampedX - 32}px, ${clampedY - 32}px, 0)`;
    }
  }, []);

  const handleScreenDragMove = useCallback((clientX: number, clientY: number) => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const clampedX = Math.min(screenW - 5, Math.max(5, clientX));
    const clampedY = Math.min(screenH - 5, Math.max(5, clientY));

    liveCursorPosRef.current = { x: clampedX, y: clampedY };
    setGazeX(clampedX);
    setGazeY(clampedY);
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${clampedX - 32}px, ${clampedY - 32}px, 0)`;
    }
  }, []);

  const handleScreenDragEnd = useCallback((clientX: number, clientY: number) => {
    setIsDraggingReticle(false);
    isDraggingReticleRef.current = false;
    dwellCooldownUntilRef.current = performance.now() + 750;
    commitManualAimingToMl(clientX, clientY);
  }, [commitManualAimingToMl]);

  const handleStartDragReticle = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleScreenDragStart(e.clientX, e.clientY);

    const onMove = (ev: PointerEvent) => {
      handleScreenDragMove(ev.clientX, ev.clientY);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      handleScreenDragEnd(ev.clientX, ev.clientY);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [handleScreenDragStart, handleScreenDragMove, handleScreenDragEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isAimingShortcut = isManualAimingModeRef.current || e.altKey || e.shiftKey;
      if (isAimingShortcut) {
        const step = e.shiftKey ? 36 : 16;
        if (e.key === 'ArrowLeft') { e.preventDefault(); handleNudgeCursor(-step, 0, false); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); handleNudgeCursor(step, 0, false); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); handleNudgeCursor(0, -step, false); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); handleNudgeCursor(0, step, false); return; }
        if (isManualAimingModeRef.current && e.key === 'Enter') {
          e.preventDefault();
          commitManualAimingToMl(liveCursorPosRef.current.x, liveCursorPosRef.current.y);
          return;
        }
        if (isManualAimingModeRef.current && e.key === 'Escape') {
          e.preventDefault();
          setIsManualAimingMode(false);
          return;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNudgeCursor, commitManualAimingToMl]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (eyeTrackerRef.current) {
        eyeTrackerRef.current.dispose();
        eyeTrackerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((err) => {
          console.debug('Video play deferred:', err);
        });
        eyeTrackerRef.current = new BrowserAIEyeTracker(videoRef.current);
        eyeTrackerRef.current.setSensitivity(sensitivityX, sensitivityY);
        eyeTrackerRef.current.setInvertY(invertY);
        eyeTrackerRef.current.setCalibrationAlgorithm(calibrationModel);
        eyeTrackerRef.current.setSensorFusionEnabled(sensorFusionEnabled);
        eyeTrackerRef.current.setIvtStabilization(ivtStabilizationEnabled);
        eyeTrackerRef.current.setVerticalGainMultiplier(verticalGainMultiplier);
        if (activeProfile?.neutralCenter) {
          neutralCenterRef.current = { ...activeProfile.neutralCenter };
          eyeTrackerRef.current.setNeutralCenter(activeProfile.neutralCenter.x, activeProfile.neutralCenter.y);
        }
        if (activeProfile?.samples) {
          eyeTrackerRef.current.setCalibrationSamples(activeProfile.samples);
        }
        if (activeProfile?.calibrationMatrix && (!activeProfile.samples || activeProfile.samples.length === 0)) {
          eyeTrackerRef.current.setCalibrationMatrix(activeProfile.calibrationMatrix);
        }
        if (typeof activeProfile?.baselineOffsetX === 'number' && (!activeProfile.samples || activeProfile.samples.length === 0)) {
          eyeTrackerRef.current.setBaselineOffsets(activeProfile.baselineOffsetX, activeProfile.baselineOffsetY || 0);
        } else {
          eyeTrackerRef.current.setBaselineOffsets(0, 0);
        }
      }
      invalidGazeElapsedRef.current = 0;
      lastLoopTimeRef.current = performance.now();
      isTrackingPausedRef.current = false;
      setIsTrackingPaused(false);
      setCameraActive(true);
      setTrackingMode('webcam');
      speakText('Cámara activada.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "No se pudo acceder a la cámara. Usando modo ratón.";
      setCameraError(msg);
      setTrackingMode('mouse');
    }
  };

  const stopCamera = () => {
    if (eyeTrackerRef.current) {
      eyeTrackerRef.current.dispose();
      eyeTrackerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    invalidGazeElapsedRef.current = 0;
    isTrackingPausedRef.current = false;
    setIsTrackingPaused(false);
    setCameraActive(false);
    setTrackingMode('mouse');
  };

  useEffect(() => {
    return () => {
      if (eyeTrackerRef.current) {
        eyeTrackerRef.current.dispose();
        eyeTrackerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleDwellTimeChange = useCallback((val: number) => {
    setDwellTimeMs(val);
    if (activeProfileRef.current) {
      handleSaveProfile({
        ...activeProfileRef.current,
        dwellTimeMs: val,
        updatedAt: Date.now(),
      });
    }
  }, [handleSaveProfile]);

  const handleAdaptiveDwellChange = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setIsAdaptiveDwellEnabled(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (activeProfileRef.current) {
        handleSaveProfile({
          ...activeProfileRef.current,
          isAdaptiveDwellEnabled: next,
          updatedAt: Date.now(),
        });
      }
      return next;
    });
  }, [handleSaveProfile]);

  const handleCenterCalibration = () => {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const centerX = screenW / 2;
    const centerY = screenH / 2;

    if (eyeTrackerRef.current && trackingInfo?.faceDetected) {
      eyeTrackerRef.current.calibrateCenter(trackingInfo.gazeScreenX, trackingInfo.gazeScreenY);
      neutralCenterRef.current = { x: trackingInfo.rawGazeX, y: trackingInfo.rawGazeY };
      if (activeProfileRef.current) {
        const updated = {
          ...activeProfileRef.current,
          baselineOffsetX: eyeTrackerRef.current.baselineOffsetX,
          baselineOffsetY: eyeTrackerRef.current.baselineOffsetY,
          neutralCenter: { x: trackingInfo.rawGazeX, y: trackingInfo.rawGazeY },
          updatedAt: Date.now(),
        };
        handleSaveProfile(updated);
      }
      liveCursorPosRef.current = { x: centerX, y: centerY };
      setGazeX(centerX);
      setGazeY(centerY);
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${centerX - 32}px, ${centerY - 32}px, 0)`;
      }
      speakText(translations[currentLanguageRef.current].advancedPanel.fastCenterSuccess || (currentLanguageRef.current === 'en' ? 'Center calibrated successfully.' : 'Centro calibrado correctamente'));
    } else {
      if (eyeTrackerRef.current) {
        eyeTrackerRef.current.setBaselineOffsets(0, 0);
      }
      liveCursorPosRef.current = { x: centerX, y: centerY };
      setGazeX(centerX);
      setGazeY(centerY);
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${centerX - 32}px, ${centerY - 32}px, 0)`;
      }
      if (activeProfileRef.current) {
        handleSaveProfile({
          ...activeProfileRef.current,
          baselineOffsetX: 0,
          baselineOffsetY: 0,
          updatedAt: Date.now(),
        });
      }
      speakText(currentLanguageRef.current === 'en' ? 'Cursor centered.' : 'Cursor centrado.');
    }
  };

  const handleCalibrationModelChange = (model: CalibrationAlgorithm) => {
    setCalibrationModel(model);
    if (eyeTrackerRef.current) {
      eyeTrackerRef.current.setCalibrationAlgorithm(model);
    }
    if (activeProfileRef.current) {
      const updated = { ...activeProfileRef.current, calibrationModel: model, updatedAt: Date.now() };
      handleSaveProfile(updated);
    }
  };

  const handleCursorControlModeChange = (mode: CursorControlMode) => {
    setCursorControlMode(mode);
    cursorControlModeRef.current = mode;
    bayesianDecoderRef.current.reset();
    loupeControllerRef.current.reset();
    setLoupeState(null);
    setBayesianConfidence(0);
    trackballControllerRef.current.setPosition(liveCursorPosRef.current.x, liveCursorPosRef.current.y);
    if (activeProfileRef.current) {
      const updated = { ...activeProfileRef.current, cursorControlMode: mode, updatedAt: Date.now() };
      handleSaveProfile(updated);
    }
  };

  const handleToggleSensorFusion = () => {
    setSensorFusionEnabled(prev => {
      const next = !prev;
      if (eyeTrackerRef.current) {
        eyeTrackerRef.current.setSensorFusionEnabled(next);
      }
      if (activeProfileRef.current) {
        const updated = { ...activeProfileRef.current, sensorFusionEnabled: next, updatedAt: Date.now() };
        handleSaveProfile(updated);
      }
      return next;
    });
  };

  const handleToggleIvtStabilization = () => {
    setIvtStabilizationEnabled(prev => {
      const next = !prev;
      if (eyeTrackerRef.current) {
        eyeTrackerRef.current.setIvtStabilization(next);
      }
      if (activeProfileRef.current) {
        const updated = { ...activeProfileRef.current, ivtStabilizationEnabled: next, updatedAt: Date.now() };
        handleSaveProfile(updated);
      }
      speakText(next ? (currentLanguageRef.current === 'en' ? 'I-VT fixation stabilizer enabled.' : 'Filtro anti-temblor I-VT activado.') : (currentLanguageRef.current === 'en' ? 'Stabilizer disabled.' : 'Filtro anti-temblor desactivado.'));
      return next;
    });
  };

  const handleVerticalGainChange = (val: number) => {
    setVerticalGainMultiplier(val);
    if (eyeTrackerRef.current) {
      eyeTrackerRef.current.setVerticalGainMultiplier(val);
    }
    if (activeProfileRef.current) {
      const updated = { ...activeProfileRef.current, verticalGainMultiplier: val, updatedAt: Date.now() };
      handleSaveProfile(updated);
    }
  };

  const handleCreateNewProfile = () => {
    setIsProfileModalOpen(true);
  };

  const handleSaveProfilesList = (updatedList: UserProfile[], newActiveId?: string) => {
    setProfiles(updatedList);
    saveProfiles(updatedList);
    if (newActiveId) {
      setActiveProfileId(newActiveId);
      const target = updatedList.find(p => p.id === newActiveId);
      if (target) {
        setSensitivityX(target.sensitivityX || 14.0);
        setSensitivityY(target.sensitivityY || 14.0);
        setInvertY(target.invertY || false);
        setSmoothing(target.smoothing);
      }
    } else if (!updatedList.some(p => p.id === activeProfileId) && updatedList.length > 0) {
      setActiveProfileId(updatedList[0].id);
      const target = updatedList[0];
      setSensitivityX(target.sensitivityX || 14.0);
      setSensitivityY(target.sensitivityY || 14.0);
      setInvertY(target.invertY || false);
    }
  };

  const handleSensitivityXChange = (val: number) => {
    setSensitivityX(val);
    if (eyeTrackerRef.current) {
      eyeTrackerRef.current.setSensitivity(val, sensitivityY);
    }
    if (activeProfileRef.current) {
      const updated = { ...activeProfileRef.current, sensitivityX: val, updatedAt: Date.now() };
      handleSaveProfile(updated);
    }
  };

  const handleSensitivityYChange = (val: number) => {
    setSensitivityY(val);
    if (eyeTrackerRef.current) {
      eyeTrackerRef.current.setSensitivity(sensitivityX, val);
    }
    if (activeProfileRef.current) {
      const updated = { ...activeProfileRef.current, sensitivityY: val, updatedAt: Date.now() };
      handleSaveProfile(updated);
    }
  };

  const handleExportBackup = () => {
    exportProfilesJSON();
    speakText('Copia de seguridad exportada correctamente en JSON.');
  };

  const handleRestoreBackupClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const restored = await importProfilesJSON(file);
      setProfiles(restored);
      if (restored.length > 0) setActiveProfileId(restored[0].id);
      speakText('Perfiles restaurados desde JSON con éxito.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError("Error al restaurar archivo: " + msg);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    if (eyeTrackerRef.current) {
      eyeTrackerRef.current.setSensitivity(sensitivityX, sensitivityY);
    }
  }, [sensitivityX, sensitivityY, smoothing]);

  /**
   * [Paper Section 5.1 & 6.2: Continuous Gaze & Dwell Engine with Bayesian Target Lock
   * and Anti-Midas Ocular Sanctuary Protection]
   *
   * Evaluates the current gaze coordinates (rawX, rawY) at timestamp `now`:
   *   1. Enforces post-activation refractory cooldown to prevent accidental double-triggers.
   *   2. Checks whether gaze is parked inside a `[data-sanctuary-zone="true"]` neutral zone;
   *      if so, disarms dwell accumulation and applies passive zero-effort neutral-center drift
   *      compensation (\eta = 0.008) during fixation.
   *   3. When `bayesian-lock` mode is active, invokes the Sequential Bayesian Posterior Decoder
   *      across all visible `[data-dwell-id]` targets to compute posterior probabilities P(T_i | g_{1:t})
   *      and lock onto the highest-posterior target with smooth magnetic centroid attraction.
   *   4. Applies a 26 px boundary hysteresis margin around the currently dwelled target to absorb
   *      physiological oculomotor micro-tremor and nystagmus.
   *   5. Applies sub-pixel visual reticle damping during local fixation (< 28 px step) to eliminate
   *      visual jitter fatigue, and triggers online calibration reinforcement upon 100% dwell completion.
   */
  const updateGazeAndDwell = useCallback((
    rawX: number,
    rawY: number,
    now: number,
    eyeVelocityPxPerSec: number = 0,
    signalQuality: number = 0.85
  ) => {
    if (now < dwellCooldownUntilRef.current) {
      liveCursorPosRef.current = { x: rawX, y: rawY };
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${rawX - 32}px, ${rawY - 32}px, 0)`;
      }
      if (cursorRingRef.current) cursorRingRef.current.style.strokeDashoffset = '175.9';
      return;
    }

    const el = document.elementFromPoint(rawX, rawY);
    let directHitEl = el?.closest('[data-dwell-id]') as HTMLElement | null;

    // When Full-Screen Ocular Rest Mode is active, only allow dwelling on the central wake target
    if (isOcularRestModeRef.current && directHitEl?.getAttribute('data-dwell-id') !== 'btn-wake-from-rest') {
      directHitEl = null;
    }

    let dwellElement: HTMLElement | null = directHitEl;

    // Detect if gaze is resting inside an Ocular Sanctuary zone (and not on an explicit action button inside it)
    const inSanctuary = Boolean(el?.closest('[data-sanctuary-zone="true"]')) && !dwellElement;
    if (inSanctuary !== isRestingInSanctuaryRef.current) {
      isRestingInSanctuaryRef.current = inSanctuary;
      setIsRestingInSanctuary(inSanctuary);
    }

    // Passive zero-effort drift stabilization while resting gaze in the Ocular Sanctuary
    if (inSanctuary && trackingInfoRef.current?.faceDetected && trackingInfoRef.current?.isFixating) {
      neutralCenterRef.current.x += (trackingInfoRef.current.rawGazeX - neutralCenterRef.current.x) * 0.008;
      neutralCenterRef.current.y += (trackingInfoRef.current.rawGazeY - neutralCenterRef.current.y) * 0.008;
    }

    // Position visual cursor directly at the calibrated pupil-imprint / differential coordinate (rawX, rawY)
    let displayX = rawX;
    let displayY = rawY;

    // Bayesian Posterior Target Decoder (active in bayesian-lock paradigm):
    // Always respect a direct geometric hit (`directHitEl`) first so adjacent buttons on compact/mobile
    // screens never hijack the cursor; only fall back to `bayes.lockedTargetId` in narrow inter-button gaps.
    if (cursorControlModeRef.current === 'bayesian-lock' && !inSanctuary) {
      const visibleTargets = collectVisibleDwellTargets(isOcularRestModeRef.current ? 'btn-wake-from-rest' : null);
      const bayes = bayesianDecoderRef.current.update(
        rawX,
        rawY,
        visibleTargets,
        eyeVelocityPxPerSec,
        signalQuality,
        inSanctuary
      );

      if (Math.abs(bayes.confidence - lastReportedBayesConfRef.current) > 0.05) {
        lastReportedBayesConfRef.current = bayes.confidence;
        setBayesianConfidence(bayes.confidence);
      }

      if (!directHitEl && bayes.lockedTargetId) {
        const lockedEl = document.querySelector(`[data-dwell-id="${CSS.escape(bayes.lockedTargetId)}"]`) as HTMLElement | null;
        if (lockedEl) {
          dwellElement = lockedEl;
        }
      }
    } else if (lastReportedBayesConfRef.current !== 0) {
      lastReportedBayesConfRef.current = 0;
      setBayesianConfidence(0);
    }

    // Tight boundary hysteresis (8 px): only when in an empty gap between buttons, tolerate tiny border tremor
    if (!dwellElement && !inSanctuary && dwellTargetRef.current) {
      const activeEl = document.querySelector(`[data-dwell-id="${CSS.escape(dwellTargetRef.current)}"]`) as HTMLElement | null;
      if (activeEl) {
        const rect = activeEl.getBoundingClientRect();
        const margin = 8;
        if (
          rawX >= rect.left - margin &&
          rawX <= rect.right + margin &&
          rawY >= rect.top - margin &&
          rawY <= rect.bottom + margin
        ) {
          dwellElement = activeEl;
        }
      }
    }

    // Sub-pixel micro-tremor smoothing (< 6 px) while preserving immediate differential cursor positioning
    const prevDisplay = liveCursorPosRef.current;
    const stepDisplay = Math.hypot(displayX - prevDisplay.x, displayY - prevDisplay.y);
    if (stepDisplay < 6 && !isManualAimingModeRef.current) {
      const blend = 0.65;
      displayX = prevDisplay.x * (1 - blend) + displayX * blend;
      displayY = prevDisplay.y * (1 - blend) + displayY * blend;
    }

    liveCursorPosRef.current = { x: displayX, y: displayY };
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${displayX - 32}px, ${displayY - 32}px, 0)`;
    }

    if (dwellElement) {
      const dwellId = dwellElement.getAttribute('data-dwell-id');
      if (dwellTargetRef.current === dwellId) {
        if (dwellStartTimeRef.current) {
          const elapsed = now - dwellStartTimeRef.current;
          const requiredMs = dwellId === 'btn-wake-from-rest' ? 1400 : dwellTimeMsRef.current;
          const progress = Math.min(100, Math.max(0, (elapsed / requiredMs) * 100));

          if (cursorRingRef.current) {
            const offset = 175.9 - (175.9 * progress) / 100;
            cursorRingRef.current.style.strokeDashoffset = `${offset}`;
          }

          const roundedProg = Math.floor(progress / 5) * 5;
          if (roundedProg !== lastReportedProgRef.current) {
            lastReportedProgRef.current = roundedProg;
            setDwellProgress(roundedProg);
          }

          if (progress >= 100) {
            playDwellChime();
            dwellCooldownUntilRef.current = now + 900;
            dwellStartTimeRef.current = null;
            dwellTargetRef.current = null;
            lastReportedProgRef.current = 0;
            if (cursorRingRef.current) cursorRingRef.current.style.strokeDashoffset = '175.9';
            setHoveredDwellId(null);
            setDwellProgress(0);

            sessionSuccessCountRef.current++;
            if (isAdaptiveDwellEnabled) {
              setDwellTimeMs(prev => {
                if (sessionSuccessCountRef.current % 2 === 0 && sessionCancelCountRef.current === 0) {
                  return Math.max(700, prev - 50);
                }
                return prev;
              });
            }

            const targetEl = dwellElement;
            trainAlgorithmOnSuccess(targetEl);
            setTimeout(() => targetEl.click(), 10);
          }
        }
      } else {
        dwellTargetRef.current = dwellId;
        dwellStartTimeRef.current = now;
        lastReportedProgRef.current = 0;
        setHoveredDwellId(dwellId);
        setDwellProgress(0);
        if (cursorRingRef.current) cursorRingRef.current.style.strokeDashoffset = '175.9';
      }
    } else {
      if (dwellTargetRef.current !== null) {
        if (!inSanctuary && dwellStartTimeRef.current && (now - dwellStartTimeRef.current > 300)) {
          sessionCancelCountRef.current++;
          if (isAdaptiveDwellEnabled) {
            setDwellTimeMs(prev => Math.min(1800, prev + 80));
          }
        }
        dwellTargetRef.current = null;
        dwellStartTimeRef.current = null;
        lastReportedProgRef.current = 0;
        setHoveredDwellId(null);
        setDwellProgress(0);
        if (cursorRingRef.current) cursorRingRef.current.style.strokeDashoffset = '175.9';
      }
    }
  }, [trainAlgorithmOnSuccess, isAdaptiveDwellEnabled]);

  // Intentional Squint / Sustained Eyelid Narrowing Trigger (activates currently gazed key or button)
  useEffect(() => {
    if (trackingInfo?.isSquinting && !isManualAimingModeRef.current && !isOcularRestModeRef.current) {
      const now = performance.now();
      const el = document.elementFromPoint(liveCursorPosRef.current.x, liveCursorPosRef.current.y);
      const targetElement = el?.closest('[data-dwell-id]') as HTMLElement | null;
      if (targetElement) {
        playKeyTypeChime();
        trainAlgorithmOnSuccess(targetElement);
        if (cursorRingRef.current) {
          cursorRingRef.current.style.strokeDashoffset = '0';
          setTimeout(() => {
            if (cursorRingRef.current) cursorRingRef.current.style.strokeDashoffset = '175.9';
          }, 200);
        }
        dwellCooldownUntilRef.current = now + 850;
        dwellStartTimeRef.current = null;
        dwellTargetRef.current = null;
        lastReportedProgRef.current = 0;
        setHoveredDwellId(null);
        setDwellProgress(0);
        setTimeout(() => targetElement.click(), 10);
      } else if (activeTabRef.current === 'virtual-keyboard' && now - lastBlinkSpeakTimeRef.current > 1800) {
        lastBlinkSpeakTimeRef.current = now;
        dwellCooldownUntilRef.current = now + 1100;
        dwellStartTimeRef.current = now + 1100;
        setDwellProgress(0);
        handleApplyAiSuggestionRef.current();
      }
    }
  }, [trackingInfo?.isSquinting, trainAlgorithmOnSuccess]);

  /**
   * 60 FPS Real-Time Ocular Tracking & Continuous Direct-Gaze Dwell Loop:
   *   - Acquires smoothed/fused binocular gaze telemetry from `BrowserAIEyeTracker.processFrame()`.
   *   - Implements a 750 ms blink-freeze grace window so natural involuntary blinks pause
   *     the dwell timer in-place rather than resetting selection progress.
   *   - Detects intentional sustained blinks (>= 420 ms) on the virtual keyboard to trigger
   *     immediate AI phrase completion.
   *   - Routes valid gaze telemetry across all tabs (both ALS Quick Board and Virtual Keyboard)
   *     directly to the Continuous Gaze & Dwell Engine (`updateGazeAndDwell`).
   */
  useEffect(() => {
    if (!cameraActive || trackingMode !== 'webcam') return;

    const processLoop = async () => {
      const now = performance.now();
      const frameDt = lastLoopTimeRef.current > 0 ? Math.min(100, Math.max(0, now - lastLoopTimeRef.current)) : 16;
      lastLoopTimeRef.current = now;

      if (eyeTrackerRef.current) {
        const data = await eyeTrackerRef.current.processFrame();

        if (isGridWizardOpenRef.current) {
          if (debugCanvasRef.current) {
            eyeTrackerRef.current.drawDebugOverlay(debugCanvasRef.current, data);
          }
          if (now - lastStateFlushRef.current > 16) {
            lastStateFlushRef.current = now;
            setTrackingInfo(data);
          }
        } else if (!data.faceDetected || !data.eyesDetected || data.isBlinking) {
          if (
            data.faceDetected &&
            data.isBlinking &&
            activeTabRef.current === 'virtual-keyboard' &&
            !isManualAimingModeRef.current &&
            !isOcularRestModeRef.current
          ) {
            if (blinkStartTimeRef.current === null) {
              blinkStartTimeRef.current = now;
            } else if (
              !wasBlinkingRef.current &&
              now - blinkStartTimeRef.current >= 420 &&
              now - lastBlinkSpeakTimeRef.current > 1800
            ) {
              // Require >= 420ms intentional sustained blink so normal 100-200ms physiological blinks never erase typed text
              wasBlinkingRef.current = true;
              lastBlinkSpeakTimeRef.current = now;
              dwellCooldownUntilRef.current = now + 1100;
              dwellStartTimeRef.current = now + 1100;
              setDwellProgress(0);
              handleApplyAiSuggestionRef.current();
            }
          } else {
            blinkStartTimeRef.current = null;
          }

          if (!isTrackingPausedRef.current) {
            isTrackingPausedRef.current = true;
            setIsTrackingPaused(true);
          }
          invalidGazeElapsedRef.current += frameDt;
          if (invalidGazeElapsedRef.current < 750 && dwellStartTimeRef.current !== null) {
            dwellStartTimeRef.current += frameDt;
          } else if (invalidGazeElapsedRef.current >= 750) {
            if (dwellTargetRef.current !== null || dwellStartTimeRef.current !== null) {
              dwellTargetRef.current = null;
              dwellStartTimeRef.current = null;
              lastReportedProgRef.current = 0;
              setHoveredDwellId(null);
              setDwellProgress(0);
              if (cursorRingRef.current) cursorRingRef.current.style.strokeDashoffset = '175.9';
            }
          }

          if (debugCanvasRef.current) {
            eyeTrackerRef.current.drawDebugOverlay(debugCanvasRef.current, data);
          }
          if (now - lastStateFlushRef.current > 60) {
            lastStateFlushRef.current = now;
            setTrackingInfo(data);
          }
        } else {
          wasBlinkingRef.current = false;
          blinkStartTimeRef.current = null;
          invalidGazeElapsedRef.current = 0;
          if (isTrackingPausedRef.current) {
            isTrackingPausedRef.current = false;
            setIsTrackingPaused(false);
          }

          // CONTINUOUS CALIBRATED GAZE RETICLE MODE (Active across all communication and keyboard tabs)
          if (!isDraggingReticleRef.current) {
            if (isManualAimingModeRef.current) {
              liveCursorPosRef.current = { x: data.gazeScreenX, y: data.gazeScreenY };
              if (cursorRef.current) {
                cursorRef.current.style.transform = `translate3d(${data.gazeScreenX - 32}px, ${data.gazeScreenY - 32}px, 0)`;
              }
            } else {
              const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
              const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;
              let posX = data.gazeScreenX;
              let posY = data.gazeScreenY;

              if (cursorControlModeRef.current === 'ocular-trackball') {
                const curPos = trackballControllerRef.current.getPosition();
                const curHoverEl = document.elementFromPoint(curPos.x, curPos.y)?.closest('[data-dwell-id]');
                const tb = trackballControllerRef.current.update({
                  rawGazeX: data.rawGazeX,
                  rawGazeY: data.rawGazeY,
                  neutralX: neutralCenterRef.current.x,
                  neutralY: neutralCenterRef.current.y,
                  sensitivityX,
                  sensitivityY,
                  dtSec: frameDt / 1000,
                  screenW,
                  screenH,
                  isOverTarget: Boolean(curHoverEl),
                });
                posX = tb.x;
                posY = tb.y;
              } else if (cursorControlModeRef.current === 'two-stage-loupe') {
                const lp = loupeControllerRef.current.update(
                  data.gazeScreenX,
                  data.gazeScreenY,
                  now,
                  screenW,
                  screenH,
                  isRestingInSanctuaryRef.current
                );
                posX = lp.x;
                posY = lp.y;
                if (lp.stage !== lastReportedLoupeStageRef.current) {
                  lastReportedLoupeStageRef.current = lp.stage;
                  setLoupeState(lp.stage === 'fine-loupe' ? lp : null);
                }
              }

              updateGazeAndDwell(posX, posY, now, data.eyeVelocity, data.signalQuality ?? 0.85);
            }
          }

          if (debugCanvasRef.current) {
            eyeTrackerRef.current.drawDebugOverlay(debugCanvasRef.current, data);
          }

          if (now - lastStateFlushRef.current > 60) {
            lastStateFlushRef.current = now;
            setTrackingInfo(data);
            if (!isDraggingReticleRef.current) {
              setGazeX(data.gazeScreenX);
              setGazeY(data.gazeScreenY);
            }
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(processLoop);
    };

    animFrameRef.current = requestAnimationFrame(processLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraActive, trackingMode, sensitivityX, sensitivityY, updateGazeAndDwell]);

  // Mouse / Pointer emulation fallback when webcam is inactive
  useEffect(() => {
    if (cameraActive && trackingMode !== 'mouse') return;
    if (isTrackingPausedRef.current) {
      isTrackingPausedRef.current = false;
      setIsTrackingPaused(false);
    }
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingReticleRef.current || isManualAimingModeRef.current) return;
      const now = performance.now();
      liveCursorPosRef.current = { x: e.clientX, y: e.clientY };
      updateGazeAndDwell(e.clientX, e.clientY, now);
      if (now - lastStateFlushRef.current > 80) {
        lastStateFlushRef.current = now;
        setGazeX(e.clientX);
        setGazeY(e.clientY);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [cameraActive, trackingMode, updateGazeAndDwell]);

  return (
    <div
      data-ocular-theme={ocularTheme}
      className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans select-none relative transition-colors duration-300"
    >
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".json" 
        onChange={handleFileChange} 
        className="hidden" 
      />

      {/* FULL-SCREEN OCULAR SLEEP / REST CURTAIN */}
      {isOcularRestMode && (
        <div
          data-sanctuary-zone="true"
          className="fixed inset-0 z-[9000] bg-[var(--bg-canvas)]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300"
        >
          <div className="max-w-lg w-full bg-[var(--bg-sanctuary)] border border-[var(--border-hairline)] rounded-2xl p-8 sm:p-10 flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)] ocular-breathe-ring">
              <Eye className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--accent-primary)] font-semibold">
                {currentLanguage === 'en' ? 'Ocular Rest Curtain · Dwell Disarmed' : 'Cortina de Reposo Ocular · Clics En Pausa'}
              </span>
              <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] tracking-tight">
                {currentLanguage === 'en'
                  ? 'Relax your eyelids and ciliary muscles'
                  : 'Relaje los párpados y la musculatura ocular'}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                {currentLanguage === 'en'
                  ? 'All interface buttons are paused so you can close your eyes or look around freely without accidental activations.'
                  : 'Todas las celdas del comunicador están desarmadas para que pueda cerrar los ojos o mirar libremente sin activaciones accidentales.'}
              </p>
            </div>

            <button
              data-dwell-id="btn-wake-from-rest"
              onClick={handleToggleOcularRestMode}
              className={`w-full py-4 px-6 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2.5 relative overflow-hidden transition-colors ${
                hoveredDwellId === 'btn-wake-from-rest'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--border-active)]'
              }`}
            >
              <SunMedium className="w-4 h-4" />
              <span>
                {currentLanguage === 'en'
                  ? 'Fixate here 1.4s (or click) to resume communication'
                  : 'Fijar mirada aquí 1.4s (o pulsar) para reanudar comunicador'}
              </span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-hairline)] overflow-hidden">
                <div
                  className="h-full origin-left transition-transform duration-75 bg-[var(--accent-contrast)]"
                  style={{
                    transform: `scaleX(${hoveredDwellId === 'btn-wake-from-rest' ? dwellProgress / 100 : 0})`,
                  }}
                />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ONBOARDING SETUP MODAL (CAMERA ACTIVATION & INITIAL PROFILE) */}
      <OnboardingSetupModal
        isOpen={isOnboardingOpen}
        cameraActive={cameraActive}
        onRequestCamera={startCamera}
        onComplete={handleOnboardingComplete}
        onSpeak={speakText}
        cameraError={cameraError}
        currentLanguage={currentLanguage}
      />

      {/* ADVANCED PROFILE MANAGEMENT MODAL */}
      <ProfileManagementModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profiles={profiles}
        activeProfileId={activeProfileId}
        onSelectProfile={(id) => {
          setActiveProfileId(id);
          const selected = profiles.find(p => p.id === id);
          if (selected) {
            setSensitivityX(selected.sensitivityX || 14.0);
            setSensitivityY(selected.sensitivityY || 14.0);
            setSmoothing(selected.smoothing);
          }
        }}
        onSaveProfilesList={handleSaveProfilesList}
        onLaunchCalibration={(prof) => {
          setActiveProfileId(prof.id);
          setIsProfileModalOpen(false);
          setTimeout(() => {
            setIsGridWizardOpen(true);
          }, 300);
        }}
        onSpeak={speakText}
        currentLanguage={currentLanguage}
      />

      {/* GRID CALIBRATION WIZARD MODAL */}
      <GridCalibrationWizard
        isOpen={isGridWizardOpen}
        onClose={() => setIsGridWizardOpen(false)}
        activeProfile={activeProfile}
        onSaveProfile={handleSaveProfile}
        trackingInfo={trackingInfo}
        onSpeak={speakText}
        currentLanguage={currentLanguage}
      />

      {/* SCIENTIFIC PAPER VIEWER & LATEX DOWNLOAD MODAL */}
      <ScientificPaperModal
        isOpen={isPaperModalOpen}
        onClose={() => setIsPaperModalOpen(false)}
        currentLanguage={currentLanguage}
      />

      {/* VOICE CLONING & AUDIO IMITATION MODAL */}
      <VoiceCloningModal
        isOpen={isVoiceCloningModalOpen}
        onClose={() => setIsVoiceCloningModalOpen(false)}
        activeProfile={activeProfile}
        onSaveVoiceProfile={handleSaveProfile}
        currentLanguage={currentLanguage}
      />

      {/* CLINICAL COMMERCIAL SaMD SUITE, HL7 FHIR & AES-256 VAULT MODAL */}
      <ClinicalCommercialModal
        isOpen={isClinicalModalOpen}
        onClose={() => setIsClinicalModalOpen(false)}
        activeProfile={activeProfile}
        profiles={profiles}
        onSaveProfile={handleSaveProfile}
        onRestoreProfiles={(restored) => {
          setProfiles(restored);
          if (restored.length > 0) setActiveProfileId(restored[0].id);
        }}
        onTriggerEmergencySos={handleTriggerEmergencySos}
        kioskWakeLockActive={kioskWakeLockActive}
        onToggleKioskWakeLock={() => setKioskWakeLockActive(prev => !prev)}
        currentSessionMetrics={{
          dwellSelectionsCount: sessionSuccessCountRef.current,
          cancelledDwellsCount: sessionCancelCountRef.current,
          charactersTyped: sessionCharsTypedRef.current,
          phrasesVocalized: sessionPhrasesSpokenRef.current,
          meanSaccadicVelocityPxS: trackingInfo?.eyeVelocity || 0,
        }}
        currentLanguage={currentLanguage}
      />

      {/* LIVE MANUAL AIMING & MACHINE LEARNING CALIBRATION HUD */}
      <ManualAimingHud
        isOpen={isManualAimingMode}
        onClose={() => setIsManualAimingMode(false)}
        onNudgeCursor={handleNudgeCursor}
        onTeachCurrentPointToMl={() => commitManualAimingToMl(liveCursorPosRef.current.x, liveCursorPosRef.current.y)}
        onResetManualOffset={handleResetManualOffset}
        onCenterCalibration={handleCenterCalibration}
        onScreenDragStart={handleScreenDragStart}
        onScreenDragMove={handleScreenDragMove}
        onScreenDragEnd={handleScreenDragEnd}
        isDragging={isDraggingReticle}
        cursorX={gazeX}
        cursorY={gazeY}
        offsetX={activeProfile.baselineOffsetX || 0}
        offsetY={activeProfile.baselineOffsetY || 0}
        samplesCount={activeProfile.samples?.length || 0}
        lastLearnedTimestamp={lastLearnedTimestamp}
        currentLanguage={currentLanguage}
      />

      {/* SMOOTH FLOATING GAZE RETICLE (ALWAYS ACTIVE FOR DIRECT OCULAR POINTING) */}
      <GazeReticle 
        ref={cursorRef} 
        ringRef={cursorRingRef} 
        visible={true}
        isManualAimingMode={isManualAimingMode}
        isDraggingReticle={isDraggingReticle}
        isTrackingPaused={cameraActive && trackingMode === 'webcam' && isTrackingPaused}
        isRestingInSanctuary={isRestingInSanctuary}
        cursorControlMode={cursorControlMode}
        bayesianConfidence={bayesianConfidence}
        loupeState={loupeState}
        onStartDragReticle={handleStartDragReticle}
      />

      {/* TOP HEADER (ALL CONTROLS VISIBLE & GAZE-TARGETABLE ON MOBILE AND DESKTOP) */}
      <HeaderBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeProfile={activeProfile}
        isAdvancedPanelOpen={isAdvancedPanelOpen}
        setIsAdvancedPanelOpen={setIsAdvancedPanelOpen}
        isAudioEnabled={isAudioEnabled}
        setIsAudioEnabled={setIsAudioEnabled}
        hoveredDwellId={hoveredDwellId}
        onOpenProfilesModal={() => setIsProfileModalOpen(true)}
        onOpenPaperModal={() => setIsPaperModalOpen(true)}
        onOpenVoiceCloningModal={() => setIsVoiceCloningModalOpen(true)}
        onOpenClinicalModal={() => setIsClinicalModalOpen(true)}
        onTriggerSos={handleTriggerEmergencySos}
        isManualAimingMode={isManualAimingMode}
        onToggleManualAimingMode={() => setIsManualAimingMode(prev => !prev)}
        ocularTheme={ocularTheme}
        onChangeOcularTheme={handleChangeOcularTheme}
        isOcularRestMode={isOcularRestMode}
        onToggleOcularRestMode={handleToggleOcularRestMode}
        currentLanguage={currentLanguage}
        onToggleLanguage={handleToggleLanguage}
      />

      {/* COLLAPSIBLE ADVANCED PANEL OVERLAY (Does not displace the 100dvh single-screen layout) */}
      {isAdvancedPanelOpen && (
        <div className="fixed inset-x-0 top-[76px] lg:top-[52px] bottom-0 z-40 overflow-y-auto bg-[var(--bg-canvas)]/95 backdrop-blur-md">
          <AdvancedPanel
            isOpen={isAdvancedPanelOpen}
            profiles={profiles}
            activeProfileId={activeProfileId}
            setActiveProfileId={setActiveProfileId}
            activeProfile={activeProfile}
            onCreateNewProfile={handleCreateNewProfile}
            sensitivityX={sensitivityX}
            sensitivityY={sensitivityY}
            onSensitivityXChange={handleSensitivityXChange}
            onSensitivityYChange={handleSensitivityYChange}
            invertY={invertY}
            onToggleInvertY={handleToggleInvertY}
            dwellTimeMs={dwellTimeMs}
            setDwellTimeMs={handleDwellTimeChange}
            isAdaptiveDwellEnabled={isAdaptiveDwellEnabled}
            setIsAdaptiveDwellEnabled={handleAdaptiveDwellChange}
            onLaunchGridWizard={() => setIsGridWizardOpen(true)}
            onCenterCalibration={handleCenterCalibration}
            onExportBackup={handleExportBackup}
            onRestoreBackupClick={handleRestoreBackupClick}
            cameraActive={cameraActive}
            onStartCamera={startCamera}
            onStopCamera={stopCamera}
            debugCanvasRef={debugCanvasRef}
            trackingInfo={trackingInfo}
            calibrationModel={calibrationModel}
            onCalibrationModelChange={handleCalibrationModelChange}
            cursorControlMode={cursorControlMode}
            onCursorControlModeChange={handleCursorControlModeChange}
            sensorFusionEnabled={sensorFusionEnabled}
            onToggleSensorFusion={handleToggleSensorFusion}
            ivtStabilizationEnabled={ivtStabilizationEnabled}
            onToggleIvtStabilization={handleToggleIvtStabilization}
            verticalGainMultiplier={verticalGainMultiplier}
            onVerticalGainChange={handleVerticalGainChange}
            onOpenPaperModal={() => setIsPaperModalOpen(true)}
            onOpenVoiceCloningModal={() => setIsVoiceCloningModalOpen(true)}
            currentLanguage={currentLanguage}
          />
        </div>
      )}

      {/* COMPACT CAMERA DISCONNECTED PROMPT (Gaze-targetable via data-dwell-id) */}
      {!cameraActive && !isOnboardingOpen && (
        <div className="mx-2 sm:mx-6 mt-1 sm:mt-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Camera className="w-3.5 h-3.5" />
            </div>
            <div className="text-[11px] sm:text-xs text-[var(--text-secondary)] truncate">
              <strong className="text-[var(--text-primary)] font-semibold mr-1.5">
                {translations[currentLanguage].cameraPrompt.title}
              </strong>
              <span className="hidden md:inline">{translations[currentLanguage].cameraPrompt.description}</span>
            </div>
          </div>
          <button
            type="button"
            data-dwell-id="btn-start-camera"
            onClick={startCamera}
            className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
              hoveredDwellId === 'btn-start-camera'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] ring-2 ring-[var(--accent-primary)]'
                : 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{translations[currentLanguage].cameraPrompt.button}</span>
          </button>
        </div>
      )}

      {cameraError && (
        <div className="mx-2 sm:mx-6 mt-1 bg-[var(--bg-surface)] border border-[var(--accent-amber)] text-[var(--accent-amber)] px-3 py-1.5 rounded-xl text-xs flex items-center justify-between shrink-0">
          <span className="truncate">{cameraError}</span>
          <button
            type="button"
            data-dwell-id="btn-dismiss-camera-error"
            onClick={() => setCameraError(null)}
            className="underline ml-2 shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* MAIN SINGLE-SCREEN VIEWPORT (100% fits inside 100dvh without vertical page scroll) */}
      <main className="flex-1 min-h-0 max-w-7xl w-full mx-auto px-2 sm:px-6 py-1.5 sm:py-3 flex flex-col gap-1.5 sm:gap-3 overflow-hidden">
        {/* RECENT VOCALIZATION BANNER */}
        <RecentSpeechBanner
          lastSpokenText={lastSpokenText}
          hoveredDwellId={hoveredDwellId}
          onRepeatSpeech={() => recordPhraseAndSpeak(lastSpokenText)}
          currentLanguage={currentLanguage}
        />

        {/* TAB 1: ALS QUICK COMMUNICATION BOARD (PERIFOVEAL RING + CENTRAL OCULAR SANCTUARY) */}
        {activeTab === 'eye-comm' && (
          <ALSQuickBoard
            dwellTimeMs={dwellTimeMs}
            hoveredDwellId={hoveredDwellId}
            dwellProgress={dwellProgress}
            onSelectPreset={(speech, presetId) => {
              if (presetId === 'nurse' && activeProfile.caregiverConfig?.sirenEnabled !== false) {
                playEmergencySosSiren();
                setTimeout(() => recordPhraseAndSpeak(speech), 600);
              } else {
                recordPhraseAndSpeak(speech);
              }
            }}
            isRestingInSanctuary={isRestingInSanctuary}
            onEnterOcularSleep={handleToggleOcularRestMode}
            currentLanguage={currentLanguage}
          />
        )}

        {/* TAB 2: DIRECT-GAZE VIRTUAL KEYBOARD WITH 1-DWELL WORD COMPLETION & OCULAR PAUSE PAD */}
        {activeTab === 'virtual-keyboard' && (
          <VirtualKeyboard
            typedMessage={typedMessage}
            setTypedMessage={setTypedMessage}
            aiSuggestion={aiSuggestion}
            dwellTimeMs={dwellTimeMs}
            dwellProgress={dwellProgress}
            hoveredDwellId={hoveredDwellId}
            keyboardContainerRef={keyboardContainerRef}
            onSpeakTypedMessage={handleSpeakTypedMessage}
            onApplyAiSuggestion={handleApplyAiSuggestion}
            onKeyType={handleKeyType}
            isRestingInSanctuary={isRestingInSanctuary}
            isBlinkSpeaking={isBlinkSpeaking}
            currentLanguage={currentLanguage}
          />
        )}
      </main>
    </div>
  );
}

