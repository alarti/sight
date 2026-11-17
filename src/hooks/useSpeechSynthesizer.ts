/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, MutableRefObject } from 'react';
import { UserProfile } from '../types/index.ts';
import { Language } from '../i18n/translations.ts';
import { playBankedPhraseOrSynthesize } from '../utils/voiceCloner.ts';

interface UseSpeechSynthesizerParams {
  activeProfileRef: MutableRefObject<UserProfile>;
  currentLanguageRef: MutableRefObject<Language>;
  initialLanguage: Language;
}

export function useSpeechSynthesizer({
  activeProfileRef,
  currentLanguageRef,
  initialLanguage,
}: UseSpeechSynthesizerParams) {
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [lastSpokenText, setLastSpokenText] = useState<string>(
    initialLanguage === 'en' ? 'ALS Assistive System ready.' : 'Sistema de Asistencia ELA listo.'
  );

  const speakText = useCallback(
    (text: string, onEnd?: () => void) => {
      setLastSpokenText(text);
      if (!isAudioEnabled) {
        if (onEnd) onEnd();
        return;
      }

      const vp = activeProfileRef.current?.voiceProfile;
      if (vp && vp.enabled && vp.synthesisEngine !== 'system-tts') {
        playBankedPhraseOrSynthesize(text, vp, currentLanguageRef.current, onEnd);
        return;
      }

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLanguageRef.current === 'en' ? 'en-US' : 'es-ES';
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        if (vp && vp.enabled) {
          utterance.pitch = vp.pitchMultiplier;
          utterance.rate = vp.speechRate;
          utterance.volume = vp.volume;
          if (vp.voiceUri) {
            const voices = window.speechSynthesis.getVoices();
            const matchedVoice = voices.find((v) => v.voiceURI === vp.voiceUri);
            if (matchedVoice) {
              utterance.voice = matchedVoice;
            }
          }
        }

        let hasFinished = false;
        const handleFinish = () => {
          if (!hasFinished) {
            hasFinished = true;
            if (onEnd) onEnd();
          }
        };

        utterance.onend = handleFinish;
        utterance.onerror = handleFinish;

        const wordCount = text.trim().split(/\s+/).length;
        const rateFactor = utterance.rate || 1.0;
        const estimatedDurationMs = Math.max(1600, Math.round((wordCount * 650) / rateFactor));
        setTimeout(handleFinish, estimatedDurationMs + 400);

        window.speechSynthesis.speak(utterance);
      } else {
        if (onEnd) onEnd();
      }
    },
    [isAudioEnabled, activeProfileRef, currentLanguageRef]
  );

  return {
    isAudioEnabled,
    setIsAudioEnabled,
    lastSpokenText,
    setLastSpokenText,
    speakText,
  };
}
