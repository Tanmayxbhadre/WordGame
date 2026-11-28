import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  chooseComputerMove,
  countLetterDifferences,
  findChangedPosition,
  generatePuzzle,
  validateMove,
} from '@wordshift/game-engine';
import { sketchColors, sketchStyles } from '../lib/theme';

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export default function MobileVsComputerScreen() {
  const [targetWord, setTargetWord] = useState('warm');
  const [chain, setChain] = useState<string[]>(['cold']);
  const [turn, setTurn] = useState<'you' | 'bot'>('you');
  const [selectedPos, setSelectedPos] = useState(0);
  const [draftWord, setDraftWord] = useState('cold');
  const [winner, setWinner] = useState<'you' | 'bot' | 'draw' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const startNew = () => {
    const p = generatePuzzle({ wordLength: 4, difficulty: 'mixed', minSteps: 3, maxSteps: 5 });
    setTargetWord(p.targetWord);
    setChain([p.startWord]);
    setDraftWord(p.startWord);
    setSelectedPos(0);
    setTurn('you');
    setWinner(null);
    setFeedback(null);
  };

  useEffect(() => {
    startNew();
  }, []);

  const currentWord = chain[chain.length - 1];

  useEffect(() => {
    if (winner || turn !== 'bot') return;
    const t = setTimeout(() => {
      const next = chooseComputerMove({
        currentWord,
        targetWord,
        usedWords: chain,
        botDifficulty: 'medium',
      });
      if (!next) {
        setWinner('draw');
        return;
      }
      setChain((prev) => [...prev, next]);
      setDraftWord(next);
      setSelectedPos(0);
      if (next === targetWord) setWinner('bot');
      else setTurn('you');
    }, 800);
    return () => clearTimeout(t);
  }, [winner, turn, currentWord, targetWord, chain]);

  const diffCount = countLetterDifferences(currentWord, draftWord);
  const changedPos = findChangedPosition(currentWord, draftWord);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[sketchStyles.card, styles.headerBar]}>
        <Text style={styles.turnText}>
          {winner === 'you'
            ? 'You Won!'
            : winner === 'bot'
              ? 'Computer Won!'
              : winner === 'draw'
                ? 'Draw!'
                : turn === 'you'
                  ? 'Your Turn'
                  : 'Computer thinking...'}
        </Text>
        <Text style={styles.goalText}>Goal: {targetWord.toUpperCase()}</Text>
      </View>

      {winner ? (
        <Pressable style={[sketchStyles.button, styles.primaryBtn]} onPress={startNew}>
          <Text style={styles.btnText}>Play Again</Text>
        </Pressable>
      ) : (
        <>
          <View style={[sketchStyles.card, styles.boardCard]}>
            <View style={styles.tileRow}>
              {draftWord.split('').map((ch, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSelectedPos(idx);
                  }}
                  style={[
                    sketchStyles.tile,
                    styles.tile,
                    changedPos === idx
                      ? { backgroundColor: sketchColors.success }
                      : selectedPos === idx && turn === 'you'
                        ? { backgroundColor: sketchColors.accent, transform: [{ translateY: -3 }] }
                        : { backgroundColor: sketchColors.bgElevated },
                  ]}
                >
                  <Text style={styles.tileLetter}>{ch.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>

            {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}

            <Pressable
              style={[
                sketchStyles.button,
                styles.primaryBtn,
                (turn !== 'you' || diffCount !== 1) && { opacity: 0.4 },
              ]}
              disabled={turn !== 'you' || diffCount !== 1}
              onPress={() => {
                const res = validateMove({
                  candidateWord: draftWord,
                  currentWord,
                  targetWord,
                  usedWords: chain,
                });
                if (!res.valid) {
                  setFeedback(res.errorMessage ?? 'Invalid word');
                  return;
                }
                setFeedback(null);
                setChain((prev) => [...prev, res.normalizedWord]);
                setDraftWord(res.normalizedWord);
                if (res.isDestination) setWinner('you');
                else setTurn('bot');
              }}
            >
              <Text style={styles.btnText}>
                {diffCount === 1 ? `Submit ${draftWord.toUpperCase()}` : 'Submit Word'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.keyboard}>
            {ROWS.map((row, rIdx) => (
              <View key={rIdx} style={styles.keyRow}>
                {row.map((letter) => (
                  <Pressable
                    key={letter}
                    style={[sketchStyles.tile, styles.key]}
                    disabled={turn !== 'you'}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      const chars = currentWord.split('');
                      chars[selectedPos] = letter.toLowerCase();
                      setDraftWord(chars.join(''));
                    }}
                  >
                    <Text style={styles.keyText}>{letter}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 14, gap: 14, backgroundColor: sketchColors.bgPrimary },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  turnText: { color: sketchColors.accent, fontWeight: '900', fontSize: 15 },
  goalText: { color: sketchColors.success, fontWeight: '900', fontSize: 15 },
  boardCard: { padding: 18, gap: 14 },
  tileRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  tile: { width: 58, height: 64, justifyContent: 'center', alignItems: 'center' },
  tileLetter: { fontSize: 28, fontWeight: '900', color: sketchColors.textPrimary },
  feedback: { color: sketchColors.danger, textAlign: 'center', fontWeight: '700', fontSize: 13 },
  primaryBtn: { backgroundColor: sketchColors.accent, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  keyboard: { gap: 8 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  key: {
    flex: 1,
    maxWidth: 38,
    height: 48,
    borderRadius: 10,
    backgroundColor: sketchColors.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: { color: sketchColors.textPrimary, fontWeight: '800', fontSize: 15 },
});
