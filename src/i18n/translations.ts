/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Language = 'es' | 'en';

export interface Translations {
  appTitle: string;
  appSubtitle: string;
  tabs: {
    quickBoard: string;
    virtualKeyboard: string;
  };
  header: {
    profiles: string;
    panel: string;
    muteAudio: string;
    unmuteAudio: string;
    paperButton: string;
    paperTitle: string;
    voiceCloningButton: string;
    voiceCloningTitle: string;
  };
  voiceCloning: {
    title: string;
    modalTitle: string;
    modalSubtitle: string;
    step1Title: string;
    step1Desc: string;
    promptText: string;
    startRecording: string;
    stopRecording: string;
    recordingStatus: string;
    analyzingVoice: string;
    analysisTitle: string;
    fundamentalFreq: string;
    detectedTimbre: string;
    pitchMultiplier: string;
    speechRate: string;
    comparisonTitle: string;
    playOriginalAudio: string;
    playImitatedSpeech: string;
    playFormantChime: string;
    playPhysicalSpeech: string;
    engineModeLabel: string;
    engineNeuralAi: string;
    engineHybrid: string;
    engineMl: string;
    engineFormant: string;
    engineTts: string;
    playNeuralSpeech: string;
    playMlSpeech: string;
    neuralVoiceLabel: string;
    neuralStyleLabel: string;
    neuralPersonaDesc: string;
    acousticMatchingBadge: string;
    matchSimilarityLabel: string;
    matchSimilarityDesc: string;
    abComparisonTitle: string;
    lpcCoeffsLabel: string;
    vtlnLabel: string;
    nlpProsodyLabel: string;
    humanizationLabel: string;
    previewVoiceBtn: string;
    brightnessSlider: string;
    bankPhraseTitle: string;
    bankCurrentAudioBtn: string;
    bankedCountLabel: string;
    glottalHarmonicsLabel: string;
    testPhraseLabel: string;
    testPhraseDefault: string;
    testPhrasePlaceholder: string;
    uploadButton: string;
    uploadDesc: string;
    formantsLabel: string;
    playVocalResonator: string;
    audioSourceMic: string;
    audioSourceFile: string;
    fineTuneTitle: string;
    pitchSlider: string;
    rateSlider: string;
    systemVoiceLabel: string;
    autoVoiceOption: string;
    saveButton: string;
    resetButton: string;
    savedToast: string;
    serverlessBadge: string;
    micErrorNotice: string;
  };
  recentSpeech: {
    title: string;
    repeatButton: string;
    readyStatus: string;
  };
  cameraPrompt: {
    title: string;
    description: string;
    button: string;
  };
  advancedPanel: {
    profile: string;
    samplesRecorded: string;
    createNewProfile: string;
    axisX: string;
    axisY: string;
    fluidityY: string;
    polarityY: string;
    axisYNormal: string;
    axisYInverted: string;
    trainGrid: string;
    calibrateCenter: string;
    dwellDelay: string;
    adaptive: string;
    fixed: string;
    backupJSON: string;
    restoreJSON: string;
    stopCamera: string;
    startCamera: string;
    mediapipeModel: string;
    browserNote: string;
    aiActive: string;
    headTurn: string;
    forcedClick: string;
    squintScore: string;
    recalibrationNote: string;
    eyeVelocity: string;
    serverlessMode: string;
    calibrationAlgorithmLabel: string;
    modelQuadrantMatrix: string;
    modelTps: string;
    modelPolynomial: string;
    modelProjective: string;
    ivtStabilizer: string;
    ivtActive: string;
    ivtInactive: string;
    verticalGainLabel: string;
    fastCenterSuccess: string;
    cursorModeLabel: string;
    cursorBayesianLock: string;
    cursorOcularTrackball: string;
    cursorTwoStageLoupe: string;
    cursorDirectMatrix: string;
    sensorFusionLabel: string;
    sensorFusionActive: string;
    sensorFusionBasic: string;
  };
  keyboard: {
    placeholder: string;
    aiSuggestion: string;
    clickSuggestion: string;
    speak: string;
    space: string;
    backspace: string;
    clear: string;
    stickyModeActive: string;
    stickyModeFree: string;
    stickyHelp: string;
    arrowsHelp: string;
    lastDirection: string;
    dirLeft: string;
    dirRight: string;
    dirUp: string;
    dirDown: string;
  };
  quickBoard: {
    title: string;
    subtitle: string;
    dwellHint: string;
    presets: {
      yes: { label: string; speech: string };
      no: { label: string; speech: string };
      pain: { label: string; speech: string };
      water: { label: string; speech: string };
      bathroom: { label: string; speech: string };
      position: { label: string; speech: string };
      tired: { label: string; speech: string };
      air: { label: string; speech: string };
      thankYou: { label: string; speech: string };
      callDoctor: { label: string; speech: string };
      family: { label: string; speech: string };
      coldHot: { label: string; speech: string };
    };
  };
  onboarding: {
    badge: string;
    title: string;
    subtitle: string;
    step1Title: string;
    step1Desc: string;
    enableCameraBtn: string;
    cameraActiveSuccess: string;
    step2Title: string;
    step2Desc: string;
    languageLabel: string;
    langSpanish: string;
    langEnglish: string;
    profileNameLabel: string;
    profileNamePlaceholder: string;
    startBtn: string;
    cameraErrorPrefix: string;
  };
  profileModal: {
    title: string;
    subtitle: string;
    createNewTitle: string;
    profileNamePlaceholder: string;
    languageLabel: string;
    createBtn: string;
    existingProfiles: string;
    activeBadge: string;
    interactions: string;
    calibratedBadge: string;
    calibrateBtn: string;
    deleteBtn: string;
    exportBackup: string;
    restoreBackup: string;
    closeBtn: string;
  };
  calibration: {
    modalTitle: string;
    modalSubtitle: string;
    stepIndicator: string;
    fixatePrompt: string;
    capturingProgress: string;
    centerRestingNote: string;
    readyTitle: string;
    readySubtitle: string;
    startCalibrationBtn: string;
    completeTitle: string;
    completeSubtitle: string;
    rmseMetric: string;
    angleMetric: string;
    pointsMetric: string;
    saveProfileBtn: string;
    cancelBtn: string;
    spokenCenterNotice: string;
    spokenStepPrefix: string;
    spokenSuccess: string;
  };
  paperModal: {
    title: string;
    badge: string;
    subtitle: string;
    downloadPDF: string;
    printPDF: string;
    downloadTex: string;
    copyLatex: string;
    copied: string;
    close: string;
    tabArticle: string;
    tabLatex: string;
    loadingLatex: string;
    authorLabel: string;
    authorName: string;
    authorAffiliation: string;
    authorContact: string;
    downloadBannerPDF: string;
    downloadBannerTex: string;
    latexFileReady: string;
  };
  tts: {
    cameraStarted: string;
    yNormal: string;
    yInverted: string;
    centerCalibrated: string;
    calibrationReset: string;
    backupExported: string;
    profilesRestored: string;
    initialSpeech: string;
  };
}

