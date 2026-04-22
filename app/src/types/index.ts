export type ArrowDir = 'right' | 'down';

export interface ChengelWord {
  id: number;
  word: string;
  clue: string;
  clueRow: number;
  clueCol: number;
  direction: ArrowDir;
}

export interface ChengelPuzzle {
  date: string;
  gridRows: number;
  gridCols: number;
  words: ChengelWord[];
  createdAt: number;
}

export interface UserProgress {
  date: string;
  userAnswers: { [key: string]: string };
  startedAt: number;
  lastUpdatedAt: number;
  completedAt: number | null;
  elapsedSeconds: number;
  isCompleted: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  completionTime: number;
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
