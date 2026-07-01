export type StoryDisplayNameContext = "podium" | "table";

const STORY_NAME_MAX_CHARS: Record<StoryDisplayNameContext, number> = {
  podium: 24,
  table: 24,
};

function storyNameWords(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function storyNameCandidates(words: string[]) {
  const maxWords = Math.min(3, words.length);
  return Array.from({ length: maxWords }, (_, index) => words.slice(0, maxWords - index).join(" "));
}

function storyNameCandidateFits(candidate: string, context: StoryDisplayNameContext) {
  return candidate.length <= STORY_NAME_MAX_CHARS[context];
}

export function storyDisplayName(name: string, context: StoryDisplayNameContext) {
  const words = storyNameWords(name);
  if (!words.length) {
    return "";
  }

  const candidates = storyNameCandidates(words);
  return candidates.find((candidate) => storyNameCandidateFits(candidate, context)) ?? words[0];
}

export function storyPodiumNameLines(name: string): string[] {
  const displayName = storyDisplayName(name, "podium");
  const words = storyNameWords(displayName);

  if (words.length <= 1) {
    return [displayName];
  }

  const maxLines = Math.min(3, words.length);
  const targetLines = words.length === 2 ? 2 : displayName.length > 20 ? maxLines : Math.min(2, maxLines);
  let bestLines = [words.join(" ")];
  let bestScore = Number.POSITIVE_INFINITY;

  function score(lines: string[]) {
    const lengths = lines.map((line) => line.length);
    const longest = Math.max(...lengths);
    const shortest = Math.min(...lengths);
    const targetPenalty = Math.abs(lines.length - targetLines) * 24;
    return longest * 8 + (longest - shortest) * 2 + targetPenalty;
  }

  function visit(index: number, lines: string[]) {
    if (index === words.length) {
      const candidateScore = score(lines);
      if (candidateScore < bestScore) {
        bestScore = candidateScore;
        bestLines = lines;
      }
      return;
    }

    const word = words[index];
    const lastIndex = lines.length - 1;
    visit(index + 1, [...lines.slice(0, lastIndex), `${lines[lastIndex]} ${word}`]);

    if (lines.length < maxLines) {
      visit(index + 1, [...lines, word]);
    }
  }

  visit(1, [words[0]]);
  return bestLines;
}
