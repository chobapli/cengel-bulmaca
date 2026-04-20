import { CrosswordCell, CrosswordWord, DailyPuzzle } from '../types';

const GRID_SIZE = 10;

interface PlacedWord {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

function createEmptyGrid(): string[][] {
  return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));
}

function canPlace(
  grid: string[][],
  word: string,
  row: number,
  col: number,
  direction: 'across' | 'down'
): boolean {
  if (direction === 'across') {
    if (col + word.length > GRID_SIZE) return false;
    // Baştan önce ve sondan sonra boş olmalı
    if (col > 0 && grid[row][col - 1] !== '') return false;
    if (col + word.length < GRID_SIZE && grid[row][col + word.length] !== '') return false;
    for (let i = 0; i < word.length; i++) {
      const cell = grid[row][col + i];
      if (cell !== '' && cell !== word[i]) return false;
    }
  } else {
    if (row + word.length > GRID_SIZE) return false;
    if (row > 0 && grid[row - 1][col] !== '') return false;
    if (row + word.length < GRID_SIZE && grid[row + word.length][col] !== '') return false;
    for (let i = 0; i < word.length; i++) {
      const cell = grid[row + i][col];
      if (cell !== '' && cell !== word[i]) return false;
    }
  }
  return true;
}

function placeWord(
  grid: string[][],
  word: string,
  row: number,
  col: number,
  direction: 'across' | 'down'
): void {
  for (let i = 0; i < word.length; i++) {
    if (direction === 'across') {
      grid[row][col + i] = word[i];
    } else {
      grid[row + i][col] = word[i];
    }
  }
}

function findIntersections(
  grid: string[][],
  word: string,
  direction: 'across' | 'down'
): Array<{ row: number; col: number; score: number }> {
  const positions: Array<{ row: number; col: number; score: number }> = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!canPlace(grid, word, r, c, direction)) continue;

      let intersections = 0;
      for (let i = 0; i < word.length; i++) {
        const cell = direction === 'across' ? grid[r][c + i] : grid[r + i][c];
        if (cell === word[i]) intersections++;
      }

      if (intersections > 0) {
        positions.push({ row: r, col: c, score: intersections });
      }
    }
  }

  return positions.sort((a, b) => b.score - a.score);
}

export function generateCrossword(
  wordList: Array<{ word: string; clue: string }>
): DailyPuzzle | null {
  if (wordList.length === 0) return null;

  const grid = createEmptyGrid();
  const placed: PlacedWord[] = [];

  // İlk kelimeyi ortaya yatay yerleştir
  const first = wordList[0];
  const firstCol = Math.floor((GRID_SIZE - first.word.length) / 2);
  const firstRow = Math.floor(GRID_SIZE / 2);

  if (firstCol < 0) return null;
  placeWord(grid, first.word, firstRow, firstCol, 'across');
  placed.push({ ...first, row: firstRow, col: firstCol, direction: 'across' });

  // Geri kalan kelimeleri kesişimlerle yerleştir
  for (let i = 1; i < wordList.length; i++) {
    const { word, clue } = wordList[i];
    const direction: 'across' | 'down' = i % 2 === 0 ? 'across' : 'down';
    const altDirection: 'across' | 'down' = direction === 'across' ? 'down' : 'across';

    let bestPositions = findIntersections(grid, word, direction);
    if (bestPositions.length === 0) {
      bestPositions = findIntersections(grid, word, altDirection);
      if (bestPositions.length === 0) continue;
      const best = bestPositions[0];
      placeWord(grid, word, best.row, best.col, altDirection);
      placed.push({ word, clue, row: best.row, col: best.col, direction: altDirection });
    } else {
      const best = bestPositions[0];
      placeWord(grid, word, best.row, best.col, direction);
      placed.push({ word, clue, row: best.row, col: best.col, direction });
    }
  }

  // Grid hücrelerini oluştur
  const cellGrid: CrosswordCell[][] = Array(GRID_SIZE).fill(null).map(() =>
    Array(GRID_SIZE).fill(null).map(() => ({
      letter: '',
      wordNumbers: [],
      isBlack: true,
    }))
  );

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] !== '') {
        cellGrid[r][c].letter = grid[r][c];
        cellGrid[r][c].isBlack = false;
      }
    }
  }

  // Kelime numaralarını ata
  const words: CrosswordWord[] = [];
  let number = 1;
  const numberedCells = new Map<string, number>();

  const sortedPlaced = [...placed].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });

  for (const p of sortedPlaced) {
    const key = `${p.row}-${p.col}`;
    if (!numberedCells.has(key)) {
      numberedCells.set(key, number++);
    }
    const wordNumber = numberedCells.get(key)!;

    words.push({
      word: p.word,
      clue: p.clue,
      row: p.row,
      col: p.col,
      direction: p.direction,
      number: wordNumber,
    });

    for (let i = 0; i < p.word.length; i++) {
      const r = p.direction === 'down' ? p.row + i : p.row;
      const c = p.direction === 'across' ? p.col + i : p.col;
      if (!cellGrid[r][c].wordNumbers.includes(wordNumber)) {
        cellGrid[r][c].wordNumbers.push(wordNumber);
      }
    }
  }

  return {
    date: new Date().toISOString().split('T')[0],
    grid: cellGrid,
    words,
    createdAt: Date.now(),
  };
}