export const translations: Record<Language, Translations> = {
  es: {
    appTitle: 'SIGHT',
    appSubtitle: 'Speech, Interaction and Gaze-based Human Technology · Procesamiento 100% Local',
    tabs: {
      quickBoard: 'Tablero Perifoveal',
      virtualKeyboard: 'Escritura Ocular',
    },
    header: {
      profiles: 'Paciente',
      panel: 'Ajustes Clínicos',
      muteAudio: 'Silenciar Voz',
      unmuteAudio: 'Activar Voz',
      paperButton: 'Estudio Clínico',
      paperTitle: 'Ver y descargar el Paper Científico completo de Alberto Arce Rodríguez en PDF y LaTeX',
      voiceCloningButton: 'Timbre Vocal',
      voiceCloningTitle: 'Grabar audio y ajustar el sintetizador de voz para imitar su sonido real',
    },
    voiceCloning: {
      title: 'Timbre Vocal',
      modalTitle: 'Estudio de Imitación y Banco de Voz Personal',
      modalSubtitle: 'Análisis de Frecuencia Fundamental (F₀), Timbre y Cadencia 100% en Navegador (Web Audio)',
      step1Title: 'Paso 1: Grabación de Muestra de Voz o Sonido',
      step1Desc: 'Pulse el botón de grabar y pronuncie una frase o emita un sonido característico durante 3 a 5 segundos.',
      promptText: '"Hola, esta es mi voz natural para el sintetizador asistencial de ELA."',
      startRecording: 'Iniciar Grabación',
      stopRecording: 'Detener y Analizar Sonido',
      recordingStatus: '🔴 Grabando audio del micrófono...',
      analyzingVoice: 'Analizando espectro y frecuencia fundamental F₀...',
      analysisTitle: 'Resultados del Análisis Acústico (Client-Side)',
      fundamentalFreq: 'Frecuencia Fundamental (F₀):',
      detectedTimbre: 'Timbre Ocular/Vocal:',
      pitchMultiplier: 'Tono TTS Derivado:',
      speechRate: 'Cadencia Estimada:',
      comparisonTitle: 'Comparativa de Sonido: Original vs Sintetizador',
      playOriginalAudio: 'Escuchar Grabación Original',
      playImitatedSpeech: 'Escuchar Síntesis TTS Calibrada',
      playFormantChime: 'Resonador Físico F₀',
      playPhysicalSpeech: 'Síntesis Acústica Personal (Glotis + Formantes)',
      engineModeLabel: 'Motor de Vocalización Principal:',
      engineNeuralAi: 'Modelo Neuronal IA (Estilo ChatGPT / 24kHz Studio)',
      engineHybrid: 'Híbrido Inteligente (Banco de Voz + Neuronal IA)',
      engineMl: 'Modelo ML Vocoder & NLP Fonético (LPC-16 + G2P)',
      engineFormant: 'Sintetizador Físico Acústico (Glotis y Formantes Reales)',
      engineTts: 'Voz del Sistema Calibrada (Web Speech API)',
      playNeuralSpeech: 'Voz Neuronal IA (ChatGPT-Style)',
      playMlSpeech: 'Síntesis ML (LPC-16 + NLP G2P)',
      neuralVoiceLabel: 'Persona Vocal Neuronal:',
      neuralStyleLabel: 'Estilo Expresivo y Emocional:',
      neuralPersonaDesc: 'Sintetizador neuronal de última generación con entonación hiperrealista, respiración y calidez humana natural.',
      acousticMatchingBadge: 'Afinación Acústica F₀ y Formantes de su Voz Activa',
      matchSimilarityLabel: 'Calibración de Parecido con Audio Grabado',
      matchSimilarityDesc: 'El sintetizador traspone el tono fundamental (F₀) y modula los formantes (F₁, F₂, F₃) para que la voz generada reproduzca el timbre exacto de su audio grabado.',
      abComparisonTitle: 'Comparativa A/B: Grabación Original vs Voz Clonada',
      lpcCoeffsLabel: 'Coeficientes LPC-16 (Regresión AR):',
      vtlnLabel: 'Alineación de Tracto Vocal (VTLN α):',
      nlpProsodyLabel: 'Prosodia NLP Fujisaki & Acento Léxico:',
      humanizationLabel: 'Humanización Orgánica (Jitter & Shimmer):',
      previewVoiceBtn: 'Probar Voz',
      brightnessSlider: 'Presencia / Brillo Tímbrico (EQ):',
      bankPhraseTitle: 'Banco de Voz Personal (Frases Reales del Usuario)',
      bankCurrentAudioBtn: 'Guardar Audio Grabado en mi Banco de Frases',
      bankedCountLabel: 'frases grabadas en el banco personal',
      glottalHarmonicsLabel: 'Serie Armónica Glotal Extraída:',
      testPhraseLabel: 'Frase para prueba de imitación:',
      testPhraseDefault: 'Hola, ahora el sintetizador habla imitando el tono y ritmo de mi voz grabada.',
      testPhrasePlaceholder: 'Escribe una frase para probar el sintetizador...',
      uploadButton: 'Subir Archivo de Audio (WAV, MP3, M4A)',
      uploadDesc: 'O arrastra y sube un archivo con tu voz grabada previamente para clonar sus formantes',
      formantsLabel: 'Formantes Vocales (F₁, F₂, F₃):',
      playVocalResonator: 'Sintetizador Físico de Formantes (Web Audio)',
      audioSourceMic: 'Grabación de Micrófono',
      audioSourceFile: 'Archivo de Audio Subido',
      fineTuneTitle: 'Ajuste Fino de la Voz Imitada',
      pitchSlider: 'Ajuste de Tono (Pitch):',
      rateSlider: 'Velocidad de Habla (Rate):',
      systemVoiceLabel: 'Voz Base del Navegador:',
      autoVoiceOption: 'Selección Automática por Timbre',
      saveButton: 'Guardar Voz en mi Perfil',
      resetButton: 'Restablecer Valores Predeterminados',
      savedToast: 'Perfil de voz guardado correctamente. Todo el asistente hablará con este tono.',
      serverlessBadge: '100% Local & Sin Servidor (Web Audio API)',
      micErrorNotice: 'No se pudo acceder al micrófono. Verifique los permisos de audio en su navegador.',
    },
    recentSpeech: {
      title: 'Último Mensaje Vocalizado:',
      repeatButton: 'Repetir en voz alta',
      readyStatus: 'Sistema de Asistencia ELA listo.',
    },
    cameraPrompt: {
      title: 'Cámara Ocular Desconectada',
      description: 'Active la cámara frontal para habilitar el control ocular por gestos direccionales.',
      button: 'Activar Cámara',
    },
    advancedPanel: {
      profile: 'Perfil:',
      samplesRecorded: 'interacciones registradas',
      createNewProfile: 'Crear nuevo perfil',
      axisX: 'Eje X:',
      axisY: 'Eje Y:',
      fluidityY: 'Fluidez Y',
      polarityY: 'Eje Y:',
      axisYNormal: 'Eje Y Normal',
      axisYInverted: 'Eje Y Invertido',
      trainGrid: 'Calibrar 9 Puntos',
      calibrateCenter: 'Centrar Mirada',
      dwellDelay: 'Tiempo Fijación:',
      adaptive: 'Adaptativo',
      fixed: 'Fijo',
      backupJSON: 'Exportar JSON',
      restoreJSON: 'Importar',
      stopCamera: 'Pausar Sensor',
      startCamera: 'Activar Sensor',
      mediapipeModel: 'Motor Subpíxel Iris',
      browserNote: 'Ejecución local sin latencia ni envío de imágenes. Selección por fijación suave o guiño sostenido.',
      aiActive: 'Muestras:',
      headTurn: 'Postura:',
      forcedClick: 'Clic Ocular Activo',
      squintScore: 'Tono palpebral:',
      recalibrationNote: 'Compensación cefálica 3D activa · Aprendizaje continuo sin límite de muestras',
      eyeVelocity: 'Velocidad sacádica:',
      serverlessMode: 'Procesamiento Local Clínico',
      calibrationAlgorithmLabel: 'Modelo Geométrico:',
      modelQuadrantMatrix: 'Matriz Cuadrante Exacta (M-QPM)',
      modelTps: 'TPS Blanqueado',
      modelPolynomial: 'Polinomio Huber Ridge',
      modelProjective: 'Homografía Hartley',
      ivtStabilizer: 'Estabilizador Foveal I-VT:',
      ivtActive: 'Fijación Estable Activa',
      ivtInactive: 'Seguimiento Libre',
      verticalGainLabel: 'Ganancia Vertical:',
      fastCenterSuccess: 'Centro calibrado instantáneamente con éxito.',
      cursorModeLabel: 'Posicionamiento Cursor:',
      cursorBayesianLock: 'Fijación Bayesiana',
      cursorOcularTrackball: 'Trackball Ocular',
      cursorTwoStageLoupe: 'Doble Fase (Lupa)',
      cursorDirectMatrix: 'Matriz Directa',
      sensorFusionLabel: 'Sensor Multimodal:',
      sensorFusionActive: '3D + Iris Fotométrico + Blendshapes',
      sensorFusionBasic: 'Solo Proyección 2D',
    },
    keyboard: {
      placeholder: 'Desplace la mirada o fije en una letra para componer su mensaje...',
      aiSuggestion: 'Frase contextual sugerida',
      clickSuggestion: 'Fijar la mirada para vocalizar frase completa',
      speak: 'Vocalizar Mensaje',
      space: 'ESPACIO',
      backspace: 'BORRAR',
      clear: 'LIMPIAR',
      stickyModeActive: 'Selector por Pasos Activo',
      stickyModeFree: 'Seguimiento Continuo',
      stickyHelp: 'Mire hacia una dirección para avanzar tecla a tecla. Descanse la vista en el centro para confirmar.',
      arrowsHelp: 'Compatible con mirada direccional, cursor libre o teclado.',
      lastDirection: 'Dirección:',
      dirLeft: 'IZQUIERDA',
      dirRight: 'DERECHA',
      dirUp: 'ARRIBA',
      dirDown: 'ABAJO',
    },
    quickBoard: {
      title: 'Anillo Perifoveal de Comunicación y Descanso Ocular',
      subtitle: 'Disposición concéntrica de mínimo esfuerzo sacádico. El santuario central permite posar la vista sin activar botones.',
      dwellHint: 'Activación automática por tiempo de fijación visual (Dwell) o clic forzado al entrecerrar ojos.',
      presets: {
        yes: { label: 'SÍ', speech: 'Sí, estoy de acuerdo.' },
        no: { label: 'NO', speech: 'No, no quiero eso.' },
        pain: { label: 'TENGO DOLOR', speech: 'Tengo dolor, por favor ayúdenme.' },
        water: { label: 'AGUA', speech: 'Tengo sed, por favor denme agua fresca.' },
        bathroom: { label: 'BAÑO', speech: 'Necesito ir al baño, por favor.' },
        position: { label: 'CAMBIAR POSTURA', speech: 'Por favor, cámbiame de postura o acomoda mi almohada.' },
        tired: { label: 'CANSADO', speech: 'Estoy cansado, me gustaría descansar.' },
        air: { label: 'FALTA AIRE', speech: 'Me falta el aire, revisen mi ventilador o aspirador.' },
        thankYou: { label: 'GRACIAS', speech: 'Muchas gracias por cuidarme y ayudarme.' },
        callDoctor: { label: 'LLAMAR MÉDICO', speech: 'Por favor, llamen al médico o al enfermero.' },
        family: { label: 'QUIERO COMPAÑÍA', speech: 'Quiero que mi familia se quede aquí conmigo.' },
        coldHot: { label: 'FRÍO / CALOR', speech: 'Tengo frío o calor, revisen la temperatura y la manta.' },
      },
    },
    onboarding: {
      badge: 'Configuración Inicial · Unidad Ocular ELA',
      title: 'Configuración de Perfil y Acceso a Cámara',
      subtitle: 'Para permitir el control ocular y adaptar la calibración al reposacabezas de su silla, active la cámara frontal.',
      step1Title: 'Paso 1: Activación de Cámara Web',
      step1Desc: 'El procesamiento de visión corre 100% en su navegador mediante MediaPipe (GPU/WASM). Ninguna imagen o vídeo sale jamás de su dispositivo.',
      enableCameraBtn: 'Activar Cámara Web',
      cameraActiveSuccess: 'Cámara activada con éxito. Detector facial listo.',
      step2Title: 'Paso 2: Idioma y Perfil del Paciente',
      step2Desc: 'Seleccione el idioma preferido para la interfaz y el sintetizador de voz (TTS):',
      languageLabel: 'Idioma del Asistente:',
      langSpanish: 'Español (es-ES)',
      langEnglish: 'English (en-US)',
      profileNameLabel: 'Nombre o Alias del Paciente:',
      profileNamePlaceholder: 'Ej: Juan, Mario, Elena...',
      startBtn: 'Comenzar y Calibrar Cuadrícula',
      cameraErrorPrefix: 'No se pudo acceder a la cámara:',
    },
    profileModal: {
      title: 'Gestión de Perfiles de Paciente ELA',
      subtitle: 'Configure sensibilidades independientes, matrices de calibración y copias de seguridad.',
      createNewTitle: 'Crear Nuevo Perfil:',
      profileNamePlaceholder: 'Nombre del nuevo perfil...',
      languageLabel: 'Idioma:',
      createBtn: 'Crear Perfil',
      existingProfiles: 'Perfiles Registrados:',
      activeBadge: 'ACTIVO',
      interactions: 'interacciones aprendidas',
      calibratedBadge: 'Matriz Calibrada',
      calibrateBtn: 'Calibrar 9 Puntos',
      deleteBtn: 'Eliminar',
      exportBackup: 'Exportar Backup JSON',
      restoreBackup: 'Restaurar Backup JSON',
      closeBtn: 'Cerrar',
    },
    calibration: {
      modalTitle: 'Calibración Ocular Perimétrica · 9 Puntos',
      modalSubtitle: 'Regresión Polinomial Bivariada Regularizada (L₂ Ridge). Elimina zonas muertas en bordes de pantalla.',
      stepIndicator: 'Punto de Calibración',
      fixatePrompt: 'Fije la mirada atentamente en el centro de la diana circular',
      capturingProgress: 'Capturando muestras pupilares...',
      centerRestingNote: 'El Punto 4 establece el centro neutro de reposo para la navegación por pasos en el teclado.',
      readyTitle: 'Calibración Perimétrica de Mirada',
      readySubtitle: 'Aparecerán 9 puntos secuenciales en los bordes y el centro de la pantalla. Mantenga la cabeza firme apoyada en el respaldo de la silla y siga los puntos únicamente con los ojos.',
      startCalibrationBtn: 'Iniciar Calibración',
      completeTitle: '¡Calibración Completada con Éxito!',
      completeSubtitle: 'La superficie de regresión polinomial bivariada ha sido ajustada y guardada en su perfil.',
      rmseMetric: 'Error Cuadrático Medio (RMSE):',
      angleMetric: 'Precisión Angular Estimada:',
      pointsMetric: 'Puntos de Apoyo:',
      saveProfileBtn: 'Guardar y Continuar',
      cancelBtn: 'Cancelar',
      spokenCenterNotice: 'Punto central. Este punto servirá de reposo neutro.',
      spokenStepPrefix: 'Mire al punto',
      spokenSuccess: 'Calibración completada con éxito. Matriz polinomial guardada.',
    },
    paperModal: {
      title: 'Publicación Científica: Calibración & Detección Pupilar en ELA',
      badge: 'LaTeX / APA 7ª Ed.',
      subtitle: 'Regresión Bivariada Regularizada con Corrección Canto-Pupilar y Compensación de Pose Cefálica',
      downloadPDF: 'Descargar PDF (Arce)',
      printPDF: 'Imprimir / Guardar PDF',
      downloadTex: 'Código .tex',
      copyLatex: 'Copiar',
      copied: '¡Copiado!',
      close: 'Cerrar',
      tabArticle: 'Artículo Formateado (Lectura Académica)',
      tabLatex: 'Código Fuente LaTeX (.tex)',
      loadingLatex: 'Cargando código fuente LaTeX...',
      authorLabel: 'Autor:',
      authorName: 'Alberto Arce Rodríguez',
      authorAffiliation: 'Laboratorio de Tecnología Asistencial, Neurocomputación y Ciencias de la Visión',
      authorContact: 'Contacto: alberto.arce.ti@gmail.com • Proyecto de Código Abierto 100% Sin Servidor',
      downloadBannerPDF: 'Descargar PDF (Alberto Arce Rodríguez)',
      downloadBannerTex: 'Descargar Fuente LaTeX (.tex)',
      latexFileReady: 'Archivo LaTeX listo en:',
    },
    tts: {
      cameraStarted: 'Cámara activada.',
      yNormal: 'Eje vertical normal.',
      yInverted: 'Eje vertical invertido.',
      centerCalibrated: 'Centro calibrado correctamente.',
      calibrationReset: 'Calibración restablecida.',
      backupExported: 'Copia de seguridad exportada correctamente en JSON.',
      profilesRestored: 'Perfiles restaurados desde JSON con éxito.',
      initialSpeech: 'Sistema de Asistencia ELA listo.',
    },
  },
  en: {
    appTitle: 'SIGHT',
    appSubtitle: 'Speech, Interaction and Gaze-based Human Technology · 100% Local Processing',
    tabs: {
      quickBoard: 'Perifoveal Board',
      virtualKeyboard: 'Gaze Compose',
    },
    header: {
      profiles: 'Patient',
      panel: 'Clinical Setup',
      muteAudio: 'Mute Voice',
      unmuteAudio: 'Unmute Voice',
      paperButton: 'Clinical Study',
      paperTitle: 'View and download the complete Scientific Paper by Alberto Arce Rodríguez in PDF and LaTeX',
      voiceCloningButton: 'Vocal Timbre',
      voiceCloningTitle: 'Record audio and adjust speech synthesis to imitate your voice pitch and rhythm',
    },
    voiceCloning: {
      title: 'Vocal Timbre',
      modalTitle: 'Voice Recording & Personal Banking Studio',
      modalSubtitle: 'Fundamental Frequency (F₀), Timbre & Cadence Analysis 100% in Browser (Web Audio)',
      step1Title: 'Step 1: Record Voice or Sound Sample',
      step1Desc: 'Click the record button and speak a test phrase or sound steadily for 3 to 5 seconds.',
      promptText: '"Hello, this is my natural voice for the ALS assistive speech synthesizer."',
      startRecording: 'Start Recording',
      stopRecording: 'Stop & Analyze Sound',
      recordingStatus: '🔴 Recording microphone audio...',
      analyzingVoice: 'Analyzing spectrum and fundamental frequency F₀...',
      analysisTitle: 'Acoustic Analysis Results (Client-Side)',
      fundamentalFreq: 'Fundamental Frequency (F₀):',
      detectedTimbre: 'Vocal / Acoustic Timbre:',
      pitchMultiplier: 'Derived TTS Pitch:',
      speechRate: 'Estimated Cadence:',
      comparisonTitle: 'Sound Comparison: Original vs Synthesizer',
      playOriginalAudio: 'Listen to Original Audio',
      playImitatedSpeech: 'Listen to Calibrated TTS Speech',
      playFormantChime: 'Physical F₀ Resonator',
      playPhysicalSpeech: 'Personal Acoustic Synthesis (Glottal + Formants)',
      engineModeLabel: 'Primary Speech Vocalization Engine:',
      engineNeuralAi: 'Neural AI Model (ChatGPT-Style / 24kHz Studio)',
      engineHybrid: 'Smart Hybrid (Personal Bank + Neural AI)',
      engineMl: 'Neural ML Vocoder & Phonetic NLP (LPC-16 + G2P)',
      engineFormant: 'Physical Acoustic Synthesizer (Real Glottis & Formants)',
      engineTts: 'Calibrated System Voice (Web Speech API)',
      playNeuralSpeech: 'Neural AI Voice (ChatGPT-Style)',
      playMlSpeech: 'Synthesize with ML (LPC-16 + NLP G2P)',
      neuralVoiceLabel: 'Neural Voice Persona:',
      neuralStyleLabel: 'Expressive & Emotional Style:',
      neuralPersonaDesc: 'Cutting-edge deep-learning neural speech synthesizer with hyper-realistic human prosody, breath, and warmth.',
      acousticMatchingBadge: 'Acoustic F₀ & Formant Resemblance Filter Active',
      matchSimilarityLabel: 'Acoustic Resemblance Calibration',
      matchSimilarityDesc: 'The synthesizer transposes the fundamental pitch (F₀) and modulates resonant formants (F₁, F₂, F₃) to match the unique timbre of your recorded audio.',
      abComparisonTitle: 'A/B Resemblance Comparison: Original vs Cloned Voice',
      lpcCoeffsLabel: 'LPC-16 Coefficients (AR Regression):',
      vtlnLabel: 'Vocal Tract Length Alignment (VTLN α):',
      nlpProsodyLabel: 'NLP Fujisaki Prosody & Lexical Stress:',
      humanizationLabel: 'Organic Humanization (Jitter & Shimmer):',
      previewVoiceBtn: 'Preview Voice',
      brightnessSlider: 'Timbral Brightness / Presence (EQ):',
      bankPhraseTitle: 'Personal Voice Banking (User Audio Clips)',
      bankCurrentAudioBtn: 'Save Current Audio to My Phrase Bank',
      bankedCountLabel: 'banked personal voice phrases',
      glottalHarmonicsLabel: 'Extracted Glottal Harmonic Series:',
      testPhraseLabel: 'Test phrase for imitation preview:',
      testPhraseDefault: 'Hello, the speech synthesizer is now imitating the pitch and rhythm of my recorded voice.',
      testPhrasePlaceholder: 'Type a custom phrase to test synthesized voice...',
      uploadButton: 'Upload Audio File (WAV, MP3, M4A)',
      uploadDesc: 'Or drag & drop a pre-recorded audio sample of your voice to extract formants',
      formantsLabel: 'Vocal Formants (F₁, F₂, F₃):',
      playVocalResonator: 'Physical Formant Synthesizer (Web Audio)',
      audioSourceMic: 'Microphone Recording',
      audioSourceFile: 'Uploaded Audio File',
      fineTuneTitle: 'Fine-Tune Imitated Voice',
      pitchSlider: 'Pitch Adjustment (Pitch):',
      rateSlider: 'Speaking Cadence (Rate):',
      systemVoiceLabel: 'Base Browser Voice:',
      autoVoiceOption: 'Auto-Match by Timbre',
      saveButton: 'Save Voice to My Profile',
      resetButton: 'Reset to Defaults',
      savedToast: 'Voice profile successfully saved. The assistant will vocalize with this tone.',
      serverlessBadge: '100% Local & Serverless (Web Audio API)',
      micErrorNotice: 'Could not access microphone. Please check audio permissions in your browser.',
    },
    recentSpeech: {
      title: 'Last Vocalized Message:',
      repeatButton: 'Repeat out loud',
      readyStatus: 'ALS Assistive System ready.',
    },
    cameraPrompt: {
      title: 'Eye Camera Disconnected',
      description: 'Activate your front webcam to enable gaze control with directional glances.',
      button: 'Activate Camera',
    },
    advancedPanel: {
      profile: 'Profile:',
      samplesRecorded: 'recorded interactions',
      createNewProfile: 'Create new profile',
      axisX: 'X Axis:',
      axisY: 'Y Axis:',
      fluidityY: 'Y Fluidity',
      polarityY: 'Y Axis:',
      axisYNormal: 'Y Axis Normal',
      axisYInverted: 'Y Axis Inverted',
      trainGrid: 'Calibrate 9-Point Grid',
      calibrateCenter: 'Center Gaze',
      dwellDelay: 'Fixation Dwell:',
      adaptive: 'Adaptive',
      fixed: 'Fixed',
      backupJSON: 'Export JSON',
      restoreJSON: 'Restore',
      stopCamera: 'Pause Sensor',
      startCamera: 'Start Sensor',
      mediapipeModel: 'Sub-Pixel Iris Engine',
      browserNote: '100% local in-browser processing. Smooth fixation dwell or sustained voluntary squint.',
      aiActive: 'Samples:',
      headTurn: 'Head Pose:',
      forcedClick: 'Ocular Click Active',
      squintScore: 'Palpebral tone:',
      recalibrationNote: '3D head-pose compensation active · Unlimited continuous learning',
      eyeVelocity: 'Saccadic speed:',
      serverlessMode: 'Local Clinical Processing',
      calibrationAlgorithmLabel: 'Geometric Model:',
      modelQuadrantMatrix: 'Exact Quadrant Matrix (M-QPM)',
      modelTps: 'Whitened TPS',
      modelPolynomial: 'Huber Ridge Polynomial',
      modelProjective: 'Hartley Homography',
      ivtStabilizer: 'Foveal I-VT Stabilizer:',
      ivtActive: 'Stable Fixation Active',
      ivtInactive: 'Direct Gaze',
      verticalGainLabel: 'Vertical Gain:',
      fastCenterSuccess: 'Center gaze successfully recalibrated.',
      cursorModeLabel: 'Cursor Paradigm:',
      cursorBayesianLock: 'Bayesian Target Lock',
      cursorOcularTrackball: 'Ocular Trackball',
      cursorTwoStageLoupe: 'Two-Stage Loupe',
      cursorDirectMatrix: 'Direct Matrix',
      sensorFusionLabel: 'Sensor Pipeline:',
      sensorFusionActive: '3D Ray + Photometric Iris + Blendshapes',
      sensorFusionBasic: '2D Projection Only',
    },
    keyboard: {
      placeholder: 'Glide your gaze or rest on a key to compose your message...',
      aiSuggestion: 'Contextual phrase suggestion',
      clickSuggestion: 'Fixate gaze to vocalize full phrase',
      speak: 'Vocalize Message',
      space: 'SPACE',
      backspace: 'BACKSPACE',
      clear: 'CLEAR',
      stickyModeActive: 'Step Selector Active',
      stickyModeFree: 'Continuous Gaze',
      stickyHelp: 'Glance toward a direction to step key-by-key. Rest in center to confirm.',
      arrowsHelp: 'Supports directional glances, continuous gaze, or physical keys.',
      lastDirection: 'Direction:',
      dirLeft: 'LEFT',
      dirRight: 'RIGHT',
      dirUp: 'UP',
      dirDown: 'DOWN',
    },
    quickBoard: {
      title: 'Perifoveal Communication & Ocular Rest Ring',
      subtitle: 'Concentric low-saccade layout. The central sanctuary lets you rest your gaze without triggering clicks.',
      dwellHint: 'Automatic selection via visual fixation time (Dwell) or forced click by squinting eyes.',
      presets: {
        yes: { label: 'YES', speech: 'Yes, I agree.' },
        no: { label: 'NO', speech: 'No, I do not want that.' },
        pain: { label: 'IN PAIN', speech: 'I am in pain, please help me.' },
        water: { label: 'WATER', speech: 'I am thirsty, please give me fresh water.' },
        bathroom: { label: 'RESTROOM', speech: 'I need to use the restroom, please.' },
        position: { label: 'REPOSITION', speech: 'Please change my position or adjust my pillow.' },
        tired: { label: 'TIRED', speech: 'I am tired, I would like to rest.' },
        air: { label: 'SHORT OF BREATH', speech: 'I am short of breath, please check my ventilator or suction.' },
        thankYou: { label: 'THANK YOU', speech: 'Thank you very much for taking care of me and helping.' },
        callDoctor: { label: 'CALL DOCTOR', speech: 'Please call the doctor or nurse.' },
        family: { label: 'WANT COMPANY', speech: 'I want my family to stay here with me.' },
        coldHot: { label: 'COLD / HOT', speech: 'I am cold or hot, please check the room temperature and blanket.' },
      },
    },
    onboarding: {
      badge: 'Initial Setup · Clinical Ocular Unit',
      title: 'Profile Setup & Camera Access',
      subtitle: 'To enable eye tracking and adapt calibration to your wheelchair headrest, please activate your camera.',
      step1Title: 'Step 1: Webcam Activation',
      step1Desc: 'Vision processing runs 100% inside your browser via MediaPipe (GPU/WASM). No video or facial frames ever leave your device.',
      enableCameraBtn: 'Activate Webcam',
      cameraActiveSuccess: 'Webcam activated successfully. Face detector ready.',
      step2Title: 'Step 2: Language & Patient Profile',
      step2Desc: 'Choose your preferred language for the interface and Text-to-Speech (TTS) synthesizer:',
      languageLabel: 'Assistant Language:',
      langSpanish: 'Spanish (es-ES)',
      langEnglish: 'English (en-US)',
      profileNameLabel: 'Patient Name or Alias:',
      profileNamePlaceholder: 'e.g., John, Mario, Sarah...',
      startBtn: 'Start and Calibrate Grid',
      cameraErrorPrefix: 'Could not access camera:',
    },
    profileModal: {
      title: 'ALS Patient Profile Management',
      subtitle: 'Configure independent sensitivities, calibration matrices, and local JSON backups.',
      createNewTitle: 'Create New Profile:',
      profileNamePlaceholder: 'New profile name...',
      languageLabel: 'Language:',
      createBtn: 'Create Profile',
      existingProfiles: 'Registered Profiles:',
      activeBadge: 'ACTIVE',
      interactions: 'learned interactions',
      calibratedBadge: 'Calibrated Matrix',
      calibrateBtn: 'Calibrate 9 Points',
      deleteBtn: 'Delete',
      exportBackup: 'Export JSON Backup',
      restoreBackup: 'Restore JSON Backup',
      closeBtn: 'Close',
    },
    calibration: {
      modalTitle: 'Perimeter Eye Calibration · 9 Points',
      modalSubtitle: 'Regularized Bivariate Polynomial Regression (L₂ Ridge). Eliminates screen border dead-zones.',
      stepIndicator: 'Calibration Point',
      fixatePrompt: 'Fixate your gaze steadily on the circular target center',
      capturingProgress: 'Capturing pupil samples...',
      centerRestingNote: 'Point 4 establishes the neutral resting center for keyboard directional step navigation.',
      readyTitle: 'Perimeter Gaze Calibration',
      readySubtitle: '9 sequential target stimuli will appear around screen borders and center. Keep head comfortably resting on chair and follow targets with eyes only.',
      startCalibrationBtn: 'Start Calibration',
      completeTitle: 'Calibration Successfully Completed!',
      completeSubtitle: 'The bivariate polynomial regression surface has been computed and saved to your profile.',
      rmseMetric: 'Root Mean Square Error (RMSE):',
      angleMetric: 'Estimated Angular Accuracy:',
      pointsMetric: 'Calibration Anchor Points:',
      saveProfileBtn: 'Save and Continue',
      cancelBtn: 'Cancel',
      spokenCenterNotice: 'Center point. This point serves as the neutral resting origin.',
      spokenStepPrefix: 'Look at point',
      spokenSuccess: 'Calibration completed successfully. Polynomial matrix saved.',
    },
    paperModal: {
      title: 'Scientific Paper: Calibration & Pupil Detection in ALS',
      badge: 'LaTeX / APA 7th Ed.',
      subtitle: 'Regularized Bivariate Polynomial Regression with Canthal-Pupil Decoupling and Head Pose Recalibration',
      downloadPDF: 'Download PDF (Arce)',
      printPDF: 'Print / Save as PDF',
      downloadTex: 'LaTeX .tex',
      copyLatex: 'Copy',
      copied: 'Copied!',
      close: 'Close',
      tabArticle: 'Formatted Paper (Academic View)',
      tabLatex: 'LaTeX Source Code (.tex)',
      loadingLatex: 'Loading LaTeX source code...',
      authorLabel: 'Author:',
      authorName: 'Alberto Arce Rodríguez',
      authorAffiliation: 'Laboratory of Assistive Technology, Neurocomputation & Vision Sciences',
      authorContact: 'Contact: alberto.arce.ti@gmail.com • 100% Serverless Open-Source Project',
      downloadBannerPDF: 'Download PDF (Alberto Arce Rodríguez)',
      downloadBannerTex: 'Download LaTeX Source (.tex)',
      latexFileReady: 'LaTeX file ready at:',
    },
    tts: {
      cameraStarted: 'Camera activated.',
      yNormal: 'Vertical axis set to normal.',
      yInverted: 'Vertical axis inverted.',
      centerCalibrated: 'Center calibrated successfully.',
      calibrationReset: 'Calibration reset.',
      backupExported: 'Backup exported successfully to JSON.',
      profilesRestored: 'Profiles restored from JSON successfully.',
      initialSpeech: 'ALS Assistive System ready.',
    },
  },
};
