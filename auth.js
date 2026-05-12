/**
 * auth.js — Autenticação multi-usuário com localStorage
 */

const AUTH = (() => {
  const USERS_KEY    = 'finjv_users';
  const SESSION_KEY  = 'finjv_session';
  const SECRET       = 'finjv-secret-2025';
  const ADMIN_USER   = 'JV';
  const ADMIN_PASS   = 'Khalifa@127548';

  async function hashPwd(password) {
    const enc  = new TextEncoder();
    const data = enc.encode(password + SECRET);
    const buf  = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  }

  function saveUsers(list) {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  return {
    isAuthenticated() { return !!getSession(); },
    getUser()        { return getSession(); },
    isAdmin()        { return getSession()?.role === 'admin'; },
    getUsername()    { return getSession()?.username || ''; },

    async register(username, password) {
      username = username.trim();
      if (!username || username.length < 2)
        return { ok: false, error: 'O usuário precisa ter pelo menos 2 caracteres.' };
      if (!password || password.length < 6)
        return { ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' };

      const users = getUsers();
      if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
        return { ok: false, error: 'Este nome de usuário já está em uso.' };

      const h    = await hashPwd(password);
      const role = (username === ADMIN_USER && password === ADMIN_PASS) ? 'admin' : 'user';
      users.push({ username, hash: h, role });
      saveUsers(users);
      return { ok: true };
    },

    async login(username, password) {
      username = username.trim();
      const users = getUsers();
      const user  = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) return { ok: false, error: 'Usuário não encontrado.' };

      const h = await hashPwd(password);
      if (user.hash !== h) return { ok: false, error: 'Senha incorreta.' };

      localStorage.setItem(SESSION_KEY, JSON.stringify({
        username: user.username,
        role: user.role
      }));
      return { ok: true };
    },

    logout() {
      localStorage.removeItem(SESSION_KEY);
    }
  };
})();
