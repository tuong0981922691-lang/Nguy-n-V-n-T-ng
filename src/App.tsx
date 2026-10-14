/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  testConnection,
  saveProverbNote,
  toggleVideoBookmark,
  handleFirestoreError,
  OperationType,
  type ProverbNoteData,
  type VideoBookmarkData,
} from './firebase.ts';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [notes, setNotes] = useState<ProverbNoteData[]>([]);
  const [bookmarks, setBookmarks] = useState<VideoBookmarkData[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // 1. Test Firestore Connection on Boot
  useEffect(() => {
    testConnection().then((ok) => setDbConnected(ok));
  }, []);

  // 2. Track Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      setErrorMsg(null);
    });
    return () => unsubscribe();
  }, []);

  // 3. Real-time Firestore Listeners when Authenticated
  useEffect(() => {
    if (!user) {
      setNotes([]);
      setBookmarks([]);
      return;
    }

    // Listen to Proverb Notes
    const notesPath = `users/${user.uid}/notes`;
    const unsubNotes = onSnapshot(
      collection(db, 'users', user.uid, 'notes'),
      (snapshot) => {
        const fetchedNotes: ProverbNoteData[] = [];
        snapshot.forEach((docSnap) => {
          fetchedNotes.push(docSnap.data() as ProverbNoteData);
        });
        setNotes(fetchedNotes);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, notesPath);
      }
    );

    // Listen to Video Bookmarks
    const bookmarksPath = `users/${user.uid}/bookmarks`;
    const unsubBookmarks = onSnapshot(
      collection(db, 'users', user.uid, 'bookmarks'),
      (snapshot) => {
        const fetchedBookmarks: VideoBookmarkData[] = [];
        snapshot.forEach((docSnap) => {
          fetchedBookmarks.push(docSnap.data() as VideoBookmarkData);
        });
        setBookmarks(fetchedBookmarks);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, bookmarksPath);
      }
    );

    return () => {
      unsubNotes();
      unsubBookmarks();
    };
  }, [user]);

  // Handle Google Sign-in
  const handleLogin = async () => {
    try {
      setErrorMsg(null);
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đăng nhập Google thất bại';
      setErrorMsg(msg);
    }
  };

  // Handle Sign-out
  const handleLogout = async () => {
    try {
      await signOutUser();
      setShowUserModal(false);
    } catch (err: unknown) {
      console.error('Logout error:', err);
    }
  };

  // Sync theme preference to Firestore when user changes theme
  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      if (!user) return;
      const customEvent = e as CustomEvent<{ theme: string }>;
      const newTheme = customEvent.detail?.theme;
      if (newTheme && ['dark', 'light', 'sepia'].includes(newTheme)) {
        setDoc(doc(db, 'users', user.uid), { selectedTheme: newTheme, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      }
    };

    window.addEventListener('xuong_theme_changed', handleThemeChange);
    return () => window.removeEventListener('xuong_theme_changed', handleThemeChange);
  }, [user]);

  return (
    <div className="flex items-center gap-2">
      {/* Auth state button or profile badge */}
      {loading ? (
        <span className="text-xs text-stone-400 py-1 px-2 animate-pulse">Đang nạp Auth...</span>
      ) : user ? (
        <div className="flex items-center gap-2">
          {/* Firestore status indicator */}
          <span
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-400 font-medium"
            title={`Firestore đã kết nối: ${notes.length} ghi chú, ${bookmarks.length} đánh dấu lưu trữ`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Cloud {notes.length + bookmarks.length}
          </span>

          {/* User profile button */}
          <button
            onClick={() => setShowUserModal(true)}
            className="flex items-center gap-2 px-2.5 py-1 rounded border border-stone-700 bg-stone-900/90 hover:border-amber-500/60 transition cursor-pointer text-xs text-stone-200"
            title="Xem thông tin tài khoản và dữ liệu Firestore"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-5 h-5 rounded-full object-cover border border-amber-500/40"
              />
            ) : (
              <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 font-bold flex items-center justify-center text-[10px]">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </span>
            )}
            <span className="max-w-[120px] truncate font-medium">{user.displayName || user.email || 'Chủ Xưởng'}</span>
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-amber-500 text-stone-950 hover:bg-amber-400 transition cursor-pointer shadow-sm"
          title="Đăng nhập Google để lưu trữ ghi chú và video lên Firebase Firestore"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Đăng nhập Google
        </button>
      )}

      {/* Profile & Firestore Cloud Drawer/Modal */}
      {showUserModal && user && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-700 rounded-xl max-w-md w-full p-5 shadow-2xl text-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-amber-500" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-600 text-stone-950 font-bold flex items-center justify-center text-base">
                    {user.displayName?.charAt(0) || 'U'}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-sm text-stone-100">{user.displayName || 'Chủ Xưởng Triết Lý'}</h3>
                  <p className="text-xs text-stone-400">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-stone-400 hover:text-stone-100 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="bg-stone-950 p-3 rounded-lg border border-stone-800 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-stone-400">Trạng thái Firestore:</span>
                  <span className="text-emerald-400 font-semibold">● Đang kết nối trực tuyến</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Database ID:</span>
                  <span className="text-stone-300 font-mono text-[10px]">ai-studio-xngtritl-...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Ghi chú chân đế đã lưu:</span>
                  <span className="text-amber-400 font-bold">{notes.length} câu</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Video đã đánh dấu:</span>
                  <span className="text-amber-400 font-bold">{bookmarks.length} video</span>
                </div>
              </div>

              {/* Danh sách ghi chú gần nhất */}
              {notes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-stone-300 mb-1.5">Ghi chú câu tục ngữ trên mây:</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                    {notes.slice(0, 5).map((n) => (
                      <div key={n.id} className="p-2 rounded bg-stone-950/80 border border-stone-800 text-[11px]">
                        <div className="font-medium text-amber-300 truncate">{n.cau}</div>
                        <div className="text-stone-400 text-[10px] mt-0.5">
                          Đánh giá: {n.danhGia === 'dung' ? '✓ Đúng' : n.danhGia === 'sai' ? '✗ Sai' : '? Ngờ'}
                          {n.ghiChuC2 ? ` — ${n.ghiChuC2}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lựa chọn theme ưa thích có chấm màu xem trước */}
              <div className="pt-2 border-t border-stone-800">
                <span className="text-stone-400 block mb-1.5 font-medium">Giao diện ưa thích:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'dark' } }));
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-stone-950 border border-stone-700 hover:border-amber-500 transition text-[11px] cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#111215] border border-[#f59e0b] shadow-xs"></span>
                    Trúc Mặc
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'sepia' } }));
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-stone-950 border border-stone-700 hover:border-amber-500 transition text-[11px] cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#78350f] border border-[#d97706] shadow-xs"></span>
                    Hoàng Hôn
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: 'light' } }));
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-stone-950 border border-stone-700 hover:border-amber-500 transition text-[11px] cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f6f4ee] border border-[#047857] shadow-xs"></span>
                    Trúc Sáng
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-stone-800">
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded text-xs font-semibold bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 transition cursor-pointer"
              >
                Đăng xuất
              </button>
              <button
                onClick={() => setShowUserModal(false)}
                className="px-3 py-1.5 rounded text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <span className="text-[11px] text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800/60 max-w-[150px] truncate">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
