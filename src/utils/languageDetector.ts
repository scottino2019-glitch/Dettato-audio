/**
 * Utility to automatically detect language and script from user text
 * Supports Western, Slavic, and Oriental languages.
 */

export function detectLanguageFromText(text: string): string | null {
  if (!text || !text.trim()) return null;
  const str = text.trim();

  // 1. Chinese (Hanzi)
  if (/[\u4e00-\u9fa5]/.test(str)) {
    return 'zh-CN';
  }

  // 2. Japanese (Hiragana or Katakana)
  if (/[\u3040-\u30ff]/.test(str)) {
    return 'ja';
  }

  // 3. Korean (Hangul)
  if (/[\uac00-\ud7af]/.test(str)) {
    return 'ko';
  }

  // 4. Arabic
  if (/[\u0600-\u06ff]/.test(str)) {
    return 'ar';
  }

  // 5. Cyrillic (Russian, Ukrainian, Bulgarian, Serbian)
  if (/[\u0400-\u04ff]/.test(str)) {
    // Check specific Ukrainian letters
    if (/[іїєґІЇЄҐ]/.test(str)) return 'uk';
    // Check Bulgarian specific vocabulary or Serbian
    if (/[ђјљњћџЂЈЉЊЋЏ]/.test(str)) return 'sr';
    // Default Cyrillic to Russian
    return 'ru';
  }

  // 6. Greek
  if (/[\u0370-\u03ff]/.test(str)) {
    return 'el';
  }

  // 7. Hindi (Devanagari)
  if (/[\u0900-\u097f]/.test(str)) {
    return 'hi';
  }

  // 8. Thai
  if (/[\u0e00-\u0e7f]/.test(str)) {
    return 'th';
  }

  // 9. Vietnamese (specific vowel diacritics)
  if (/[đĐăĂâÂêÊôÔơƠưƯáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/.test(str)) {
    return 'vi';
  }

  // 10. Slavic Latin scripts: Polish, Czech, Slovak, Croatian
  if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(str)) {
    return 'pl'; // Polish
  }
  if (/[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]/.test(str)) {
    return 'cs'; // Czech
  }

  // 11. German specific letters
  if (/[äöüßÄÖÜ]/.test(str)) {
    return 'de';
  }

  // 12. Spanish specific letters
  if (/[ñÑ¿¡]/.test(str)) {
    return 'es';
  }

  // 13. French specific letters
  if (/[œŒçÇâêîôûÂÊÎÔÛëïüËÏÜ]/.test(str)) {
    return 'fr';
  }

  // Default: if Latin without specific accents, return null (keep current user choice)
  return null;
}

export const GREETINGS_SAMPLE: Record<string, string> = {
  it: 'Ciao! Questa è la voce italiana di Google per il tuo dettato.',
  en: 'Hello! This is the Google English voice for your dictation.',
  'en-US': 'Hello! This is the Google American English voice.',
  es: '¡Hola! Esta es la voz en español de Google para tu dictado.',
  fr: 'Bonjour! Voici la voix française de Google pour votre dictée.',
  de: 'Hallo! Dies ist die deutsche Google-Stimme für dein Diktat.',
  pt: 'Olá! Esta é a voz em português do Google.',
  nl: 'Hallo! Dit is de Nederlandse Google-stem.',
  ru: 'Привет! Это русский голос Google для диктанта.',
  pl: 'Cześć! To jest polski głos Google do Twojego dyktanda.',
  uk: 'Привіт! Це український голос Google для диктанту.',
  cs: 'Ahoj! Toto je český hlas Google pro váš diktát.',
  'zh-CN': '你好！这是谷歌中文语音，正在为你朗读听写。',
  'zh-TW': '你好！這是谷歌繁體中文語音。',
  ja: 'こんにちは！これはGoogleの日本語音声です。',
  ko: '안녕하세요! 구글 한국어 음성입니다.',
  ar: 'مرحبا! هذا هو صوت جوجل باللغة العربية للإملاء.',
  hi: 'नमस्ते! यह श्रुतलेख के लिए गूगल की हिंदी आवाज़ है।',
  vi: 'Xin chào! Đây là giọng đọc tiếng Việt của Google.',
  th: 'สวัสดี! นี่คือเสียงภาษาไทยของ Google',
  tr: 'Merhaba! Bu, dikteniz için Google Türkçe sesidir.',
  el: 'Γεια σας! Αυτή είναι η ελληνική φωνή της Google.',
};
