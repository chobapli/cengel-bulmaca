import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './src/config/firebase';
import { fetchTodayPuzzle } from './src/services/puzzleService';
import { ChengelPuzzle, ChengelWord, ArrowDir } from './src/types';

const CELL = 40;

// ── Grid hücre tipleri ──────────────────────────────────────────────────────

type UICell =
  | { kind: 'black' }
  | { kind: 'clue'; wordId: number; clue: string; arrow: ArrowDir }
  | { kind: 'answer'; wordIds: number[]; letter: string; row: number; col: number };

function buildUIGrid(puzzle: ChengelPuzzle): UICell[][] {
  const grid: UICell[][] = Array.from({ length: puzzle.gridRows }, () =>
    Array.from({ length: puzzle.gridCols }, (): UICell => ({ kind: 'black' }))
  );

  for (const word of puzzle.words) {
    grid[word.clueRow][word.clueCol] = {
      kind: 'clue',
      wordId: word.id,
      clue: word.clue,
      arrow: word.direction,
    };

    for (let i = 0; i < word.word.length; i++) {
      const r = word.direction === 'down' ? word.clueRow + 1 + i : word.clueRow;
      const c = word.direction === 'right' ? word.clueCol + 1 + i : word.clueCol;
      const existing = grid[r][c];
      if (existing.kind === 'answer') {
        existing.wordIds.push(word.id);
      } else {
        grid[r][c] = { kind: 'answer', wordIds: [word.id], letter: word.word[i], row: r, col: c };
      }
    }
  }

  return grid;
}

function getWordCells(word: ChengelWord): { row: number; col: number }[] {
  return Array.from({ length: word.word.length }, (_, i) => ({
    row: word.direction === 'down' ? word.clueRow + 1 + i : word.clueRow,
    col: word.direction === 'right' ? word.clueCol + 1 + i : word.clueCol,
  }));
}

// ── Ana bileşen ─────────────────────────────────────────────────────────────

