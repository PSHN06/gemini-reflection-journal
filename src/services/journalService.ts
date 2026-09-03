import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { JournalEntry, UserInteractionRecord } from '../types';
import { sanitizePayload } from '../utils/sanitize';

/**
 * Subscribes to real-time updates for a user's isolated journal reflections.
 * Path: /users/{userId}/entries
 */
export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        entries.push({
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled Reflection',
          content: data.content || '',
          mode: data.mode || 'reflection',
          tags: Array.isArray(data.tags) ? data.tags : [],
          mood: data.mood || '',
          messages: Array.isArray(data.messages) ? data.messages : [],
          summary: data.summary || '',
          lastGeminiModel: data.lastGeminiModel || '',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        });
      });
      onUpdate(entries);
    },
    (err) => {
      console.error('Firestore entries subscription error:', err);
      onError(err);
    }
  );
}

/**
 * Creates or overwrites a journal entry for the authenticated user.
 */
export async function saveJournalEntry(
  userId: string,
  entry: JournalEntry
): Promise<void> {
  if (!userId) throw new Error('User authentication required to save entry.');
  
  const entryId = entry.id || doc(collection(db, 'users', userId, 'entries')).id;
  const docRef = doc(db, 'users', userId, 'entries', entryId);

  const payload = sanitizePayload({
    ...entry,
    id: entryId,
    userId,
    updatedAt: Date.now(),
  });

  await setDoc(docRef, payload, { merge: true });
}

/**
 * Updates specific fields of an existing journal entry.
 */
export async function updateJournalEntryFields(
  userId: string,
  entryId: string,
  updates: Partial<JournalEntry>
): Promise<void> {
  if (!userId || !entryId) throw new Error('Valid userId and entryId are required.');

  const docRef = doc(db, 'users', userId, 'entries', entryId);
  const sanitized = sanitizePayload({
    ...updates,
    updatedAt: Date.now(),
  });

  await updateDoc(docRef, sanitized);
}

/**
 * Deletes a journal entry securely.
 */
export async function deleteJournalEntry(
  userId: string,
  entryId: string
): Promise<void> {
  if (!userId || !entryId) throw new Error('Valid userId and entryId are required.');
  const docRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(docRef);
}

/**
 * Logs an AI interaction record in the user's isolated subcollection.
 * Path: /users/{userId}/interactions
 */
export async function logUserInteraction(
  userId: string,
  interaction: UserInteractionRecord
): Promise<string> {
  if (!userId) return '';
  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const newDoc = doc(interactionsRef);
  
  const payload = sanitizePayload({
    ...interaction,
    id: newDoc.id,
    userId,
    timestamp: Date.now(),
  });

  await setDoc(newDoc, payload);
  return newDoc.id;
}
