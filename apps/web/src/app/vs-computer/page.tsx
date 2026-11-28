'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, RotateCcw, Send, Trophy } from 'lucide-react';
import {
  chooseComputerMove,
  countLetterDifferences,
  findChangedPosition,
  generatePuzzle,
  validateMove,
} from '@wordshift/game-engine';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

type BotLevel = 'easy' | 'medium' | 'hard';

interface ChainStep {
  word: string;
  by: 'start' | 'you' | 'bot';
  changedPos: number | null;
}

export default function VsComputerPage() {
  const [wordLength, setWordLength] = useState<4 | 5>(4);
  const [botLevel, setBotLevel] = useState<BotLevel>('medium');
  const [startWord, setStartWord] = useState('cold');
  const [targetWord, setTargetWord] = useState('warm');
  const [chain, setChain] = useState<ChainStep[]>([{ word: 'cold', by: 'start', changedPos: null }]);
  const [turn, setTurn] = useState<'you' | 'bot'>('you');
  const [selectedPos, setSelectedPos] = useState(0);
  const [draftWord, setDraftWord] = useState('cold');
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [winner, setWinner] = useState<'you' | 'bot' | 'draw' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const startNewGame = useCallback(
    (len = wordLength, level = botLevel) => {
      const p = generatePuzzle({
        wordLength: len,
        difficulty: level === 'easy' ? 'easy' : level === 'hard' ? 'hard' : 'mixed',
        minSteps: 3,
        maxSteps: 6,
      });
      setStartWord(p.startWord);
      setTargetWord(p.targetWord);
      setChain([{ word: p.startWord, by: 'start', changedPos: null }]);
      setDraftWord(p.startWord);
      setSelectedPos(0);
      setTurn('you');
      setSecondsLeft(30);
      setWinner(null);
      setFeedback(null);
    },
    [wordLength, botLevel]
  );

  useEffect(() => {
    startNewGame(4, 'medium');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentWord = chain[chain.length - 1].word;

  // Player 30s turn timer
  useEffect(() => {
    if (winner || turn !== 'you') return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setFeedback('Time up! Computer takes the turn.');
          setDraftWord(currentWord);
          setTurn('bot');
          return 30;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [winner, turn, currentWord]);

  // Computer move effect
  useEffect(() => {
    if (winner || turn !== 'bot') return;
    const timeout = setTimeout(() => {
      const nextWord = chooseComputerMove({
        currentWord,
        targetWord,
        usedWords: chain.map((c) => c.word),
        botDifficulty: botLevel,
      });

      if (!nextWord) {
        setWinner('draw');
        setFeedback('No valid moves left — Match Draw!');
        return;
      }

      const pos = findChangedPosition(currentWord, nextWord);
      setChain((prev) => [...prev, { word: nextWord, by: 'bot', changedPos: pos }]);
      setDraftWord(nextWord);
      setSelectedPos(0);

      if (nextWord === targetWord) {
        setWinner('bot');
      } else {
        setTurn('you');
        setSecondsLeft(30);
      }
    }, 900);

    return () => clearTimeout(timeout);
  }, [winner, turn, currentWord, targetWord, chain, botLevel]);

  const diffCount = useMemo(
    () => countLetterDifferences(currentWord, draftWord),
    [currentWord, draftWord]
  );
  const changedPos = useMemo(
    () => findChangedPosition(currentWord, draftWord),
    [currentWord, draftWord]
  );

  const handleSubmit = () => {
    if (winner || turn !== 'you') return;
    const res = validateMove({
      candidateWord: draftWord,
      currentWord,
      targetWord,
      usedWords: chain.map((c) => c.word),
    });

    if (!res.valid) {
      setFeedback(res.errorMessage ?? 'Invalid word.');
      return;
    }

    setFeedback(null);
    setChain((prev) => [
      ...prev,
      { word: res.normalizedWord, by: 'you', changedPos: res.changedPosition },
    ]);
    setDraftWord(res.normalizedWord);
    setSelectedPos(0);

    if (res.isDestination) {
      setWinner('you');
    } else {
      setTurn('bot');
      setSecondsLeft(30);
    }
  };

  const applyLetter = (letter: string) => {
    if (winner || turn !== 'you') return;
    const chars = currentWord.split('');
    chars[selectedPos] = letter.toLowerCase();
    setDraftWord(chars.join(''));
    setFeedback(null);
  };

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="sketch-btn inline-flex items-center gap-1.5 rounded-xl bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="flex items-center gap-2">
          {([4, 5] as const).map((len) => (
            <button
              key={len}
              type="button"
              onClick={() => {
                setWordLength(len);
                startNewGame(len, botLevel);
              }}
              className={`sketch-btn rounded-xl px-2.5 py-1 text-xs font-bold ${
                wordLength === len
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-primary)]'
              }`}
            >
              {len}L
            </button>
          ))}

          <select
            value={botLevel}
            onChange={(e) => {
              const lvl = e.target.value as BotLevel;
              setBotLevel(lvl);
              startNewGame(wordLength, lvl);
            }}
            className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-bold text-[var(--text-primary)]"
          >
            <option value="easy">Easy Bot</option>
            <option value="medium">Medium Bot</option>
            <option value="hard">Hard Bot</option>
          </select>

          <button
            type="button"
            onClick={() => startNewGame()}
            className="sketch-btn inline-flex items-center gap-1 rounded-xl bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-bold text-[var(--text-primary)]"
          >
            <RotateCcw className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </div>

      {/* Turn Pill */}
      <div className="sketch-card flex items-center justify-between rounded-2xl bg-[var(--bg-secondary)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[var(--accent-secondary)]" />
          <span
            className={`rounded-full border-2 border-[var(--border-subtle)] px-3 py-0.5 text-xs font-extrabold ${
              winner
                ? 'bg-[var(--success)] text-white'
                : turn === 'you'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--accent-secondary)] text-white'
            }`}
          >
            {winner === 'you'
              ? 'You Won!'
              : winner === 'bot'
                ? 'Computer Won!'
                : winner === 'draw'
                  ? 'Draw!'
                  : turn === 'you'
                    ? 'Your Turn'
                    : 'Computer is thinking...'}
          </span>
        </div>

        {!winner && (
          <div className="rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-0.5 font-mono text-sm font-black text-[var(--text-primary)]">
            {secondsLeft}s
          </div>
        )}
      </div>

      {/* Winner Banner or Game Board */}
      {winner ? (
        <div className="sketch-card rounded-3xl bg-[var(--bg-secondary)] p-6 text-center">
          <div className="sketch-btn mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--success)] text-white">
            <Trophy className="h-7 w-7" />
          </div>
          <h2 className="mt-3 text-2xl font-black text-[var(--text-primary)]">
            {winner === 'you' ? 'You beat the Computer!' : winner === 'bot' ? 'Computer reached the goal!' : 'Match Draw!'}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {startWord.toUpperCase()} → {targetWord.toUpperCase()} in {chain.length - 1} moves
          </p>
          <button
            type="button"
            onClick={() => startNewGame()}
            className="sketch-btn mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-extrabold text-white"
          >
            <RotateCcw className="h-4 w-4" /> Play Again
          </button>
        </div>
      ) : (
        <div className="sketch-card rounded-3xl bg-[var(--bg-secondary)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[var(--border-muted)] pb-3">
            <p className="text-xs font-bold text-[var(--text-secondary)]">
              Change <span className="font-black text-[var(--text-primary)]">1 letter</span> to reach:
            </p>
            <div className="flex items-center gap-1">
              {targetWord.split('').map((ch, idx) => (
                <span
                  key={idx}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[var(--border-subtle)] font-mono text-xs font-black uppercase ${
                    draftWord[idx] === ch
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                  }`}
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-2.5">
            {draftWord.split('').map((ch, idx) => {
              const isSelected = idx === selectedPos && turn === 'you';
              const isChanged = changedPos === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedPos(idx)}
                  className={`sketch-tile flex h-14 w-14 items-center justify-center rounded-2xl font-mono text-2xl font-black uppercase sm:h-16 sm:w-16 sm:text-3xl ${
                    isChanged
                      ? 'bg-[var(--success)] text-white'
                      : isSelected
                        ? '-translate-y-1 bg-[var(--accent)] text-white'
                        : 'bg-[var(--tile-bg)] text-[var(--text-primary)]'
                  }`}
                >
                  {ch}
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className="mt-3 rounded-xl border-2 border-[var(--border-subtle)] bg-[var(--danger)]/15 px-3 py-1.5 text-center text-xs font-bold text-[var(--danger)]">
              {feedback}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setDraftWord(currentWord)}
              disabled={turn !== 'you' || diffCount === 0}
              className="sketch-btn rounded-xl bg-[var(--bg-elevated)] px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] disabled:opacity-40"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={turn !== 'you' || diffCount !== 1}
              className="sketch-btn flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {diffCount === 1 ? `Submit ${draftWord.toUpperCase()}` : 'Submit Word'}
            </button>
          </div>
        </div>
      )}

      {/* Chain */}
      <div className="sketch-card rounded-2xl bg-[var(--bg-secondary)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-extrabold uppercase text-[var(--text-muted)]">
            Chain:
          </span>
          {chain.map((step, i) => (
            <React.Fragment key={`${step.word}-${i}`}>
              {i > 0 && <span className="text-xs font-bold text-[var(--text-muted)]">→</span>}
              <span
                className={`rounded-lg border-2 border-[var(--border-subtle)] px-2 py-0.5 font-mono text-xs font-black uppercase ${
                  step.by === 'start'
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : step.by === 'bot'
                      ? 'bg-[var(--accent-secondary)]/15 text-[var(--accent-secondary)]'
                      : 'bg-[var(--bg-primary)] text-[var(--text-primary)]'
                }`}
              >
                {step.word}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Keyboard */}
      {!winner && (
        <div className="space-y-1.5">
          {KEYBOARD_ROWS.map((row, rIdx) => (
            <div key={rIdx} className="flex justify-center gap-1 sm:gap-1.5">
              {row.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  disabled={turn !== 'you'}
                  onClick={() => applyLetter(letter)}
                  className="sketch-tile flex h-10 min-w-[30px] flex-1 max-w-[44px] items-center justify-center rounded-xl bg-[var(--bg-secondary)] text-sm font-extrabold text-[var(--text-primary)] disabled:opacity-40 sm:h-11"
                >
                  {letter}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
