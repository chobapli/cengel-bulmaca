export interface CrosswordWord {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
  number: number;
}

export interface CrosswordCell {
  letter: string;
  wordNumbers: number[];
  isBlack: boolean;
}

export interface DailyPuzzle {
  date: string; // YYYY-MM-DD
  grid: CrosswordCell[][];
  words: CrosswordWord[];
  createdAt: number;
}

export interface UserProgress {
  date: string;
  userGrid: (string | null)[][];
  startedAt: number;
  lastUpdatedAt: number;
  completedAt: number | null;
  elapsedSeconds: number;
  isCompleted: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  completionTime: number; // saniye cinsinden
  completedAt: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  provider: 'apple' | 'google';
  createdAt: number;
  totalCompleted: number;
  bestTime: number | null;
}
