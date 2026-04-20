import Anthropic from '@anthropic-ai/sdk';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const GRID_SIZE = 10;

interface WordWithClue {
  word: string;
  clue: string;
}

interface PlacedWord extends WordWithClue {
  row: number;
  col: number;
  direction: 'across' | 'down';
  number: number;
}

interface CrosswordCell {
  letter: string;
  wordNumbers: number[];
  isBlack: boolean;
}

interface DailyPuzzle {
  date: string;
  grid: CrosswordCell[][];
  words: PlacedWord[];
  createdAt: number;
}

async function generateWordsWithClaude(apiKey: string): Promise<WordWithClue[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Türkçe çengel bulmaca için 12 kelime üret. Kelimeler:
- Sadece büyük Türkçe harflerden oluşsun (Ç, Ğ, İ, Ö, Ş, Ü dahil)
- 4-8 harf uzunluğunda olsun
- Günlük hayatta kullanılan yaygın kelimeler olsun
- Her kelime için kısa ve net bir ipucu yaz

Yanıtı SADECE şu JSON formatında ver, başka hiçbir şey yazma:
[
  {"word": "KELIME", "clue": "İpucu metni"},
  ...
]`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Beklenmeyen yanıt tipi');

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('JSON bulunamadı');

  return JSON.parse(jsonMatch[0]) as WordWithClue[];
}

function createEmptyGrid(): string[][] {
  return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));
}

function canPlace(grid: string[][], word: string, row: number, col: number, dir: 'across' | 'down'): boolean {
  if (dir === 'across') {
    if (col + word.length > GRID_SIZE) return false;
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

function placeWord(grid: string[][], word: string, row: number, col: number, dir: 'across' | 'down'): void {
  for (let i = 0; i < word.length; i++) {
    if (dir === 'across') grid[row][col + i] = word[i];
    else grid[row + i][col] = word[i];
  }
}

function buildCrossword(wordList: WordWithClue[]): DailyPuzzle | null {
  const grid = createEmptyGrid();
  const placed: Array<WordWithClue & { row: number; col: number; direction: 'across' | 'down' }> = [];

  const first = wordList[0];
  const fc = Math.floor((GRID_SIZE - first.word.length) / 2);
  const fr = Math.floor(GRID_SIZE / 2);
  if (fc < 0) return null;

  placeWord(grid, first.word, fr, fc, 'across');
  placed.push({ ...first, row: fr, col: fc, direction: 'across' });

  for (let i = 1; i < wordList.length; i++) {
    const { word, clue } = wordList[i];
    const dirs: Array<'across' | 'down'> = i % 2 === 0 ? ['across', 'down'] : ['down', 'across'];

    let didPlace = false;
    for (const dir of dirs) {
      const positions: Array<{ row: number; col: number; score: number }> = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!canPlace(grid, word, r, c, dir)) continue;
          let score = 0;
          for (let k = 0; k < word.length; k++) {
            const cell = dir === 'across' ? grid[r][c + k] : grid[r + k][c];
            if (cell === word[k]) score++;
          }
          if (score > 0) positions.push({ row: r, col: c, score });
        }
      }
      if (positions.length > 0) {
        positions.sort((a, b) => b.score - a.score);
        const best = positions[0];
        placeWord(grid, word, best.row, best.col, dir);
        placed.push({ word, clue, row: best.row, col: best.col, direction: dir });
        didPlace = true;
        break;
      }
    }
    if (!didPlace) continue;
  }

  const cellGrid: CrosswordCell[][] = Array(GRID_SIZE).fill(null).map(() =>
    Array(GRID_SIZE).fill(null).map(() => ({ letter: '', wordNumbers: [], isBlack: true }))
  );

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] !== '') {
        cellGrid[r][c].letter = grid[r][c];
        cellGrid[r][c].isBlack = false;
      }
    }
  }

  const sorted = [...placed].sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);
  const numberedCells = new Map<string, number>();
  const words: PlacedWord[] = [];
  let num = 1;

  for (const p of sorted) {
    const key = `${p.row}-${p.col}`;
    if (!numberedCells.has(key)) numberedCells.set(key, num++);
    const wordNumber = numberedCells.get(key)!;
    words.push({ ...p, number: wordNumber });
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

export async function generateAndSavePuzzle(
  apiKey: string,
  targetDate: string
): Promise<DailyPuzzle> {
  const existing = await getDoc(doc(db, 'puzzles', targetDate));
  if (existing.exists()) throw new Error(`${targetDate} için bulmaca zaten mevcut`);

  const wordList = await generateWordsWithClaude(apiKey);
  const puzzle = buildCrossword(wordList);
  if (!puzzle) throw new Error('Bulmaca oluşturulamadı, tekrar deneyin');

  puzzle.date = targetDate;
  await setDoc(doc(db, 'puzzles', targetDate), puzzle);
  return puzzle;
}
