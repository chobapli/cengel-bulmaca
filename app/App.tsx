import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './src/config/firebase';
import { fetchTodayPuzzle } from './src/services/puzzleService';
import { DailyPuzzle, CrosswordCell } from './src/types';

const CELL_SIZE = 34;
const GRID_SIZE = 10;

export default function App() {
  const [puzzle, setPuzzle] = useState<DailyPuzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [userGrid, setUserGrid] = useState<string[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    signInAnonymously(auth)
      .then(() => fetchTodayPuzzle())
      .then((p) => {
        if (p) {
          setPuzzle(p);
          setUserGrid(
            Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''))
          );
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
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleCellPress = (row: number, col: number) => {
    if (!puzzle) return;
    const cell = puzzle.grid[row][col];
    if (cell.isBlack) return;
    if (selectedCell?.row === row && selectedCell?.col === col) {
      setDirection((d) => (d === 'across' ? 'down' : 'across'));
    } else {
      setSelectedCell({ row, col });
    }
  };

  const handleInput = (letter: string) => {
    if (!selectedCell || !puzzle) return;
    const { row, col } = selectedCell;
    const cell = puzzle.grid[row][col];
    if (cell.isBlack) return;

    const newGrid = userGrid.map((r) => [...r]);
    newGrid[row][col] = letter.toUpperCase();
    setUserGrid(newGrid);

    // Sonraki hücreye geç
    let nextRow = row;
    let nextCol = col;
    if (direction === 'across') nextCol = col + 1;
    else nextRow = row + 1;

    if (
      nextRow < GRID_SIZE &&
      nextCol < GRID_SIZE &&
      !puzzle.grid[nextRow][nextCol].isBlack
    ) {
      setSelectedCell({ row: nextRow, col: nextCol });
    }

    // Tamamlandı mı kontrol et
    const isComplete = puzzle.grid.every((r, ri) =>
      r.every((c, ci) => c.isBlack || newGrid[ri][ci] === c.letter)
    );
    if (isComplete) {
      setCompleted(true);
      Alert.alert('Tebrikler!', `Bulmacayı ${formatTime(elapsedSeconds)} sürede tamamladınız!`);
    }
  };

  const getActiveWordNumbers = () => {
    if (!selectedCell || !puzzle) return [];
    return puzzle.grid[selectedCell.row][selectedCell.col].wordNumbers;
  };

  const isCellInActiveWord = (row: number, col: number) => {
    if (!selectedCell || !puzzle) return false;
    const activeNums = getActiveWordNumbers();
    const word = puzzle.words.find(
      (w) => activeNums.includes(w.number) && w.direction === direction
    );
    if (!word) return false;
    if (word.direction === 'across') {
      return row === word.row && col >= word.col && col < word.col + word.word.length;
    } else {
      return col === word.col && row >= word.row && row < word.row + word.word.length;
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
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

  const activeWord = puzzle.words.find(
    (w) => getActiveWordNumbers().includes(w.number) && w.direction === direction
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Çengel Bulmaca</Text>
        <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
      </View>

      {activeWord && (
        <View style={styles.clueBar}>
          <Text style={styles.clueNum}>{activeWord.number}. {activeWord.direction === 'across' ? 'Yatay' : 'Dikey'}</Text>
          <Text style={styles.clueText}>{activeWord.clue}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.grid}>
          {puzzle.grid.map((row: CrosswordCell[], ri: number) => (
            <View key={ri} style={styles.row}>
              {row.map((cell: CrosswordCell, ci: number) => {
                const isSelected = selectedCell?.row === ri && selectedCell?.col === ci;
                const isHighlighted = isCellInActiveWord(ri, ci);
                const wordNum = cell.wordNumbers.length > 0 ? Math.min(...cell.wordNumbers) : null;

                return (
                  <TouchableOpacity
                    key={ci}
                    onPress={() => handleCellPress(ri, ci)}
                    style={[
                      styles.cell,
                      cell.isBlack && styles.blackCell,
                      isHighlighted && styles.highlightedCell,
                      isSelected && styles.selectedCell,
                    ]}
                    activeOpacity={cell.isBlack ? 1 : 0.7}
                  >
                    {!cell.isBlack && (
                      <>
                        {wordNum !== null && cell.wordNumbers[0] === wordNum && (
                          <Text style={styles.cellNumber}>{wordNum}</Text>
                        )}
                        <Text style={[styles.cellLetter, isSelected && styles.selectedLetter]}>
                          {userGrid[ri]?.[ci] || ''}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        {/* Klavye */}
        <View style={styles.keyboard}>
          {['QWERTYUIOPĞÜ', 'ASDFGHJKLŞİ', 'ZXCVBNMÖÇ'].map((row, ri) => (
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
                <TouchableOpacity
                  style={[styles.key, styles.deleteKey]}
                  onPress={() => {
                    if (!selectedCell) return;
                    const { row, col } = selectedCell;
                    const newGrid = userGrid.map((r) => [...r]);
                    newGrid[row][col] = '';
                    setUserGrid(newGrid);
                  }}
                >
                  <Text style={styles.keyText}>⌫</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* İpuçları */}
        <View style={styles.cluesSection}>
          <Text style={styles.cluesTitle}>Yatay</Text>
          {puzzle.words.filter((w) => w.direction === 'across').map((w) => (
            <TouchableOpacity
              key={`${w.number}-across`}
              onPress={() => {
                setSelectedCell({ row: w.row, col: w.col });
                setDirection('across');
              }}
            >
              <Text style={styles.clueItem}><Text style={styles.clueItemNum}>{w.number}.</Text> {w.clue}</Text>
            </TouchableOpacity>
          ))}
          <Text style={[styles.cluesTitle, { marginTop: 16 }]}>Dikey</Text>
          {puzzle.words.filter((w) => w.direction === 'down').map((w) => (
            <TouchableOpacity
              key={`${w.number}-down`}
              onPress={() => {
                setSelectedCell({ row: w.row, col: w.col });
                setDirection('down');
              }}
            >
              <Text style={styles.clueItem}><Text style={styles.clueItemNum}>{w.number}.</Text> {w.clue}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#111' },
  timer: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  clueBar: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
  },
  clueNum: { fontSize: 11, fontWeight: '700', color: '#2563eb', marginBottom: 2 },
  clueText: { fontSize: 13, color: '#1e3a5f' },
  scrollContent: { alignItems: 'center', paddingBottom: 40 },
  grid: { marginTop: 12, borderWidth: 1, borderColor: '#374151' },
  row: { flexDirection: 'row' },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0.5,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  blackCell: { backgroundColor: '#1f2937' },
  highlightedCell: { backgroundColor: '#bfdbfe' },
  selectedCell: { backgroundColor: '#2563eb' },
  cellNumber: { position: 'absolute', top: 1, left: 2, fontSize: 7, color: '#374151' },
  cellLetter: { fontSize: 14, fontWeight: '700', color: '#111' },
  selectedLetter: { color: '#fff' },
  keyboard: { marginTop: 16, width: '100%', paddingHorizontal: 4 },
  keyRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 6 },
  key: {
    backgroundColor: '#e5e7eb',
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 8,
    margin: 2,
    minWidth: 28,
    alignItems: 'center',
  },
  deleteKey: { paddingHorizontal: 12, backgroundColor: '#f87171' },
  keyText: { fontSize: 13, fontWeight: '600', color: '#111' },
  cluesSection: { width: '100%', paddingHorizontal: 20, marginTop: 20 },
  cluesTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#111' },
  clueItem: { fontSize: 14, color: '#374151', marginBottom: 6, lineHeight: 20 },
  clueItemNum: { fontWeight: '700' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#666', textAlign: 'center' },
});
