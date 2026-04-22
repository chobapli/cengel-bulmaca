import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ChengelPuzzle, UserProgress } from '../types';

export function todayDateString(): string {
  // TEST: admin'de üretilen bulmacayı görmek için geçici
  return '2026-04-23';
  // return new Date().toISOString().split('T')[0];
}

export async function fetchTodayPuzzle(): Promise<ChengelPuzzle | null> {
  const date = todayDateString();
  const ref = doc(db, 'puzzles', date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as ChengelPuzzle;
}

export async function fetchUserProgress(userId: string): Promise<UserProgress | null> {
  const date = todayDateString();
  const ref = doc(db, 'userProgress', userId, 'puzzles', date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as UserProgress;
}

export async function saveUserProgress(userId: string, progress: UserProgress): Promise<void> {
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
  const leaderRef = doc(db, 'leaderboard', date, 'scores', userId);
  await setDoc(leaderRef, {
    userId,
    completionTime: elapsedSeconds,
    completedAt: Date.now(),
  });
}
