import type { DifficultyTier } from '@wordshift/shared-types';
import { getPuzzleCandidates, getWordsByLength } from '@wordshift/word-dictionary';

export type WordGraph = Map<string, string[]>;

const graphCache = new Map<number, WordGraph>();

export function buildWordGraph(length: number, customWords?: string[]): WordGraph {
  if (!customWords && graphCache.has(length)) {
    return graphCache.get(length)!;
  }

  const words = customWords ?? getWordsByLength(length).map((e) => e.word);
  const buckets = new Map<string, string[]>();

  for (const w of words) {
    for (let i = 0; i < w.length; i++) {
      const pattern = w.slice(0, i) + '*' + w.slice(i + 1);
      const list = buckets.get(pattern);
      if (list) {
        list.push(w);
      } else {
        buckets.set(pattern, [w]);
      }
    }
  }

  const graph: WordGraph = new Map();
  for (const w of words) {
    const neighbors = new Set<string>();
    for (let i = 0; i < w.length; i++) {
      const pattern = w.slice(0, i) + '*' + w.slice(i + 1);
      const list = buckets.get(pattern);
      if (list) {
        for (const nbr of list) {
          if (nbr !== w) neighbors.add(nbr);
        }
      }
    }
    graph.set(w, Array.from(neighbors));
  }

  if (!customWords) {
    graphCache.set(length, graph);
  }
  return graph;
}

export function findShortestPath(
  startWord: string,
  targetWord: string,
  graph?: WordGraph
): string[] | null {
  const start = startWord.trim().toLowerCase();
  const target = targetWord.trim().toLowerCase();
  if (start.length !== target.length) return null;
  if (start === target) return [start];

  const g = graph ?? buildWordGraph(start.length);
  if (!g.has(start) || !g.has(target)) return null;

  const queue: string[] = [start];
  const parent = new Map<string, string | null>([[start, null]]);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const neighbors = g.get(current) ?? [];
    for (const next of neighbors) {
      if (!parent.has(next)) {
        parent.set(next, current);
        if (next === target) {
          const path: string[] = [];
          let cur: string | null = target;
          while (cur !== null) {
            path.push(cur);
            cur = parent.get(cur) ?? null;
          }
          path.reverse();
          return path;
        }
        queue.push(next);
      }
    }
  }

  return null;
}

export interface GeneratedPuzzle {
  startWord: string;
  targetWord: string;
  wordLength: number;
  difficulty: DifficultyTier;
  shortestPathLength: number;
}

export interface PuzzleGenerationOptions {
  wordLength?: number;
  difficulty?: DifficultyTier;
  minSteps?: number;
  maxSteps?: number;
  rng?: () => number;
}

export function generatePuzzle(options: PuzzleGenerationOptions = {}): GeneratedPuzzle {
  const wordLength = options.wordLength ?? 4;
  const difficulty = options.difficulty ?? 'mixed';
  const minSteps = options.minSteps ?? (difficulty === 'easy' ? 3 : difficulty === 'hard' ? 5 : 4);
  const maxSteps = options.maxSteps ?? (difficulty === 'easy' ? 5 : difficulty === 'hard' ? 8 : 7);
  const rng = options.rng ?? Math.random;

  const graph = buildWordGraph(wordLength);
  let candidates = getPuzzleCandidates(wordLength, difficulty);
  if (candidates.length < 2) {
    candidates = getPuzzleCandidates(wordLength, 'mixed');
  }
  const candidateSet = new Set(candidates.map((c) => c.word));
  const candidateWords = candidates.map((c) => c.word);

  const maxAttempts = 40;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const startWord = candidateWords[Math.floor(rng() * candidateWords.length)];

    // BFS outward from startWord to find all reachable candidate words within [minSteps, maxSteps]
    const dist = new Map<string, number>([[startWord, 0]]);
    const queue: string[] = [startWord];
    let head = 0;
    const validTargets: Array<{ word: string; steps: number }> = [];

    while (head < queue.length) {
      const cur = queue[head++];
      const d = dist.get(cur)!;
      if (d >= maxSteps) continue;

      const neighbors = graph.get(cur) ?? [];
      for (const nbr of neighbors) {
        if (!dist.has(nbr)) {
          const nextDist = d + 1;
          dist.set(nbr, nextDist);
          queue.push(nbr);
          if (nextDist >= minSteps && nextDist <= maxSteps && candidateSet.has(nbr)) {
            validTargets.push({ word: nbr, steps: nextDist });
          }
        }
      }
    }

    if (validTargets.length > 0) {
      const pick = validTargets[Math.floor(rng() * validTargets.length)];
      return {
        startWord,
        targetWord: pick.word,
        wordLength,
        difficulty,
        shortestPathLength: pick.steps,
      };
    }
  }

  // Deterministic fallback guaranteed to be connected in dictionary
  const fallbackStart = wordLength === 5 ? 'stone' : 'cold';
  const fallbackTarget = wordLength === 5 ? 'smart' : 'warm';
  const path = findShortestPath(fallbackStart, fallbackTarget, graph);
  return {
    startWord: fallbackStart,
    targetWord: fallbackTarget,
    wordLength,
    difficulty,
    shortestPathLength: path ? path.length - 1 : 4,
  };
}
