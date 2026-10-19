// Google sign-in + Firestore sync. Each account's data lives in one document: users/{uid}/apps/cardperks.
// Uses the same Firebase project as Lingua; see the README for the one extra Firestore rule this needs.
import config from './firebase-config.js';
import * as store from './store.js';

const V = '12.19.0';
const CDN = `https://www.gstatic.com/firebasejs/${V}`;

let fb = null;
let user = null;
let unsubDoc = null;
let pushTimer = null;
let lastPushed = '';
let status = 'off';     // off | signed-out | syncing | synced | error
let lastError = '';
const subs = new Set();

export const currentUser = () => user;
export const syncStatus = () => ({ status, lastError });
export const onSyncChange = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = (remoteChanged = false) => subs.forEach((fn) => fn({ user, status, remoteChanged }));
const setStatus = (s, err = '') => { status = s; lastError = err; emit(); };

async function load() {
  if (fb) return fb;
  const [app, auth, fs] = await Promise.all([
    import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`),
  ]);
  const a = app.initializeApp(config, 'cardperks');
  fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), authMod: auth, fs };
  return fb;
}

const docRef = () => fb.fs.doc(fb.db, 'users', user.uid, 'apps', 'cardperks');
const payload = () => JSON.stringify(store.syncable());

async function push() {
  clearTimeout(pushTimer);
  if (!user) return;
  const data = payload();
  if (data === lastPushed) return;
  setStatus('syncing');
  try {
    await fb.fs.setDoc(docRef(), { data, updatedAt: fb.fs.serverTimestamp() });
    lastPushed = data;
    setStatus('synced');
  } catch (e) {
    console.warn('Sync push failed', e);
    setStatus('error', e.code === 'permission-denied' ? 'Permission denied — add the Firestore rule from the README.' : (e.message || 'Could not save to the cloud.'));
  }
}
const schedulePush = () => { if (user) { clearTimeout(pushTimer); pushTimer = setTimeout(push, 1200); } };

async function reconcile() {
  setStatus('syncing');
  const snap = await fb.fs.getDoc(docRef());
  const remote = snap.exists() ? JSON.parse(snap.data().data) : null;
  const owner = store.get().ownerUid;
  if (owner && owner !== user.uid) store.applyRemote(remote || {}, user.uid); // another account's data: never mix
  else if (remote) store.applyRemote(store.hasData() ? store.merge(store.syncable(), remote) : remote, user.uid);
  else store.setOwner(user.uid);
  lastPushed = remote ? JSON.stringify(remote) : '';
  emit(true);
  await push();

  unsubDoc?.();
  unsubDoc = fb.fs.onSnapshot(docRef(), (s) => {
    if (s.metadata.hasPendingWrites || !s.exists()) return;
    const raw = s.data().data;
    if (raw === lastPushed) return;
    store.applyRemote(store.merge(store.syncable(), JSON.parse(raw)), user.uid);
    lastPushed = raw;
    setStatus('synced');
    emit(true);
    if (JSON.stringify(store.syncable()) !== raw) schedulePush();
  }, (e) => setStatus('error', e.code === 'permission-denied' ? 'Permission denied — add the Firestore rule from the README.' : e.message));
}

export async function initSync() {
  try { await load(); } catch { setStatus('error', 'Could not load Firebase (offline?).'); return; }
  store.onChange(schedulePush);
  fb.authMod.getRedirectResult(fb.auth).catch((e) => setStatus('error', e.message || 'Sign-in failed.'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') push(); });
  fb.authMod.onAuthStateChanged(fb.auth, async (u) => {
    user = u;
    unsubDoc?.(); unsubDoc = null;
    if (!u) { setStatus('signed-out'); return; }
    try { await reconcile(); } catch (e) { console.warn(e); setStatus('error', e.code === 'permission-denied' ? 'Permission denied — add the Firestore rule from the README.' : (e.message || 'Sync failed.')); }
  });
}

export async function signIn() {
  await load();
  const provider = new fb.authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await fb.authMod.signInWithPopup(fb.auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') await fb.authMod.signInWithRedirect(fb.auth, provider);
    else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') throw e;
  }
}

/** Sign out and clear this device. Data stays in the cloud. */
export async function signOut() {
  await push();
  unsubDoc?.(); unsubDoc = null;
  await fb.authMod.signOut(fb.auth);
  store.resetAll();
  lastPushed = '';
  emit(true);
}
