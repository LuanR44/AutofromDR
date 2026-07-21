export interface LanguageOption {
  code: string;
  label: string;
  // Palavras por minuto médias de fala usadas para estimar a duração do áudio.
  wordsPerMinute: number;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "pt", label: "Português (Brasil)", wordsPerMinute: 150 },
  { code: "en", label: "Inglês", wordsPerMinute: 160 },
  { code: "es", label: "Espanhol", wordsPerMinute: 150 },
  { code: "fr", label: "Francês", wordsPerMinute: 155 },
  { code: "de", label: "Alemão", wordsPerMinute: 145 },
  { code: "it", label: "Italiano", wordsPerMinute: 155 },
];

export function getLanguageByCode(code: string): LanguageOption {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? SUPPORTED_LANGUAGES[0];
}
