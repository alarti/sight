/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Language } from '../i18n/translations.ts';

// Contextual AI predictive sentence corpus for ALS communication in Spanish
export const DEFAULT_PREDICTIVE_SENTENCES_ES = [
  "Tengo sed, por favor dame agua fresca.",
  "Necesito cambiar de postura en la silla.",
  "Muchas gracias por estar aquí conmigo.",
  "Tengo frío, ¿me pones una manta?",
  "Tengo dolor en el cuello, por favor acomódame.",
  "Estoy bien y tranquilo ahora, gracias.",
  "Quiero ir al salón con vosotros un rato.",
  "Por favor, acércame el teléfono móvil.",
  "Tengo hambre, ¿qué hora es para comer?",
  "Quiero descansar un poco y cerrar los ojos.",
  "Te quiero mucho, gracias por cuidarme."
];

// Contextual AI predictive sentence corpus for ALS communication in English
export const DEFAULT_PREDICTIVE_SENTENCES_EN = [
  "I am thirsty, please give me some water.",
  "I need to change my posture in the wheelchair.",
  "Thank you very much for being here with me.",
  "I feel cold, could you put a blanket over me?",
  "I have neck pain, please adjust my headrest.",
  "I am doing well and comfortable right now, thanks.",
  "I would like to go to the living room with you.",
  "Please bring my phone closer.",
  "I am hungry, is it time to eat yet?",
  "I would like to rest for a while and close my eyes.",
  "I love you very much, thank you for caring for me."
];

export const PREDICTIVE_DICTIONARY_ES: Record<string, string[]> = {
  "ho": ["Hola, ¿cómo estás? Qué alegría verte.", "Hola a todos, buenos días."],
  "hola": ["Hola, ¿cómo estás? Me alegro mucho de verte."],
  "ne": ["Necesito cambiar de postura en la silla.", "Necesito descansar un rato los ojos."],
  "necesito": ["Necesito cambiar de postura, me molesta la espalda.", "Necesito beber un poco de agua."],
  "te": ["Tengo sed, por favor acércame agua.", "Tengo un poco de frío en las piernas."],
  "tengo": ["Tengo sed, por favor dame agua fresca.", "Tengo frío, ¿me puedes tapar con la manta?", "Tengo dolor en el hombro derecho."],
  "qu": ["Quiero ir al salón con la familia.", "¿Qué hora es ahora mismo?"],
  "quiero": ["Quiero descansar un rato en la cama.", "Quiero ver la televisión un momento."],
  "gr": ["Gracias por todo lo que haces por mí.", "Gracias por tu paciencia y cariño."],
  "gracias": ["Gracias por cuidarme con tanto cariño.", "Gracias por tu ayuda, estoy mejor."],
  "po": ["Por favor, ¿me recolocas la cabeza?", "Por favor, acércame un vaso de agua."],
  "por": ["Por favor, ayúdame a cambiar de posición.", "Por favor, abre un poco la ventana."],
  "ag": ["Agua fresca, por favor, tengo sed."],
  "agua": ["Por favor, dame un poco de agua con pajita."],
  "me": ["Me duele el cuello, ¿me colocas la almohada?", "Me alegro mucho de que estés aquí."],
  "do": ["¿Dónde están todos ahora?", "¿Dónde has puesto mis gafas?"],
  "co": ["¿Cómo ha ido tu día hoy?", "Estoy muy cómodo, muchas gracias."],
  "si": ["Sí, por favor, me vendría muy bien.", "Sí, estoy de acuerdo con eso."],
  "no": ["No, muchas gracias, ahora mismo no.", "No tengo prisa, tranquilo."],
  "ay": ["Por favor, ¿puedes ayudarme un momento?", "Ayúdame a colocar las piernas."],
  "ayuda": ["Necesito un poco de ayuda para acomodarme."]
};

export const PREDICTIVE_DICTIONARY_EN: Record<string, string[]> = {
  "he": ["Hello, how are you? So glad to see you.", "Help me please, I need assistance."],
  "hello": ["Hello, it is wonderful to see you today."],
  "ne": ["Need to reposition my head, please.", "Need some fresh water to drink."],
  "need": ["I need to change position in the chair.", "I need a drink of water, please."],
  "th": ["Thank you for everything you do for me.", "The room is a bit cold right now."],
  "thank": ["Thank you so much for your loving care.", "Thank you for your help, I feel better."],
  "pl": ["Please adjust my headrest cushion.", "Please open the window a little."],
  "please": ["Please help me adjust my position.", "Please give me some water with a straw."],
  "wa": ["Water please, I am very thirsty."],
  "water": ["Please give me some fresh water."],
  "pa": ["Pain in my neck, please help adjust me.", "Pain in my shoulder, please check."],
  "pain": ["I have pain, please help reposition me."],
  "ye": ["Yes, please, that would be wonderful.", "Yes, I agree with that."],
  "yes": ["Yes, thank you very much."],
  "no": ["No, thank you, not right now.", "No, I am fine for now."],
  "i": ["I am comfortable right now, thank you.", "I would like to rest for a bit."],
  "im": ["I'm doing well, thank you.", "I'm a bit tired today."],
};

export function getAiAutocompleteSuggestion(text: string, language: Language = 'es'): string {
  const clean = text.trim().toLowerCase();
  const defaultSentences = language === 'en' ? DEFAULT_PREDICTIVE_SENTENCES_EN : DEFAULT_PREDICTIVE_SENTENCES_ES;
  const dict = language === 'en' ? PREDICTIVE_DICTIONARY_EN : PREDICTIVE_DICTIONARY_ES;

  if (!clean) {
    return defaultSentences[0];
  }

  if (dict[clean]) {
    return dict[clean][0];
  }

  const words = clean.split(/\s+/);
  const lastWord = words[words.length - 1];

  for (const [key, sentences] of Object.entries(dict)) {
    if (clean.startsWith(key) || lastWord.startsWith(key)) {
      return sentences[0];
    }
  }

  const matching = defaultSentences.find(s => s.toLowerCase().startsWith(clean) || s.toLowerCase().includes(clean));
  if (matching) return matching;

  return language === 'en'
    ? `${text.trim()}... thank you for being here.`
    : `${text.trim()}... y muchas gracias por estar aquí.`;
}
