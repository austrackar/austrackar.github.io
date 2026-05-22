let authUser = null;
let authProfile = null;
let authReady = false;
const authListeners = [];

function onAuthReady(cb) {
  if (authReady) { cb(authUser, authProfile); return; }
  authListeners.push(cb);
}

function initAuth() {
  if (typeof firebase === 'undefined' || !FIREBASE_CONFIG) {
    console.warn('Firebase no disponible');
    return;
  }
  if (firebase.apps.length === 0) {
    try { firebase.initializeApp(FIREBASE_CONFIG); } catch (e) { console.warn('Auth init error:', e); return; }
  }
  firebase.auth().onAuthStateChanged(async user => {
    authUser = user;
    if (user) {
      try {
        const snap = await firebase.database().ref('usuarios/' + user.uid).once('value');
        authProfile = snap.val();
      } catch (e) {
        authProfile = null;
      }
    } else {
      authProfile = null;
    }
    authReady = true;
    authListeners.forEach(cb => cb(authUser, authProfile));
    authListeners.length = 0;
  });
}

function login(email, password) {
  return firebase.auth().signInWithEmailAndPassword(email, password);
}

function register(email, password, nombre, empresa, rol) {
  return firebase.auth().createUserWithEmailAndPassword(email, password)
    .then(cred => {
      return firebase.database().ref('usuarios/' + cred.user.uid).set({
        email, nombre, empresa, rol,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      });
    });
}

function logout() {
  return firebase.auth().signOut();
}

function requireAuth() {
  if (!authUser) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function redirectIfLoggedIn() {
  if (authUser && authProfile) {
    window.location.href = 'index.html';
  }
}
