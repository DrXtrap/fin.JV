/**
 * api.js — Mock de API REST
 * App iniciando totalmente vazio
 */

const API = (() => {
  const KEY = 'jv_data_v3';

  // APP COMEÇA VAZIO
  const DEFAULT = {
    receitas: [],
    variaveis: [],
    pontuais: [],
    fixas: [],
    fixasPagas: {},
    metas: [],
    roleta: [],
    dividas: []
  };

  function _mock(method, endpoint, body) {
    if (!Auth.isAuthenticated()) {
      return Promise.reject({ status: 401 });
    }

    return new Promise(resolve => {
      setTimeout(() => {
        let s;

        try {
          s = JSON.parse(localStorage.getItem(KEY)) || { ...DEFAULT };
        } catch {
          s = { ...DEFAULT };
        }

        if (method === 'GET') {
          resolve({
            ok: true,
            data: s
          });
        } else {
          const ns = {
            ...s,
            ...body
          };

          localStorage.setItem(KEY, JSON.stringify(ns));

          resolve({
            ok: true,
            data: ns
          });
        }
      }, 20);
    });
  }

  return {
    async getData() {
      const r = await _mock('GET', '/api/data');

      return {
        ...DEFAULT,
        ...r.data
      };
    },

    async saveModule(k, val) {
      return _mock('PUT', `/api/data/${k}`, {
        [k]: val
      });
    }
  };
})();