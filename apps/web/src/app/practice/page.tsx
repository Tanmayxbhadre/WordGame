'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { generatePuzzle, validateMove } from '@wordshift/game-engine';

export default function PracticePage() {
  const [startWord, setStartWord] = useState('cold');
  const [targetWord, setTargetWord] = useState('warm');
  const [chain, setChain] = useState<string[]>(['cold']);
  const [selectedPos, setSelectedPos] = useState<number>(0);
  const [draftWord, setDraftWord] = useState('cold');
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [won, setWon] = useState(false);

  const loadNewPuzzle = () => {
    const p = generatePuzzle({ wordLength: 4, difficulty: 'easy', minSteps: 3, maxSteps: 5 });
    setStartWord(p.startWord);
    setTargetWord(p.targetWord);
    setChain([p.startWord]);
    setDraftWord(p.startWord);
    setSelectedPos(0);
    setFeedback(null);
    setWon(false);
  };

  useEffect(() => {
    loadNewPuzzle();
  }, []);

  const currentWord = chain[chain.length - 1];

  const handleKeyPress = (letter: string) => {
    if (won) return;
    const chars = currentWord.split('');
    chars[selectedPos] = letter.toLowerCase();
    setDraftWord(chars.join(''));
    setFeedback(null);
  };

  const handleSubmit = () => {
    if (won) return;
    const result = validateMove({
      candidateWord: draftWord,
      currentWord,
      targetWord,
      usedWords: chain,
    });

    if (!result.valid) {
      setFeedback({ type: 'error', text: result.errorMessage ?? 'Invalid word.' });
      return;
    }

    const nextChain = [...chain, result.normalizedWord];
    setChain(nextChain);
    setDraftWord(result.normalizedWord);
    if (result.isDestination) {
      setWon(true);
      setFeedback({ type: 'success', text: `Solved in ${nextChain.length - 1} moves!` });
    } else {
      setFeedback(null);
    }
  };

  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
  ];

  const hasSingleChange = draftWord !== currentWord;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
        <button
          type="button"
          onClick={loadNewPuzzle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
        >
          <RotateCcw className="h-3.5 w-3.5" /> New Puzzle
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 text-center">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          <span>Start: {startWord.toUpperCase()}</span>
          <span>Target: {targetWord.toUpperCase()}</span>
        </div>

        <div className="mt-6 flex justify-center gap-2.5">
          {draftWord.split('').map((ch, idx) => {
            const isChanged = ch !== currentWord[idx];
            const isSelected = idx === selectedPos;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPos(idx)}
                className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 font-mono text-2xl font-bold uppercase transition sm:h-16 sm:w-16 ${
                  isChanged
                    ? 'border-[var(--success)] bg-[var(--success)]/15 text-[var(--success)]'
                    : isSelected
                      ? 'border-[var(--accent)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                      : 'border-[var(--tile-border)] bg-[var(--tile-bg)] text-[var(--text-primary)]'
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>

        {feedback && (
          <div
            className={`mt-4 rounded-xl px-3 py-2 text-sm font-medium ${
              feedback.type === 'error'
                ? 'bg-[var(--danger)]/10 text-[var(--danger)]'
                : 'bg-[var(--success)]/10 text-[var(--success)]'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => setDraftWord(currentWord)}
            disabled={!hasSingleChange || won}
            className="flex-1 rounded-xl border border-[var(--border-subtle)] py-2.5 text-sm font-medium text-[var(--text-secondary)] disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasSingleChange || won}
            className="flex-[2] rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40"
          >
            Submit Move
          </button>
        </div>
      </div>

      {/* Chain */}
      <div className="flex flex-wrap justify-center gap-2">
        {chain.map((w, i) => (
          <span
            key={`${w}-${i}`}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-1 font-mono text-xs font-semibold uppercase text-[var(--text-primary)]"
          >
            {w}
          </span>
        ))}
      </div>

      {/* On-screen Keyboard */}
      <div className="space-y-1.5">
        {rows.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1">
            {row.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleKeyPress(key)}
                className="flex h-11 min-w-[30px] flex-1 max-w-[42px] items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm font-semibold text-[var(--text-primary)] active:scale-95"
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
