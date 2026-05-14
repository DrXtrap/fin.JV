/**
 * auth.js — Firebase Authentication para Fin.JV
 * Login real, contas persistentes na nuvem.
 * Role (admin/user) lido do Firestore — nunca hardcoded.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCJEn8V1N83_ucbGAiy2lbx6trcdQLYRSI",
  authDomain: "finjv-e5a91.firebaseapp.com",
  projectId: "finjv-e5a91",
  storageBucket: "finjv-e5a91.firebasestorage.app",
  messagingSenderId: "37968334502",
  appId: "1:37968334502:web:d720afab7c6af968816e67"
};

firebase.initializeApp(firebaseConfig);
const _auth = firebase.auth();
const _db = firebase.firestore();

const AUTH = (() => {
  let _profile = null;

  // Converte nome de usuário em e-mail interno (invisível pro usuário)
  function toEmail(username) {
    return `${username.toLowerCase()}@finjv.app`;
  }

  async function loadProfile(user) {
    if (!user) { _profile = null; return; }
    try {
      const snap = await _db.collection('userProfiles').doc(user.uid).get();
      _profile = snap.exists ? snap.data() : null;
    } catch (err) {
      console.error('Erro ao carregar profile:', err);
      _profile = null;
    }
  }

  return {
    isAdmin()    { return _profile?.role === 'admin'; },
    getUsername(){ return _auth.currentUser?.displayName || ''; },
    getUID()     { return _auth.currentUser?.uid || null; },

    async register(username, password) {
      username = username.trim();
      if (!username || username.length < 2)
        return { ok: false, error: 'O usuário precisa ter pelo menos 2 caracteres.' };
      if (!password || password.length < 6)
        return { ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' };

      try {
        const cred = await _auth.createUserWithEmailAndPassword(toEmail(username), password);
        await cred.user.updateProfile({ displayName: username });
        await _db.collection('userProfiles').doc(cred.user.uid).set({
          username,
          role: 'user',
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { ok: true };
      } catch (err) {
        if (err.code === 'auth/email-already-in-use')
          return { ok: false, error: 'Este nome de usuário já está em uso.' };
        return { ok: false, error: 'Erro ao criar conta. Tente novamente.' };
      }
    },

    async login(username, password) {
      username = username.trim();
      try {
        await _auth.signInWithEmailAndPassword(toEmail(username), password);
        return { ok: true };
      } catch (err) {
        if (['auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-email'].includes(err.code))
          return { ok: false, error: 'Usuário não encontrado.' };
        if (err.code === 'auth/wrong-password')
          return { ok: false, error: 'Senha incorreta.' };
        return { ok: false, error: 'Erro ao fazer login. Tente novamente.' };
      }
    },

    async logout() {
      _profile = null;
      await _auth.signOut();
    },

    onAuthChange(callback) {
      return _auth.onAuthStateChanged(async (user) => {
        await loadProfile(user);
        callback(user);
      });
    }
  };
})();