export default function App() {
  const [puzzle, setPuzzle] = useState<ChengelPuzzle | null>(null);
  const [uiGrid, setUIGrid] = useState<UICell[][]>([]);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: string }>({});
  const [activeWordId, setActiveWordId] = useState<number | null>(null);
  const [activeCellIdx, setActiveCellIdx] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    signInAnonymously(auth)
      .then(() => fetchTodayPuzzle())
      .then((p) => {
        if (p) {
          setPuzzle(p);
          setUIGrid(buildUIGrid(p));
        }
      })
      .catch((err) => Alert.alert('Hata', err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!puzzle || completed) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [puzzle, completed]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const activeWord = puzzle?.words.find((w) => w.id === activeWordId) ?? null;

  // ── Etkileşim ────────────────────────────────────────────────────────────

  const handleClueTap = (wordId: number) => {
    setActiveWordId(wordId);
    setActiveCellIdx(0);
  };

  const handleAnswerTap = (cell: UICell & { kind: 'answer' }) => {
    if (activeWordId !== null && cell.wordIds.includes(activeWordId)) {
      // Aynı hücreye tekrar basınca diğer kelimeye geç (kesişim noktası)
      const next = cell.wordIds[(cell.wordIds.indexOf(activeWordId) + 1) % cell.wordIds.length];
      setActiveWordId(next);
      const word = puzzle!.words.find((w) => w.id === next)!;
      const idx = getWordCells(word).findIndex((c) => c.row === cell.row && c.col === cell.col);
      setActiveCellIdx(Math.max(0, idx));
    } else {
      const wordId = cell.wordIds[0];
      setActiveWordId(wordId);
      const word = puzzle!.words.find((w) => w.id === wordId)!;
      const idx = getWordCells(word).findIndex((c) => c.row === cell.row && c.col === cell.col);
      setActiveCellIdx(Math.max(0, idx));
    }
  };

  const checkCompletion = (answers: { [key: string]: string }) => {
    if (!puzzle) return;
    const ok = puzzle.words.every((word) =>
      getWordCells(word).every((c, i) => answers[`${c.row}-${c.col}`] === word.word[i])
    );
    if (ok) {
      setCompleted(true);
      Alert.alert('Tebrikler!', `Bulmacayı ${formatTime(elapsedSeconds)} sürede tamamladınız!`);
    }
  };

  const handleInput = (letter: string) => {
    if (!activeWord) return;
    const cells = getWordCells(activeWord);
    if (activeCellIdx >= cells.length) return;
    const { row, col } = cells[activeCellIdx];
    const newAnswers = { ...userAnswers, [`${row}-${col}`]: letter };
    setUserAnswers(newAnswers);
    if (activeCellIdx < cells.length - 1) setActiveCellIdx(activeCellIdx + 1);
    checkCompletion(newAnswers);
  };

  const handleDelete = () => {
    if (!activeWord) return;
    const cells = getWordCells(activeWord);
    const { row, col } = cells[activeCellIdx];
    const key = `${row}-${col}`;
    if (userAnswers[key]) {
      const next = { ...userAnswers };
      delete next[key];
      setUserAnswers(next);
    } else if (activeCellIdx > 0) {
      const prev = activeCellIdx - 1;
      const { row: pr, col: pc } = cells[prev];
      const next = { ...userAnswers };
      delete next[`${pr}-${pc}`];
      setUserAnswers(next);
      setActiveCellIdx(prev);
    }
  };

  // ── Hücre render ─────────────────────────────────────────────────────────

  const renderCell = (cell: UICell, ri: number, ci: number) => {
    const key = `${ri}-${ci}`;

    if (cell.kind === 'black') {
      return <View key={key} style={styles.blackCell} />;
    }

    if (cell.kind === 'clue') {
      const isActive = activeWordId === cell.wordId;
      return (
        <TouchableOpacity
          key={key}
          style={[styles.clueCell, isActive && styles.clueCellActive]}
          onPress={() => handleClueTap(cell.wordId)}
          activeOpacity={0.7}
        >
          <Text style={styles.clueText} numberOfLines={4}>
            {cell.clue}
          </Text>
          <Text style={styles.arrowIcon}>{cell.arrow === 'right' ? '▶' : '▼'}</Text>
        </TouchableOpacity>
      );
    }

    // answer hücresi
    const inWord =
      activeWord !== null &&
      getWordCells(activeWord).some((c) => c.row === ri && c.col === ci);
    const activeCells = activeWord ? getWordCells(activeWord) : [];
    const isCursor =
      activeCells[activeCellIdx]?.row === ri && activeCells[activeCellIdx]?.col === ci;
    const userLetter = userAnswers[key] || '';

    return (
      <TouchableOpacity
        key={key}
        style={[
          styles.answerCell,
          inWord && styles.answerCellHighlight,
          isCursor && styles.answerCellCursor,
        ]}
        onPress={() => handleAnswerTap(cell)}
        activeOpacity={0.7}
      >
        <Text style={[styles.answerLetter, isCursor && styles.answerLetterCursor]}>
          {userLetter}
        </Text>
      </TouchableOpacity>
    );
  };

  // ── Yükleniyor / bulmaca yok ─────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e91e8c" />
        <Text style={{ marginTop: 12, color: '#666' }}>Bulmaca yükleniyor...</Text>
      </View>
    );
  }

  if (!puzzle) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Bugün bulmaca yok</Text>
        <Text style={styles.emptyText}>Admin panelinden bugünün bulmacasını oluşturun.</Text>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const KEYBOARD_ROWS = ['QWERTYUIOPĞÜİ', 'ASDFGHJKLŞİ', 'ZXCVBNMÖÇ'];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* Başlık */}
      <View style={styles.header}>
        <Text style={styles.title}>Çengel Bulmaca</Text>
        <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
      </View>

      {/* Aktif kelimenin ipucu şeridi */}
      {activeWord ? (
        <View style={styles.clueBar}>
          <Text style={styles.clueBarMeta}>
            {activeWord.word.length} harf {'  '}
            {activeWord.direction === 'right' ? '→ Yatay' : '↓ Dikey'}
          </Text>
          <Text style={styles.clueBarText}>{activeWord.clue}</Text>
        </View>
      ) : (
        <View style={styles.clueBarEmpty}>
          <Text style={styles.clueBarHint}>Bir soru kutusuna dokun</Text>
        </View>
      )}

      {/* Grid — 2 eksenli kaydırma */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
          <View style={styles.gridPad}>
            {uiGrid.map((row, ri) => (
              <View key={ri} style={styles.row}>
                {row.map((cell, ci) => renderCell(cell, ri, ci))}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Klavye */}
      {activeWordId !== null && (
        <View style={styles.keyboard}>
          {KEYBOARD_ROWS.map((row, ri) => (
            <View key={ri} style={styles.keyRow}>
              {row.split('').map((letter) => (
                <TouchableOpacity
                  key={letter}
                  style={styles.key}
                  onPress={() => handleInput(letter)}
                >
                  <Text style={styles.keyText}>{letter}</Text>
                </TouchableOpacity>
              ))}
              {ri === 2 && (
                <TouchableOpacity style={[styles.key, styles.deleteKey]} onPress={handleDelete}>
                  <Text style={styles.keyText}>⌫</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#d1d5db' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  timer: { fontSize: 16, fontWeight: '600', color: '#e91e8c' },

  clueBar: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#fbcfe8',
    minHeight: 48,
    justifyContent: 'center',
  },
  clueBarEmpty: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  clueBarMeta: { fontSize: 10, fontWeight: '700', color: '#be185d', marginBottom: 2 },
  clueBarText: { fontSize: 13, color: '#831843', fontWeight: '500' },
  clueBarHint: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },

  gridPad: { padding: 6 },
  row: { flexDirection: 'row' },

  blackCell: {
    width: CELL,
    height: CELL,
    backgroundColor: '#374151',
    borderWidth: 0.5,
    borderColor: '#1f2937',
  },

  clueCell: {
    width: CELL,
    height: CELL,
    backgroundColor: '#fce7f3',
    borderWidth: 0.5,
    borderColor: '#f9a8d4',
    padding: 2,
    justifyContent: 'space-between',
  },
  clueCellActive: { backgroundColor: '#fbcfe8', borderColor: '#ec4899' },
  clueText: { fontSize: 6.5, color: '#831843', lineHeight: 8.5 },
  arrowIcon: { fontSize: 9, color: '#be185d', textAlign: 'right' },

  answerCell: {
    width: CELL,
    height: CELL,
    backgroundColor: '#fff',
    borderWidth: 0.5,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerCellHighlight: { backgroundColor: '#fce7f3' },
  answerCellCursor: { backgroundColor: '#ec4899', borderColor: '#be185d' },
  answerLetter: { fontSize: 17, fontWeight: '700', color: '#111' },
  answerLetterCursor: { color: '#fff' },

  keyboard: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 3,
  },
  keyRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 5 },
  key: {
    backgroundColor: '#fff',
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 6,
    margin: 2,
    minWidth: 26,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    elevation: 2,
  },
  deleteKey: { backgroundColor: '#fca5a5', paddingHorizontal: 10 },
  keyText: { fontSize: 12, fontWeight: '600', color: '#111' },

  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },
});
