import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { DailyPuzzle, UserProgress } from '../types';

export function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export async function fetchTodayPuzzle(): Promise<DailyPuzzle | null> {
  const date = todayDateString();
  const ref = doc(db, 'puzzles', date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  if (typeof data.grid === 'string') data.grid = JSON.parse(data.grid);
  return data as DailyPuzzle;
}

export async function fetchUserProgress(userId: string): Promise<UserProgress | null> {
  const date = todayDateString();
  const ref = doc(db, 'userProgress', userId, 'puzzles', date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserProgress;
}

export async function saveUserProgress(
  userId: string,
  progress: UserProgress
): Promise<void> {
  const ref = doc(db, 'userProgress', userId, 'puzzles', progress.date);
  await setDoc(ref, progress, { merge: true });
}

export async function completeUserProgress(
  userId: string,
  date: string,
  elapsedSeconds: number
): Promise<void> {
  const ref = doc(db, 'userProgress', userId, 'puzzles', date);
  await updateDoc(ref, {
    isCompleted: true,
    completedAt: Date.now(),
    elapsedSeconds,
  });

  // Skor tablosuna kaydet
  const leaderRef = doc(db, 'leaderboard', date, 'scores', userId);
  await setDoc(leaderRef, {
    userId,
    completionTime: elapsedSeconds,
    completedAt: Date.now(),
  });
}
