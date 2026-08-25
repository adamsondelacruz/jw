import { describe, expect, it } from "vitest";
import { findBestSpeechBlock, getVoiceWordState, normalizeSpeech } from "./voiceFollow";

const blocks = [
  {
    id: "block-1",
    text: "Have you ever walked past a garden and noticed a pleasant fragrance?",
    startWordIndex: 0,
    endWordIndex: 10,
  },
  {
    id: "block-2",
    text: "The Bible gives us a strong warning example at Babel.",
    startWordIndex: 11,
    endWordIndex: 20,
  },
  {
    id: "block-3",
    text: "Jehovah notices sincere beginnings and sees the heart behind it.",
    startWordIndex: 21,
    endWordIndex: 29,
  },
];

const words = blocks.flatMap((block) =>
  block.text
    .split(" ")
    .map((text, offset) => ({
      index: block.startWordIndex + offset,
      blockId: block.id,
      text,
      normalized: text.toLowerCase().replace(/[^a-z0-9]/g, ""),
    })),
);

describe("voice following", () => {
  it("normalizes punctuation and spacing", () => {
    expect(normalizeSpeech("Jehovah's   approval, matters!")).toBe("jehovah s approval matters");
  });

  it("matches recent spoken words to a talk block", () => {
    expect(findBestSpeechBlock("a strong warning example at Babel", blocks)?.id).toBe("block-2");
  });

  it("returns the matched word range", async () => {
    const { findBestSpeechMatch } = await import("./voiceFollow");
    const match = findBestSpeechMatch("strong warning example at Babel", blocks, words);

    expect(match?.block.id).toBe("block-2");
    expect(match?.endWordIndex).toBe(20);
  });

  it("does not jump on a weak partial phrase", () => {
    expect(findBestSpeechBlock("good name", blocks)).toBeUndefined();
  });

  it("previews words ahead and fades only completed words", () => {
    expect(getVoiceWordState(10, 30, 8)).toEqual({
      currentWordIndex: 10,
      fadedEndWordIndex: 9,
      upcomingStartWordIndex: 11,
      upcomingEndWordIndex: 18,
    });
  });

  it("previews the opening words before speech begins", () => {
    expect(getVoiceWordState(-1, 5, 8)).toEqual({
      currentWordIndex: undefined,
      fadedEndWordIndex: undefined,
      upcomingStartWordIndex: 0,
      upcomingEndWordIndex: 4,
    });
  });
});
