// Estimativa de duração da fala a partir da copy do usuário.
// O texto nunca é alterado, resumido ou reescrito — apenas usado para estimar a duração.

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function estimateSpeechDurationSeconds(text: string, wordsPerMinute: number): number {
  const words = countWords(text);
  return (words / wordsPerMinute) * 60;
}
