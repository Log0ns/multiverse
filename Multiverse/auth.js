// auth.js — Firebase Auth + Firestore sync
const Auth = (() => {
  const firebaseConfig = {
    apiKey: "AIzaSyDnoMnDVyOFbdeLBaTyX-c4XMOyJPeryDs",
    authDomain: "multiverse-bcb37.firebaseapp.com",
    projectId: "multiverse-bcb37",
    storageBucket: "multiverse-bcb37.firebasestorage.app",
    messagingSenderId: "646510082303",
    appId: "1:646510082303:web:1f071dce98f0bc30cff4ca"
  };

  let app, auth, db, user = null;
  let unsubSnapshot = null;
  let onDataReceived = null;
  let onAuthChange = null;
  let syncEnabled = false;

  function init(opts = {}) {
    onDataReceived = opts.onDataReceived || null;
    onAuthChange = opts.onAuthChange || null;
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    auth.onAuthStateChanged(handleAuthChange);
  }

  function handleAuthChange(u) {
    user = u;
    if (user) {
      syncEnabled = true;
      listenToCloud();
    } else {
      syncEnabled = false;
      if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null; }
    }
    if (onAuthChange) onAuthChange(user);
  }

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      console.error('Sign-in error:', e);
    }
  }

  async function signOut() {
    await auth.signOut();
  }

  function getUser() { return user; }
  function isSignedIn() { return !!user; }

  // --- Firestore sync ---
  function getUserDocRef() {
    if (!user) return null;
    return db.collection('users').doc(user.uid);
  }

  let _saveTimer = null;

  function saveToCloud(data, positions) {
    if (!syncEnabled || !user) return;
    // Debounce: wait 2s of inactivity before writing
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => _doSaveToCloud(data, positions), 2000);
  }

  async function _doSaveToCloud(data, positions) {
    const ref = getUserDocRef();
    if (!ref) return;
    try {
      const payload = JSON.stringify(data);
      // Firestore doc limit is 1MB; warn if approaching
      if (payload.length > 900000) {
        console.warn('Cloud data approaching 1MB Firestore limit (' + Math.round(payload.length / 1024) + 'KB)');
      }
      if (payload.length > 1048000) {
        console.error('Cloud data exceeds Firestore 1MB limit, skipping save');
        return;
      }
      _pendingWrites += 2; // onSnapshot fires twice per write (local + server)
      await ref.set({
        data: payload,
        positions: positions || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error('Cloud save error:', e);
    }
  }

  async function loadFromCloud() {
    if (!user) return null;
    const ref = getUserDocRef();
    try {
      const doc = await ref.get();
      if (!doc.exists) return null;
      const remote = doc.data();
      if (!remote || !remote.data) return null;
      return { data: JSON.parse(remote.data), positions: remote.positions || null };
    } catch (e) { console.error('Cloud load error:', e); return null; }
  }

  let _pendingWrites = 0;
  let _ignoreNextSnapshot = true;

  function listenToCloud() {
    if (!user) return;
    if (unsubSnapshot) unsubSnapshot();
    _ignoreNextSnapshot = true;
    const ref = getUserDocRef();
    unsubSnapshot = ref.onSnapshot((doc) => {
      if (_ignoreNextSnapshot) { _ignoreNextSnapshot = false; return; }
      if (!doc.exists) return;
      const remote = doc.data();
      if (!remote || !remote.data) return;
      // Skip snapshots from our own writes
      if (_pendingWrites > 0) { _pendingWrites--; return; }
      // Skip unresolved local writes (serverTimestamp pending)
      if (!remote.updatedAt || !remote.updatedAt.toMillis) return;
      try {
        const parsed = JSON.parse(remote.data);
        if (onDataReceived) onDataReceived(parsed, remote.positions || null);
      } catch (e) { console.error('Cloud parse error:', e); }
    });
  }

  return { init, signIn, signOut, getUser, isSignedIn, saveToCloud, loadFromCloud };
})();
