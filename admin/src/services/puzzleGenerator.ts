import Anthropic from '@anthropic-ai/sdk';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// ── Tipler ───────────────────────────────────────────────────────────────────

type ArrowDir = 'right' | 'down';

interface WordWithClue {
  word: string;
  clue: string;
}

interface ChengelWord {
  id: number;
  word: string;
  clue: string;
  clueRow: number;
  clueCol: number;
  direction: ArrowDir;
}

interface ChengelPuzzle {
  date: string;
  gridRows: number;
  gridCols: number;
  words: ChengelWord[];
  createdAt: number;
}

// Grid hücresi: null | soru hücresi | cevap hücresi
type PCell =
  | null
  | { t: 'c'; wid: number }
  | { t: 'a'; letter: string; wids: number[] };

const GRID = 22;

// ── Claude ile kelime üretimi ─────────────────────────────────────────────────

async function generateWordsWithClaude(apiKey: string): Promise<WordWithClue[]> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Türkçe çengel bulmaca için 35 farklı kelime üret. Kurallar:
- Sadece büyük Türkçe harfler (Ç Ğ İ Ö Ş Ü dahil, I yerine İ kullan)
- 3-8 harf uzunluğunda olsun
- Çok çeşitli konular: hayvanlar, bitkiler, şehirler, meslekler, yiyecekler, nesneler, sıfatlar
- Her kelime için maksimum 4 kelimelik kısa ve net bir Türkçe ipucu yaz
- İpuçta cevap kelimesini kullanma
- Kelimeler birbirinden farklı ve yaygın olsun

