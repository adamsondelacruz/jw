import type { TalkBlock, TalkWord } from "./document";

export type SpeechMatch = {
  block: TalkBlock;
  startWordIndex: number;
  endWordIndex: number;
  score: number;
};

export type VoiceWordState = {
  currentWordIndex?: number;
  fadedEndWordIndex?: number;
  upcomingStartWordIndex?: number;
  upcomingEndWordIndex?: number;
};

export function getVoiceWordState(
  confirmedWordIndex: number,
  totalWords: number,
  lookAheadWords = 8,
): VoiceWordState {
  if (totalWords <= 0) return {};

  const currentWordIndex = Math.min(Math.max(confirmedWordIndex, -1), totalWords - 1);
  const upcomingStartWordIndex = currentWordIndex + 1;
  const upcomingEndWordIndex = Math.min(
    upcomingStartWordIndex + Math.max(lookAheadWords, 1) - 1,
    totalWords - 1,
  );

  return {
    currentWordIndex: currentWordIndex >= 0 ? currentWordIndex : undefined,
    fadedEndWordIndex: currentWordIndex > 0 ? currentWordIndex - 1 : undefined,
    upcomingStartWordIndex: upcomingStartWordIndex < totalWords ? upcomingStartWordIndex : undefined,
    upcomingEndWordIndex: upcomingStartWordIndex < totalWords ? upcomingEndWordIndex : undefined,
  };
}

export function normalizeSpeech(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findBestSpeechBlock(transcript: string, blocks: TalkBlock[], currentBlockId?: string) {
  return findBestSpeechMatch(transcript, blocks, [], currentBlockId)?.block ?? findFallbackBlock(transcript, blocks, currentBlockId);
}

export function findBestSpeechMatch(
  transcript: string,
  blocks: TalkBlock[],
  words: TalkWord[],
  currentBlockId?: string,
): SpeechMatch | undefined {
  if (!words.length) return undefined;
  const spokenWords = getUsefulWords(transcript);
  if (spokenWords.length < 3) return undefined;

  const currentWordIndex = getCurrentWordIndex(blocks, currentBlockId);
  const windowWords = words.slice(Math.max(0, currentWordIndex - 40), currentWordIndex + 260);
  const best = findBestWordWindow(spokenWords.slice(-10), windowWords, blocks);
  if (best && best.score >= Math.max(3, Math.min(6, spokenWords.length - 1))) return best;

  return findBestWordWindow(spokenWords.slice(-8), words, blocks, 7);
}

function findFallbackBlock(transcript: string, blocks: TalkBlock[], currentBlockId?: string) {
  const normalized = normalizeSpeech(transcript);
  const words = normalized.split(" ").filter((word) => word.length > 2);
  if (words.length < 3) return undefined;

  const phrase = words.slice(-8).join(" ");
  const currentIndex = Math.max(
    blocks.findIndex((block) => block.id === currentBlockId),
    0,
  );
  const searchable = prioritizeNearbyBlocks(blocks, currentIndex);

  let best: { block: TalkBlock; score: number } | undefined;
  for (const block of searchable) {
    const blockText = normalizeSpeech(block.text);
    const overlap = words.slice(-12).filter((word) => blockText.includes(word)).length;
    const phraseBoost = phrase.length > 12 && blockText.includes(phrase) ? 8 : 0;
    const score = overlap + phraseBoost;
    if (!best || score > best.score) best = { block, score };
  }

  return best && best.score >= 4 ? best.block : undefined;
}

function findBestWordWindow(
  spokenWords: string[],
  candidateWords: TalkWord[],
  blocks: TalkBlock[],
  minimumScore = 4,
): SpeechMatch | undefined {
  let best: SpeechMatch | undefined;
  const maxOffset = Math.max(0, candidateWords.length - 1);

  for (let start = 0; start <= maxOffset; start += 1) {
    let score = 0;
    let lastMatchedIndex = candidateWords[start]?.index ?? 0;

    for (let offset = 0; offset < spokenWords.length; offset += 1) {
      const candidate = candidateWords[start + offset];
      const spoken = spokenWords[offset];
      if (!candidate || !spoken) continue;
      if (candidate.normalized === spoken) {
        score += 2;
        lastMatchedIndex = candidate.index;
      } else if (candidate.normalized.startsWith(spoken) || spoken.startsWith(candidate.normalized)) {
        score += 1;
        lastMatchedIndex = candidate.index;
      }
    }

    const first = candidateWords[start];
    if (!first || score < minimumScore) continue;
    const block = blocks.find((item) => item.id === first.blockId);
    if (!block) continue;

    if (!best || score > best.score) {
      best = {
        block,
        startWordIndex: first.index,
        endWordIndex: lastMatchedIndex,
        score,
      };
    }
  }

  return best;
}

function getUsefulWords(transcript: string) {
  return normalizeSpeech(transcript)
    .split(" ")
    .filter((word) => word.length > 1);
}

function getCurrentWordIndex(blocks: TalkBlock[], currentBlockId?: string) {
  const block = blocks.find((item) => item.id === currentBlockId);
  return block?.startWordIndex ?? 0;
}

function prioritizeNearbyBlocks(blocks: TalkBlock[], currentIndex: number) {
  const nearby = blocks.slice(Math.max(0, currentIndex - 4), currentIndex + 18);
  const remaining = blocks.filter((block) => !nearby.includes(block));
  return [...nearby, ...remaining];
}
