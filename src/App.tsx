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
import { playDwellChime, playKeySnapTick, playKeyTypeChime, playAutocompleteChime } from './utils/audio.ts';
import { getAiAutocompleteSuggestion } from './utils/predictive.ts';
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
import { OrientationLockOverlay } from './components/OrientationLockOverlay.tsx';
import { ManualAimingHud } from './components/ManualAimingHud.tsx';
import { Language, translations } from './i18n/translations.ts';

// 2D discrete keyboard matrix for directional eye glances
const getGridMap = (lang: Language = 'es'): string[][] => [
  // Row 0: AI Autocomplete
  ['ai-autocomplete-card'],
  // Row 1: Action buttons
  ['key-speak', 'key-space', 'key-backspace'],
  // Row 2: Letters row 1
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  // Row 3: Letters row 2
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', lang === 'en' ? ';' : 'Ñ'],
  // Row 4: Letters row 3
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '?']
];

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
  
  const [typedMessage, setTypedMessage] = useState<string>('');

  // Mario's Sticky Cursor & Directional Eye Stepper
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [isStickyKeyboardEnabled, setIsStickyKeyboardEnabled] = useState<boolean>(activeProfile.isStickyKeyboardEnabled ?? true);
  const isStickyKeyboardEnabledRef = useRef<boolean>(isStickyKeyboardEnabled);
  isStickyKeyboardEnabledRef.current = isStickyKeyboardEnabled;

  const [stickyFocusedKey, setStickyFocusedKey] = useState<string>('Q');
  const stickyFocusedKeyRef = useRef<string>('Q');
  const keyboardContainerRef = useRef<HTMLDivElement>(null);

  // Grid coordinates for directional navigation
  const [gridRow, setGridRow] = useState<number>(2); // Start at row 2 ('Q')
  const [gridCol, setGridCol] = useState<number>(0);
  const gridRowRef = useRef<number>(2);
  gridRowRef.current = gridRow;
  const gridColRef = useRef<number>(0);
  gridColRef.current = gridCol;

  const neutralCenterRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const lastGlanceDirRef = useRef<'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | null>(null);
  const lastStepTimeRef = useRef<number>(0);
  const [detectedGlanceDirection, setDetectedGlanceDirection] = useState<'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | null>(null);

  const aiSuggestion = useMemo(() => getAiAutocompleteSuggestion(typedMessage, currentLanguage), [typedMessage, currentLanguage]);

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
    isOcularRestMode,
    isAdvancedPanelOpen,
    isGridWizardOpen,
    isOnboardingOpen,
    isProfileModalOpen,
    isPaperModalOpen,
    isVoiceCloningModalOpen,
    isManualAimingMode,
  ]);

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
      isStickyKeyboardEnabled: true,
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
      setIsStickyKeyboardEnabled(loaded[0].isStickyKeyboardEnabled ?? true);

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
      if (typeof activeProfile.isStickyKeyboardEnabled === 'boolean') {
        setIsStickyKeyboardEnabled(activeProfile.isStickyKeyboardEnabled);
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
        eyeTrackerRef.current.setBaselineOffsets(activeProfile.baselineOffsetX || 0, activeProfile.baselineOffsetY || 0);
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

  const handleSpeakTypedMessage = useCallback(() => {
    if (typedMessage.trim()) {
      const messageToSpeak = typedMessage.trim();
      speakText(messageToSpeak, () => {
        setTypedMessage('');
      });
    }
  }, [typedMessage, speakText]);

  const [isBlinkSpeaking, setIsBlinkSpeaking] = useState<boolean>(false);
  const wasBlinkingRef = useRef<boolean>(false);
  const blinkStartTimeRef = useRef<number | null>(null);
  const lastBlinkSpeakTimeRef = useRef<number>(0);

  const handleApplyAiSuggestion = useCallback(() => {
    setIsBlinkSpeaking(true);
    playAutocompleteChime();
    setTypedMessage(aiSuggestion);
    speakText(aiSuggestion, () => {
      setTypedMessage('');
      setIsBlinkSpeaking(false);
    });
    setTimeout(() => {
      setIsBlinkSpeaking(false);
    }, 1800);
  }, [aiSuggestion, speakText]);

  const handleApplyAiSuggestionRef = useRef<() => void>(handleApplyAiSuggestion);
  useEffect(() => {
    handleApplyAiSuggestionRef.current = handleApplyAiSuggestion;
  }, [handleApplyAiSuggestion]);

  const handleKeyType = useCallback((char: string) => {
    playKeyTypeChime();
    setTypedMessage(prev => prev + char);
  }, []);

  // [Paper Section 6.1: Quantized Gaze Glance Engine]
  const stepSelector = useCallback((dir: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN') => {
    const gridMap = getGridMap(currentLanguageRef.current);
    let r = gridRowRef.current;
    let c = gridColRef.current;

    if (dir === 'LEFT') {
      c = Math.max(0, c - 1);
    } else if (dir === 'RIGHT') {
      const maxCol = gridMap[r].length - 1;
      c = Math.min(maxCol, c + 1);
    } else if (dir === 'UP') {
      if (r > 0) {
        const prevRowLen = gridMap[r].length;
        const targetRowLen = gridMap[r - 1].length;
        const ratio = c / Math.max(1, prevRowLen - 1);
        c = Math.min(targetRowLen - 1, Math.round(ratio * (targetRowLen - 1)));
        r = r - 1;
      }
    } else if (dir === 'DOWN') {
      if (r < gridMap.length - 1) {
        const prevRowLen = gridMap[r].length;
        const targetRowLen = gridMap[r + 1].length;
        const ratio = c / Math.max(1, prevRowLen - 1);
        c = Math.min(targetRowLen - 1, Math.round(ratio * (targetRowLen - 1)));
        r = r + 1;
      }
    }

    gridRowRef.current = r;
    gridColRef.current = c;
    setGridRow(r);
    setGridCol(c);

    const targetKey = gridMap[r][c];
    const targetDwellId = r >= 2 ? `char-${targetKey}` : targetKey;
    setStickyFocusedKey(targetKey);
    stickyFocusedKeyRef.current = targetKey;
    setHoveredDwellId(targetDwellId);

    playKeySnapTick();

    dwellStartTimeRef.current = performance.now();
    dwellTargetRef.current = targetDwellId;
    setDwellProgress(0);
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

  const executeCurrentStickyKey = useCallback(() => {
    const gridMap = getGridMap(currentLanguageRef.current);
    const currentKey = stickyFocusedKeyRef.current || gridMap[gridRowRef.current]?.[gridColRef.current];
    if (!currentKey) return;

    if (currentKey === 'ai-autocomplete-card') {
      handleApplyAiSuggestion();
    } else if (currentKey === 'key-speak') {
      handleSpeakTypedMessage();
    } else if (currentKey === 'key-space') {
      handleKeyType(' ');
    } else if (currentKey === 'key-backspace') {
      setTypedMessage(prev => prev.slice(0, -1));
    } else {
      handleKeyType(currentKey);
    }
  }, [handleApplyAiSuggestion, handleSpeakTypedMessage, handleKeyType]);

  const liveCursorPosRef = useRef<{ x: number; y: number }>({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 500,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 400,
  });

  useEffect(() => {
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate3d(${liveCursorPosRef.current.x - 32}px, ${liveCursorPosRef.current.y - 32}px, 0)`;
    }
  }, [isManualAimingMode, activeTab, isStickyKeyboardEnabled]);

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

      if (activeTabRef.current !== 'virtual-keyboard' || !isStickyKeyboardEnabledRef.current) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepSelector('LEFT'); }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepSelector('RIGHT'); }
      if (e.key === 'ArrowUp') { e.preventDefault(); stepSelector('UP'); }
      if (e.key === 'ArrowDown') { e.preventDefault(); stepSelector('DOWN'); }
      if (e.key === 'Enter') { e.preventDefault(); executeCurrentStickyKey(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepSelector, executeCurrentStickyKey, handleNudgeCursor, commitManualAimingToMl]);

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
        if (activeProfile?.calibrationMatrix) {
          eyeTrackerRef.current.setCalibrationMatrix(activeProfile.calibrationMatrix);
        }
        if (typeof activeProfile?.baselineOffsetX === 'number') {
          eyeTrackerRef.current.setBaselineOffsets(activeProfile.baselineOffsetX, activeProfile.baselineOffsetY || 0);
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

  const handleStickyKeyboardChange = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setIsStickyKeyboardEnabled(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (activeProfileRef.current) {
        handleSaveProfile({
          ...activeProfileRef.current,
          isStickyKeyboardEnabled: next,
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

  // Continuous Gaze & Dwell Engine with Bayesian Target Lock + Ocular Sanctuary Midas-Touch Protection
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
    let dwellElement = el?.closest('[data-dwell-id]') as HTMLElement | null;

    // When Full-Screen Ocular Rest Mode is active, only allow dwelling on the central wake target
    if (isOcularRestModeRef.current && dwellElement?.getAttribute('data-dwell-id') !== 'btn-wake-from-rest') {
      dwellElement = null;
    }

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

    let displayX = rawX;
    let displayY = rawY;

    // Bayesian Posterior Target Decoder (active in bayesian-lock paradigm)
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

      if (bayes.lockedTargetId) {
        const lockedEl = document.querySelector(`[data-dwell-id="${CSS.escape(bayes.lockedTargetId)}"]`) as HTMLElement | null;
        if (lockedEl) {
          dwellElement = lockedEl;
          displayX = bayes.displayX;
          displayY = bayes.displayY;
        }
      }
    } else if (lastReportedBayesConfRef.current !== 0) {
      lastReportedBayesConfRef.current = 0;
      setBayesianConfidence(0);
    }

    // Boundary hysteresis: if already dwelling on a button (and not inside sanctuary), tolerate a 22px micro-tremor margin
    if (!dwellElement && !inSanctuary && dwellTargetRef.current) {
      const activeEl = document.querySelector(`[data-dwell-id="${CSS.escape(dwellTargetRef.current)}"]`) as HTMLElement | null;
      if (activeEl) {
        const rect = activeEl.getBoundingClientRect();
        const margin = 22;
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

    // Smooth reticle stabilization toward target center when locked/dwelling
    if (dwellElement && cursorControlModeRef.current !== 'bayesian-lock') {
      const rect = dwellElement.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      displayX = rawX * 0.65 + centerX * 0.35;
      displayY = rawY * 0.65 + centerY * 0.35;
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

  // Squint / Blink Trigger
  useEffect(() => {
    if (trackingInfo?.isSquinting && !isManualAimingModeRef.current && !isOcularRestModeRef.current) {
      const now = performance.now();
      if (activeTabRef.current === 'virtual-keyboard') {
        if (now - lastBlinkSpeakTimeRef.current > 1800) {
          lastBlinkSpeakTimeRef.current = now;
          dwellCooldownUntilRef.current = now + 1100;
          dwellStartTimeRef.current = now + 1100;
          setDwellProgress(0);
          handleApplyAiSuggestionRef.current();
        }
      } else {
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
        }
      }
    }
  }, [trackingInfo?.isSquinting, trainAlgorithmOnSuccess]);

  // 60 FPS Eye Tracking & Directional Stepper Loop
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

          // 1. STICKY KEYBOARD MODE: DISCRETE DIRECTIONAL EYE GESTURES (disabled during Ocular Rest Curtain or Manual Aiming)
          if (
            activeTabRef.current === 'virtual-keyboard' &&
            isStickyKeyboardEnabledRef.current &&
            !isManualAimingModeRef.current &&
            !isOcularRestModeRef.current
          ) {
            const dx = data.rawGazeX - neutralCenterRef.current.x;
            const dy = data.rawGazeY - neutralCenterRef.current.y;

            const threshX = Math.max(0.018, 0.14 / (sensitivityX / 10));
            const threshY = Math.max(0.018, 0.14 / (sensitivityY / 10));

            let glanceDir: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | null = null;
            const ratioX = Math.abs(dx) / threshX;
            const ratioY = Math.abs(dy) / threshY;

            if (ratioX >= 1.0 || ratioY >= 1.0) {
              if (ratioX >= ratioY) {
                glanceDir = dx < 0 ? 'LEFT' : 'RIGHT';
              } else {
                glanceDir = dy < 0 ? 'UP' : 'DOWN';
              }
            }

            if (glanceDir) {
              setDetectedGlanceDirection(glanceDir);
              const isSameDir = glanceDir === lastGlanceDirRef.current;
              const elapsedSinceStep = now - lastStepTimeRef.current;

              if (!isSameDir) {
                lastGlanceDirRef.current = glanceDir;
                lastStepTimeRef.current = now;
                stepSelector(glanceDir);
              } else if (elapsedSinceStep > 460) {
                lastStepTimeRef.current = now - 140;
                stepSelector(glanceDir);
              }
            } else {
              if (ratioX < 0.6 && ratioY < 0.6) {
                lastGlanceDirRef.current = null;
                setDetectedGlanceDirection(null);

                if (data.isFixating) {
                  neutralCenterRef.current.x += dx * 0.015;
                  neutralCenterRef.current.y += dy * 0.015;
                }
              }
            }

            if (now >= dwellCooldownUntilRef.current) {
              if (dwellStartTimeRef.current) {
                const elapsed = now - dwellStartTimeRef.current;
                const progress = Math.min(100, Math.max(0, (elapsed / dwellTimeMsRef.current) * 100));
                setDwellProgress(Math.floor(progress / 5) * 5);

                if (progress >= 100) {
                  playDwellChime();
                  dwellCooldownUntilRef.current = now + 900;
                  dwellStartTimeRef.current = performance.now() + 900;
                  setDwellProgress(0);
                  executeCurrentStickyKey();
                }
              } else {
                dwellStartTimeRef.current = now;
              }
            }
          } else {
            // 2. CONTINUOUS GAZE RETICLE MODE (Bayesian Lock / Ocular Trackball / Two-Stage Loupe / Direct Matrix)
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
  }, [cameraActive, trackingMode, sensitivityX, sensitivityY, stepSelector, executeCurrentStickyKey, updateGazeAndDwell]);

  // Mouse emulation mode
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
      if (isOcularRestModeRef.current || activeTabRef.current !== 'virtual-keyboard' || !isStickyKeyboardEnabledRef.current) {
        updateGazeAndDwell(e.clientX, e.clientY, now);
      }
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
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans select-none relative overflow-x-hidden transition-colors duration-300"
    >
      {/* MOBILE ROTATION & ORIENTATION LOCK OVERLAY */}
      <OrientationLockOverlay currentLanguage={currentLanguage} />

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

      {/* SMOOTH FLOATING GAZE RETICLE */}
      <GazeReticle 
        ref={cursorRef} 
        ringRef={cursorRingRef} 
        visible={isOcularRestMode || isManualAimingMode || !(activeTab === 'virtual-keyboard' && isStickyKeyboardEnabled)}
        isManualAimingMode={isManualAimingMode}
        isDraggingReticle={isDraggingReticle}
        isTrackingPaused={cameraActive && trackingMode === 'webcam' && isTrackingPaused}
        isRestingInSanctuary={isRestingInSanctuary}
        cursorControlMode={cursorControlMode}
        bayesianConfidence={bayesianConfidence}
        loupeState={loupeState}
        onStartDragReticle={handleStartDragReticle}
      />

      {/* TOP HEADER */}
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
        isManualAimingMode={isManualAimingMode}
        onToggleManualAimingMode={() => setIsManualAimingMode(prev => !prev)}
        ocularTheme={ocularTheme}
        onChangeOcularTheme={handleChangeOcularTheme}
        isOcularRestMode={isOcularRestMode}
        onToggleOcularRestMode={handleToggleOcularRestMode}
        currentLanguage={currentLanguage}
        onToggleLanguage={handleToggleLanguage}
      />

      {/* COLLAPSIBLE ADVANCED PANEL */}
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

      {/* CAMERA DISCONNECTED PROMPT */}
      {!cameraActive && !isOnboardingOpen && (
        <div className="mx-3 sm:mx-6 mt-2 sm:mt-3 px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="text-[11px] sm:text-xs text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)] block text-xs sm:text-sm font-semibold">
                {translations[currentLanguage].cameraPrompt.title}
              </strong>
              {translations[currentLanguage].cameraPrompt.description}
            </div>
          </div>
          <button
            onClick={startCamera}
            className="w-full sm:w-auto justify-center px-4 py-2 bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold rounded-lg text-xs flex items-center gap-2 shrink-0"
          >
            <Camera className="w-3.5 h-3.5" />
            {translations[currentLanguage].cameraPrompt.button}
          </button>
        </div>
      )}

      {cameraError && (
        <div className="mx-3 sm:mx-6 mt-2 sm:mt-3 bg-[var(--bg-surface)] border border-[var(--accent-amber)] text-[var(--accent-amber)] px-4 py-2 rounded-xl text-xs flex items-center justify-between">
          <span>{cameraError}</span>
          <button onClick={() => setCameraError(null)} className="underline">Cerrar</button>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-3 sm:py-5 flex flex-col gap-3 sm:gap-4">
        {/* RECENT VOCALIZATION BANNER */}
        <RecentSpeechBanner
          lastSpokenText={lastSpokenText}
          hoveredDwellId={hoveredDwellId}
          onRepeatSpeech={() => speakText(lastSpokenText)}
          currentLanguage={currentLanguage}
        />

        {/* TAB 1: ALS QUICK COMMUNICATION BOARD (PERIFOVEAL RING + CENTRAL OCULAR SANCTUARY) */}
        {activeTab === 'eye-comm' && (
          <ALSQuickBoard
            dwellTimeMs={dwellTimeMs}
            hoveredDwellId={hoveredDwellId}
            dwellProgress={dwellProgress}
            onSelectPreset={(speech) => speakText(speech)}
            isRestingInSanctuary={isRestingInSanctuary}
            onEnterOcularSleep={handleToggleOcularRestMode}
            currentLanguage={currentLanguage}
          />
        )}

        {/* TAB 2: VIRTUAL KEYBOARD WITH DIRECTIONAL GESTURE SELECTOR & OCULAR PAUSE PAD */}
        {activeTab === 'virtual-keyboard' && (
          <VirtualKeyboard
            typedMessage={typedMessage}
            setTypedMessage={setTypedMessage}
            aiSuggestion={aiSuggestion}
            dwellTimeMs={dwellTimeMs}
            dwellProgress={dwellProgress}
            hoveredDwellId={hoveredDwellId}
            stickyFocusedKey={stickyFocusedKey}
            isStickyKeyboardEnabled={isStickyKeyboardEnabled}
            setIsStickyKeyboardEnabled={handleStickyKeyboardChange}
            keyboardContainerRef={keyboardContainerRef}
            onSpeakTypedMessage={handleSpeakTypedMessage}
            onApplyAiSuggestion={handleApplyAiSuggestion}
            onKeyType={handleKeyType}
            detectedGlanceDirection={detectedGlanceDirection}
            onManualDirectionalStep={stepSelector}
            isRestingInSanctuary={isRestingInSanctuary}
            isBlinkSpeaking={isBlinkSpeaking}
            currentLanguage={currentLanguage}
          />
        )}
      </main>

      <footer className="border-t border-[var(--border-hairline)] py-2.5 px-3 sm:px-6 text-center text-[10px] sm:text-[11px] text-[var(--text-muted)] font-mono tracking-wide">
        Instrumentación Oftálmica de Comunicación Aumentativa · Espectro de Baja Fatiga Retiniana · 100% Procesamiento Local
      </footer>
    </div>
  );
}