SADECE şu JSON formatında yanıt ver, başka hiçbir şey yazma:
[
  {"word": "ELMA", "clue": "Kırmızı ya da yeşil meyve"},
  ...
]`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Beklenmeyen yanıt tipi');

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Claude yanıtında JSON bulunamadı');

  return JSON.parse(jsonMatch[0]) as WordWithClue[];
}

// ── Türk çengeli yerleştirme algoritması ─────────────────────────────────────

function canPlace(
  grid: PCell[][],
  word: string,
  cr: number,
  cc: number,
  dir: ArrowDir,
  requireIntersection: boolean
): boolean {
  // Soru hücresi sınır kontrolü
  if (cr < 0 || cr >= GRID || cc < 0 || cc >= GRID) return false;
  if (grid[cr][cc] !== null) return false;

  let intersections = 0;

  for (let i = 0; i < word.length; i++) {
    const r = dir === 'down' ? cr + 1 + i : cr;
    const c = dir === 'right' ? cc + 1 + i : cc;

    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
    const cell = grid[r][c];
    if (cell === null) continue;
    if (cell.t === 'c') return false; // cevap hücresi ile soru hücresi çakışamaz
    if (cell.t === 'a') {
      if (cell.letter !== word[i]) return false;
      intersections++;
    }
  }

  // Kelimenin bitiminden hemen sonra başka bir cevap hücresi gelemesin
  const endR = dir === 'down' ? cr + 1 + word.length : cr;
  const endC = dir === 'right' ? cc + 1 + word.length : cc;
  if (endR >= 0 && endR < GRID && endC >= 0 && endC < GRID) {
    if (grid[endR][endC]?.t === 'a') return false;
  }

  if (requireIntersection && intersections === 0) return false;
  return true;
}

function placeWord(
  grid: PCell[][],
  word: string,
  clue: string,
  cr: number,
  cc: number,
  dir: ArrowDir,
  wid: number,
  out: ChengelWord[]
): void {
  grid[cr][cc] = { t: 'c', wid };

  for (let i = 0; i < word.length; i++) {
    const r = dir === 'down' ? cr + 1 + i : cr;
    const c = dir === 'right' ? cc + 1 + i : cc;
    const existing = grid[r][c];
    if (existing?.t === 'a') {
      existing.wids.push(wid);
    } else {
      grid[r][c] = { t: 'a', letter: word[i], wids: [wid] };
    }
  }

  out.push({ id: wid, word, clue, clueRow: cr, clueCol: cc, direction: dir });
}

function buildCrossword(words: WordWithClue[]): ChengelPuzzle | null {
  const grid: PCell[][] = Array.from({ length: GRID }, () => Array(GRID).fill(null));
  const placed: ChengelWord[] = [];
  let wid = 1;

  // Uzunluğa göre sırala (uzun kelimeler önce — daha fazla kesişim şansı)
  const sorted = [...words].sort((a, b) => b.word.length - a.word.length);

  // İlk kelimeyi yatay olarak ortaya yerleştir
  const first = sorted[0];
  const startC = Math.max(0, Math.floor((GRID - first.word.length - 1) / 2));
  const startR = Math.floor(GRID / 2);
  placeWord(grid, first.word, first.clue, startR, startC, 'right', wid++, placed);

  // Sonraki kelimeleri yerleştir
  for (let wi = 1; wi < sorted.length; wi++) {
    const { word, clue } = sorted[wi];
    // Çift indisli kelimeler dikey, tek indisli yatay (daha dengeli yerleşim)
    const dirs: ArrowDir[] = wi % 2 === 0 ? ['right', 'down'] : ['down', 'right'];
    let didPlace = false;

    for (const dir of dirs) {
      const candidates: { cr: number; cc: number }[] = [];

      // Mevcut cevap hücreleriyle kesişim ara
      for (let li = 0; li < word.length; li++) {
        for (let r = 0; r < GRID; r++) {
          for (let c = 0; c < GRID; c++) {
            const cell = grid[r][c];
            if (!cell || cell.t !== 'a' || cell.letter !== word[li]) continue;

            const cr = dir === 'right' ? r : r - li - 1;
            const cc = dir === 'right' ? c - li - 1 : c;

            if (canPlace(grid, word, cr, cc, dir, true)) {
              candidates.push({ cr, cc });
            }
          }
        }
      }

      if (candidates.length > 0) {
        // Birden fazla aday varsa rastgele birini seç (çeşitlilik için)
        const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
        placeWord(grid, word, clue, pick.cr, pick.cc, dir, wid++, placed);
        didPlace = true;
        break;
      }
    }

    // Kesişim bulunamazsa ve henüz az kelime yerleşmişse izole yerleştir
    if (!didPlace && placed.length < 6) {
      const dir: ArrowDir = wi % 2 === 0 ? 'right' : 'down';
      for (let attempt = 0; attempt < 20; attempt++) {
        const cr = Math.floor(Math.random() * (GRID - word.length - 2));
        const cc = Math.floor(Math.random() * (GRID - word.length - 2));
        if (canPlace(grid, word, cr, cc, dir, false)) {
          placeWord(grid, word, clue, cr, cc, dir, wid++, placed);
          didPlace = true;
          break;
        }
      }
    }
  }

  if (placed.length < 8) return null;

  // Kullanılan alanı hesapla ve koordinatları küçült
  let minR = GRID, maxR = 0, minC = GRID, maxC = 0;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (grid[r][c] !== null) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }

  // Sınır boşluğu bırak (1 hücre)
  minR = Math.max(0, minR - 1);
  minC = Math.max(0, minC - 1);
  maxR = Math.min(GRID - 1, maxR + 1);
  maxC = Math.min(GRID - 1, maxC + 1);

  const adjustedWords = placed.map((w) => ({
    ...w,
    clueRow: w.clueRow - minR,
    clueCol: w.clueCol - minC,
  }));

  return {
    date: new Date().toISOString().split('T')[0],
    gridRows: maxR - minR + 1,
    gridCols: maxC - minC + 1,
    words: adjustedWords,
    createdAt: Date.now(),
  };
}

// ── Dışa aktarılan fonksiyon ──────────────────────────────────────────────────

export async function generateAndSavePuzzle(
  apiKey: string,
  targetDate: string
): Promise<ChengelPuzzle> {
  const existing = await getDoc(doc(db, 'puzzles', targetDate));
  if (existing.exists()) throw new Error(`${targetDate} için bulmaca zaten mevcut`);

  const wordList = await generateWordsWithClaude(apiKey);

  // Birkaç deneme yap (rastgele sıra nedeniyle farklı sonuçlar çıkabilir)
  let puzzle: ChengelPuzzle | null = null;
  for (let attempt = 0; attempt < 3 && !puzzle; attempt++) {
    const shuffled = [...wordList].sort(() => Math.random() - 0.5);
    puzzle = buildCrossword(shuffled);
  }

  if (!puzzle) throw new Error('Bulmaca oluşturulamadı. Lütfen tekrar deneyin.');

  puzzle.date = targetDate;
  await setDoc(doc(db, 'puzzles', targetDate), puzzle);
  return puzzle;
}
