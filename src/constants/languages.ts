export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  category: 'occidentali' | 'slave' | 'orientali';
}

export const LANGUAGES: LanguageOption[] = [
  // LINGUE OCCIDENTALI
  { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹', category: 'occidentali' },
  { code: 'en', name: 'Inglese (UK)', nativeName: 'English (UK)', flag: '🇬🇧', category: 'occidentali' },
  { code: 'en-US', name: 'Inglese (US)', nativeName: 'English (US)', flag: '🇺🇸', category: 'occidentali' },
  { code: 'es', name: 'Spagnolo', nativeName: 'Español', flag: '🇪🇸', category: 'occidentali' },
  { code: 'fr', name: 'Francese', nativeName: 'Français', flag: '🇫🇷', category: 'occidentali' },
  { code: 'de', name: 'Tedesco', nativeName: 'Deutsch', flag: '🇩🇪', category: 'occidentali' },
  { code: 'pt', name: 'Portoghese', nativeName: 'Português', flag: '🇵🇹', category: 'occidentali' },
  { code: 'nl', name: 'Olandese', nativeName: 'Nederlands', flag: '🇳🇱', category: 'occidentali' },
  { code: 'sv', name: 'Svedese', nativeName: 'Svenska', flag: '🇸🇪', category: 'occidentali' },
  { code: 'no', name: 'Norvegese', nativeName: 'Norsk', flag: '🇳🇴', category: 'occidentali' },
  { code: 'da', name: 'Danese', nativeName: 'Dansk', flag: '🇩🇰', category: 'occidentali' },
  { code: 'fi', name: 'Finlandese', nativeName: 'Suomi', flag: '🇫🇮', category: 'occidentali' },

  // LINGUE SLAVE
  { code: 'ru', name: 'Russo', nativeName: 'Русский', flag: '🇷🇺', category: 'slave' },
  { code: 'pl', name: 'Polacco', nativeName: 'Polski', flag: '🇵🇱', category: 'slave' },
  { code: 'uk', name: 'Ucraino', nativeName: 'Українська', flag: '🇺🇦', category: 'slave' },
  { code: 'cs', name: 'Ceco', nativeName: 'Čeština', flag: '🇨🇿', category: 'slave' },
  { code: 'sk', name: 'Slovacco', nativeName: 'Slovenčina', flag: '🇸🇰', category: 'slave' },
  { code: 'bg', name: 'Bulgaro', nativeName: 'Български', flag: '🇧🇬', category: 'slave' },
  { code: 'sr', name: 'Serbo', nativeName: 'Српски', flag: '🇷🇸', category: 'slave' },
  { code: 'hr', name: 'Croato', nativeName: 'Hrvatski', flag: '🇭🇷', category: 'slave' },
  { code: 'sl', name: 'Sloveno', nativeName: 'Slovenščina', flag: '🇸🇮', category: 'slave' },

  // LINGUE ORIENTALI & MEDIORIENTALI
  { code: 'zh-CN', name: 'Cinese Mandarino', nativeName: '中文 (简体)', flag: '🇨🇳', category: 'orientali' },
  { code: 'zh-TW', name: 'Cinese Tradizionale', nativeName: '中文 (繁體)', flag: '🇹🇼', category: 'orientali' },
  { code: 'ja', name: 'Giapponese', nativeName: '日本語', flag: '🇯🇵', category: 'orientali' },
  { code: 'ko', name: 'Coreano', nativeName: '한국어', flag: '🇰🇷', category: 'orientali' },
  { code: 'ar', name: 'Arabo', nativeName: 'العربية', flag: '🇸🇦', category: 'orientali' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', category: 'orientali' },
  { code: 'vi', name: 'Vietnamita', nativeName: 'Tiếng Việt', flag: '🇻🇳', category: 'orientali' },
  { code: 'th', name: 'Thailandese', nativeName: 'ไทย', flag: '🇹🇭', category: 'orientali' },
  { code: 'tr', name: 'Turco', nativeName: 'Türkçe', flag: '🇹🇷', category: 'orientali' },
  { code: 'el', name: 'Greco', nativeName: 'Ελληνικά', flag: '🇬🇷', category: 'orientali' },
  { code: 'id', name: 'Indonesiano', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', category: 'orientali' },
];

export const CATEGORY_LABELS = {
  occidentali: '🌍 Lingue Occidentali',
  slave: '🏛️ Lingue Slave',
  orientali: '🌏 Lingue Orientali e Asiatiche',
};
