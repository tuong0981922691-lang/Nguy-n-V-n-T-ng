/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Operation types for error context
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection on Boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on test/connection is normal and indicates server connection is alive
    return true;
  }
}

// User Profile Sync
export async function syncUserProfile(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();
  try {
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Chủ Xưởng',
        photoURL: user.photoURL || '',
        selectedTheme: 'dark',
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await setDoc(
        userRef,
        {
          displayName: user.displayName || 'Chủ Xưởng',
          photoURL: user.photoURL || '',
          updatedAt: now,
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

// Sign-in with Google popup
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await syncUserProfile(result.user);
    return result.user;
  } catch (error) {
    console.error('Lỗi đăng nhập Google:', error);
    throw error;
  }
}

// Sign-out
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

// Proverb Note Operations
export interface ProverbNoteData {
  id: string;
  userId: string;
  cau: string;
  danhGia: 'dung' | 'sai' | 'ngo';
  ghiChuC2: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveProverbNote(note: Omit<ProverbNoteData, 'createdAt' | 'updatedAt'>): Promise<void> {
  if (!auth.currentUser) throw new Error('Cần đăng nhập để lưu ghi chú');
  const path = `users/${auth.currentUser.uid}/notes/${note.id}`;
  const now = new Date().toISOString();
  try {
    await setDoc(
      doc(db, 'users', auth.currentUser.uid, 'notes', note.id),
      {
        ...note,
        userId: auth.currentUser.uid,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Video Bookmark Operations
export interface VideoBookmarkData {
  id: string;
  userId: string;
  me: string;
  tieuDe: string;
  la9x16: boolean;
  ghiChu: string;
  daDang: boolean;
  createdAt: string;
}

export async function toggleVideoBookmark(video: { me: string; tieuDe: string; la9x16: boolean; daDang: boolean }): Promise<boolean> {
  if (!auth.currentUser) throw new Error('Cần đăng nhập để lưu đánh dấu video');
  const bookmarkId = video.me.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `users/${auth.currentUser.uid}/bookmarks/${bookmarkId}`;
  const bookmarkRef = doc(db, 'users', auth.currentUser.uid, 'bookmarks', bookmarkId);

  try {
    const existing = await getDoc(bookmarkRef);
    if (existing.exists()) {
      await deleteDoc(bookmarkRef);
      return false; // Removed
    } else {
      await setDoc(bookmarkRef, {
        id: bookmarkId,
        userId: auth.currentUser.uid,
        me: video.me,
        tieuDe: video.tieuDe,
        la9x16: video.la9x16,
        ghiChu: '',
        daDang: video.daDang,
        createdAt: new Date().toISOString(),
      });
      return true; // Added
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
