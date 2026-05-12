/**
 * app.js — Fin.JV v4
 * Lógica completa baseada no Fin.JV original, com multi-usuário e roles.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

const BRL = n =>
  'R$ ' + Number(n || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const today   = () => new Date().toISOString().split('T')[0];
const mKey    = d  => d.substring(0, 7);
const fmtDate = d  => d ? d.split('-').reverse().join('/') : '';
const fmtMes  = m  => {
  const [y, mo] = m.split('-');
  const ns = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${ns[+mo - 1]}/${y}`;
};

// ── Storage por usuário ───────────────────────────────────────────────────────

function dataKey() {
  return `finjv_data_${AUTH.getUsername()}`;
}

const DEFAULT_DATA = () => ({
  receitas:   [],
  variaveis:  [],
  fixas:      [],
  fixasPagas: {},
  pontuais:   [],
  metas:      [],
  roleta:     []
});

function ld() {
  try {
    const raw = localStorage.getItem(dataKey());
    return raw ? { ...DEFAULT_DATA(), ...JSON.parse(raw) } : DEFAULT_DATA();
  } catch { return DEFAULT_DATA(); }
}

function sv(data) {
  try { localStorage.setItem(dataKey(), JSON.stringify(data)); } catch {}
}

// ── Estado global ────────────────────────────────────────────────────────────

let D = DEFAULT_DATA();

// ── Inicialização ─────────────────────────────────────────────────────────────

window.addEventListener('load', () => {
  if (AUTH.isAuthenticated()) {
    initApp();
  } else {
    showLogin();
  }
});

function initApp() {
  document.getElementById('screen-auth').style.display = 'none';
  document.getElementById('screen-app').style.display  = 'block';

  D = ld();

  // Chip do usuário
  document.getElementById('user-chip').textContent = AUTH.getUsername();

  // Mostrar Roleta só para admin
  if (AUTH.isAdmin()) {
    document.getElementById('nav-roleta').style.display = 'flex';
  }

  // Preencher nome do usuário no campo Pessoa das Receitas
  const pessoaEl = document.getElementById('rec-pessoa');
  if (pessoaEl) pessoaEl.value = AUTH.getUsername();

  // Datas padrão
  ['rec-date','var-date','rol-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today();
  });

  populateMonths();
  showSection('dashboard');
  renderAll();
}

// ── Autenticação ──────────────────────────────────────────────────────────────

function showLogin() {
  document.getElementById('screen-app').style.display   = 'none';
  document.getElementById('screen-auth').style.display  = 'flex';
  document.getElementById('auth-login').style.display   = 'flex';
  document.getElementById('auth-register').style.display = 'none';
}

function showRegister() {
  document.getElementById('auth-login').style.display    = 'none';
  document.getElementById('auth-register').style.display = 'flex';
  document.getElementById('reg-error').textContent = '';
}

async function handleLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  if (!u || !p) { errEl.textContent = 'Preencha usuário e senha.'; return; }

  const res = await AUTH.login(u, p);
  if (res.ok) {
    initApp();
  } else {
    errEl.textContent = res.error;
  }
}

async function handleRegister() {
  const u = document.getElementById('reg-user').value.trim();
  const p = document.getElementById('reg-pass').value;
  const errEl = document.getElementById('reg-error');
  errEl.textContent = '';

  const res = await AUTH.register(u, p);
  if (res.ok) {
    errEl.style.color = '#1b5e20';
    errEl.textContent = 'Conta criada com sucesso! Faça o login.';
    setTimeout(() => {
      errEl.style.color = '';
      errEl.textContent = '';
      showLogin();
      document.getElementById('login-user').value = u;
    }, 1800);
  } else {
    errEl.textContent = res.error;
  }
}

function handleLogout() {
  AUTH.logout();
  D = DEFAULT_DATA();
  document.getElementById('screen-app').style.display  = 'none';
  document.getElementById('screen-auth').style.display = 'flex';
  showLogin();
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
}

// ── Navegação ─────────────────────────────────────────────────────────────────

function showSection(id) {
  document.querySelectorAll('.section').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const target = document.getElementById('s-' + id);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-section="${id}"]`);
  if (activeNav) activeNav.classList.add('active');
}

// ── Meses ─────────────────────────────────────────────────────────────────────

function allMonths() {
  const s = new Set([
    ...(D.receitas  || []).map(t => mKey(t.date)),
    ...(D.variaveis || []).map(t => mKey(t.date)),
    ...(D.roleta    || []).map(t => mKey(t.date))
  ]);
  s.add(mKey(today()));
  return Array.from(s).sort().reverse();
}

function populateMonths() {
  const ms  = allMonths();
  const el  = document.getElementById('global-month');
  const cur = el ? el.value : '';
  el.innerHTML = ms.map(m =>
    `<option value="${m}"${m === cur ? ' selected' : ''}>${fmtMes(m)}</option>`
  ).join('');
}

function getM()          { return document.getElementById('global-month').value || mKey(today()); }
function onMonthChange() { renderAll(); }

// ── Renderização geral ────────────────────────────────────────────────────────

function renderAll() {
  renderDash();
  renderReceitas();
  renderFixas();
  renderVarList();
  renderPontuais();
  renderGoals();
  if (AUTH.isAdmin()) renderRoleta();
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

function renderDash() {
  const m    = getM();
  const recs = txM(D.receitas,  m).reduce((s, t) => s + t.val, 0);
  const vars = txM(D.variaveis, m).reduce((s, t) => s + t.val, 0);
  const fixT = (D.fixas || []).reduce((s, f) => s + f.val, 0);
  const saldo = recs - fixT - vars;

  document.getElementById('dash-metrics').innerHTML = `
    <div class="metric">
      <div class="mlabel">Receitas</div>
      <div class="mval green">${BRL(recs)}</div>
    </div>
    <div class="metric">
      <div class="mlabel">Despesas</div>
      <div class="mval red">${BRL(fixT + vars)}</div>
    </div>
    <div class="metric">
      <div class="mlabel">Saldo</div>
      <div class="mval ${saldo >= 0 ? 'gold' : 'red'}">${BRL(saldo)}</div>
    </div>`;

  // Checklist fixas no dashboard
  const fp  = D.fixasPagas[m] || {};
  const fixEl = document.getElementById('dash-fixas');
  if (!D.fixas.length) {
    fixEl.innerHTML = '<p class="empty-msg">Nenhuma conta fixa cadastrada.</p>';
  } else {
    fixEl.innerHTML = D.fixas.map(f => checkItem(f, fp[f.id], m)).join('');
  }

  // Últimos lançamentos
  const recent = [
    ...txM(D.receitas,  m).map(t => ({ ...t, tp: 'r' })),
    ...txM(D.variaveis, m).map(t => ({ ...t, tp: 'd' }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const el = document.getElementById('dash-recent');
  if (!recent.length) {
    el.innerHTML = '<li class="tx-item"><span class="empty-msg" style="padding:16px 0;">Nenhum lançamento neste mês.</span></li>';
    return;
  }
  el.innerHTML = recent.map(t => `
    <li class="tx-item">
      <div class="tx-left">
        <span class="tx-name">${t.desc}</span>
        <span class="tx-meta">${t.cat || ''}${t.cat ? ' · ' : ''}${fmtDate(t.date)}</span>
      </div>
      <div class="tx-right">
        <span class="tx-val ${t.tp === 'r' ? 'pos' : 'neg'}">
          ${t.tp === 'r' ? '+' : '-'}${BRL(t.val)}
        </span>
      </div>
    </li>`).join('');
}

// ── FIXAS ─────────────────────────────────────────────────────────────────────

function checkItem(f, pago, m) {
  return `
    <div class="check-item">
      <div class="check-left">
        <div class="check-box ${pago ? 'checked' : ''}"
             onclick="toggleFixa('${f.id}','${m}',${!pago})"></div>
        <span class="check-name ${pago ? 'done' : ''}">${f.nome}</span>
      </div>
      <span class="check-val">${BRL(f.val)}</span>
    </div>`;
}

function renderFixas() {
  const m  = getM();
  const fp = D.fixasPagas[m] || {};

  // Checklist na aba Fixas
  const checkEl = document.getElementById('fixas-check');
  if (!D.fixas.length) {
    checkEl.innerHTML = '<p class="empty-msg">Adicione suas contas fixas abaixo.</p>';
  } else {
    checkEl.innerHTML = D.fixas.map(f => checkItem(f, fp[f.id], m)).join('');
  }

  // Lista gerenciamento
  const listEl = document.getElementById('fix-list');
  if (!D.fixas.length) {
    listEl.innerHTML = '';
    return;
  }
  listEl.innerHTML = D.fixas.map(f => `
    <li class="tx-item">
      <div class="tx-left">
        <span class="tx-name">${f.nome}</span>
        <span class="tx-meta">Recorrente todo mês</span>
      </div>
      <div class="tx-right">
        <span class="tx-val">${BRL(f.val)}</span>
        <button class="delbtn" onclick="delFixa('${f.id}')">×</button>
      </div>
    </li>`).join('');
}

function toggleFixa(fid, m, val) {
  if (!D.fixasPagas[m]) D.fixasPagas[m] = {};
  D.fixasPagas[m][fid] = val;
  sv(D);
  renderFixas();
  renderDash();
}

function addFixa() {
  const n = document.getElementById('fix-nome').value.trim();
  const v = parseFloat(document.getElementById('fix-val').value);
  if (!n || isNaN(v) || v <= 0) return;

  D.fixas.push({ id: Date.now().toString(), nome: n, val: v });
  sv(D);
  document.getElementById('fix-nome').value = '';
  document.getElementById('fix-val').value  = '';
  renderFixas();
  renderDash();
}

function delFixa(id) {
  if (!confirm('Remover esta conta fixa?')) return;
  D.fixas = D.fixas.filter(f => f.id !== id);
  sv(D);
  renderFixas();
  renderDash();
}

// ── RECEITAS ──────────────────────────────────────────────────────────────────

function txM(arr, m) { return (arr || []).filter(t => mKey(t.date) === m); }

function renderReceitas() {
  const m    = getM();
  const list = txM(D.receitas, m);
  const total = list.reduce((s, t) => s + t.val, 0);

  document.getElementById('rec-metrics').innerHTML = `
    <div class="metric">
      <div class="mlabel">Total do mês</div>
      <div class="mval green">${BRL(total)}</div>
    </div>
    <div class="metric">
      <div class="mlabel">Lançamentos</div>
      <div class="mval blue">${list.length}</div>
    </div>
    <div class="metric">
      <div class="mlabel">Média</div>
      <div class="mval gold">${BRL(list.length ? total / list.length : 0)}</div>
    </div>`;

  const el     = document.getElementById('rec-list');
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    el.innerHTML = '<li class="tx-item"><span class="empty-msg" style="padding:16px 0;">Nenhuma receita neste mês.</span></li>';
    return;
  }
  el.innerHTML = sorted.map(t => `
    <li class="tx-item">
      <div class="tx-left">
        <span class="tx-name">${t.desc}</span>
        <span class="tx-meta">${t.pessoa} · ${t.cat} · ${fmtDate(t.date)}</span>
      </div>
      <div class="tx-right">
        <span class="tx-val pos">+${BRL(t.val)}</span>
        <button class="delbtn" onclick="delRec('${t.id}')">×</button>
      </div>
    </li>`).join('');
}

function addReceita() {
  const d  = document.getElementById('rec-desc').value.trim();
  const v  = parseFloat(document.getElementById('rec-val').value);
  const p  = document.getElementById('rec-pessoa').value.trim() || AUTH.getUsername();
  const c  = document.getElementById('rec-cat').value;
  const dt = document.getElementById('rec-date').value;
  if (!d || isNaN(v) || v <= 0 || !dt) return;

  D.receitas.push({ id: Date.now().toString(), desc: d, val: v, pessoa: p, cat: c, date: dt });
  sv(D);
  document.getElementById('rec-desc').value = '';
  document.getElementById('rec-val').value  = '';
  renderReceitas();
  renderDash();
  populateMonths();
}

function delRec(id) {
  if (!confirm('Excluir esta receita?')) return;
  D.receitas = D.receitas.filter(t => t.id !== id);
  sv(D);
  renderReceitas();
  renderDash();
}

// ── VARIÁVEIS ─────────────────────────────────────────────────────────────────

function renderVarList() {
  const m    = getM();
  const list = txM(D.variaveis, m);
  const total = list.reduce((s, t) => s + t.val, 0);

  document.getElementById('var-total').textContent = BRL(total);

  const el     = document.getElementById('var-list');
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    el.innerHTML = '<li class="tx-item"><span class="empty-msg" style="padding:16px 0;">Nenhum gasto variável neste mês.</span></li>';
    return;
  }
  el.innerHTML = sorted.map(t => `
    <li class="tx-item">
      <div class="tx-left">
        <span class="tx-name">${t.desc}</span>
        <span class="tx-meta">${t.cat} · ${fmtDate(t.date)}</span>
      </div>
      <div class="tx-right">
        <span class="tx-val neg">-${BRL(t.val)}</span>
        <button class="delbtn" onclick="delVar('${t.id}')">×</button>
      </div>
    </li>`).join('');
}

function addVar() {
  const d  = document.getElementById('var-desc').value.trim();
  const v  = parseFloat(document.getElementById('var-val').value);
  const c  = document.getElementById('var-cat').value;
  const dt = document.getElementById('var-date').value;
  if (!d || isNaN(v) || v <= 0 || !dt) return;

  D.variaveis.push({ id: Date.now().toString(), desc: d, val: v, cat: c, date: dt });
  sv(D);
  document.getElementById('var-desc').value = '';
  document.getElementById('var-val').value  = '';
  renderVarList();
  renderDash();
  populateMonths();
}

function delVar(id) {
  if (!confirm('Excluir este gasto?')) return;
  D.variaveis = D.variaveis.filter(t => t.id !== id);
  sv(D);
  renderVarList();
  renderDash();
}

// ── PONTUAIS / DÍVIDAS ────────────────────────────────────────────────────────

function renderPontuais() {
  const el = document.getElementById('pont-list');
  if (!D.pontuais.length) {
    el.innerHTML = '<p class="empty-msg">Nenhuma dívida ou gasto pontual cadastrado.</p>';
    return;
  }
  el.innerHTML = D.pontuais.map(p => {
    const range = p.valMax ? `${BRL(p.valMin)} — ${BRL(p.valMax)}` : BRL(p.valMin);
    return `
      <div class="pontual-item">
        <div class="pontual-left">
          <div class="pontual-name">${p.desc}</div>
          <div class="pontual-range">${range}</div>
        </div>
        <div class="pontual-right">
          <span class="status-pill ${p.status === 'pago' ? 'sp-pago' : 'sp-pend'}"
                onclick="togglePontual('${p.id}')">
            ${p.status === 'pago' ? 'Pago' : 'Pendente'}
          </span>
          <button class="delbtn" onclick="delPontual('${p.id}')">×</button>
        </div>
      </div>`;
  }).join('');
}

function addPontual() {
  const d   = document.getElementById('pont-desc').value.trim();
  const mn  = parseFloat(document.getElementById('pont-val-min').value);
  const mxR = document.getElementById('pont-val-max').value;
  const mx  = mxR && !isNaN(parseFloat(mxR)) ? parseFloat(mxR) : null;
  const st  = document.getElementById('pont-status').value;
  if (!d || isNaN(mn) || mn <= 0) return;

  D.pontuais.push({ id: Date.now().toString(), desc: d, valMin: mn, valMax: mx, status: st });
  sv(D);
  document.getElementById('pont-desc').value    = '';
  document.getElementById('pont-val-min').value = '';
  document.getElementById('pont-val-max').value = '';
  document.getElementById('pont-status').value  = 'pendente';
  renderPontuais();
}

function togglePontual(id) {
  const p = D.pontuais.find(p => p.id === id);
  if (p) p.status = p.status === 'pago' ? 'pendente' : 'pago';
  sv(D);
  renderPontuais();
}

function delPontual(id) {
  if (!confirm('Remover este item?')) return;
  D.pontuais = D.pontuais.filter(p => p.id !== id);
  sv(D);
  renderPontuais();
}

// ── METAS ─────────────────────────────────────────────────────────────────────

function renderGoals() {
  const el = document.getElementById('goals-list');
  if (!D.metas.length) {
    el.innerHTML = '<p class="empty-msg">Nenhuma meta cadastrada.</p>';
    return;
  }
  el.innerHTML = D.metas.map(g => {
    const pct   = Math.min(100, Math.round((g.saved / g.total) * 100));
    const cls   = pct < 40 ? 'low' : pct < 75 ? 'mid' : 'high';
    const prazo = g.date ? `até ${fmtDate(g.date)} · ` : '';
    return `
      <div class="goal-item">
        <div class="goal-info">
          <div class="goal-name">${g.name}</div>
          <div class="goal-sub">${prazo}${BRL(g.saved)} de ${BRL(g.total)}</div>
          <div class="bar-wrap">
            <div class="bar-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="goal-pct">${pct}%</div>
        <button class="delbtn" onclick="delGoal('${g.id}')">×</button>
      </div>`;
  }).join('');
}

function addGoal() {
  const n  = document.getElementById('goal-name').value.trim();
  const t  = parseFloat(document.getElementById('goal-total').value);
  const s  = parseFloat(document.getElementById('goal-saved').value) || 0;
  const d  = document.getElementById('goal-date').value;
  if (!n || isNaN(t) || t <= 0) return;

  D.metas.push({ id: Date.now().toString(), name: n, total: t, saved: s, date: d });
  sv(D);
  document.getElementById('goal-name').value  = '';
  document.getElementById('goal-total').value = '';
  document.getElementById('goal-saved').value = '';
  document.getElementById('goal-date').value  = '';
  renderGoals();
}

function delGoal(id) {
  if (!confirm('Remover esta meta?')) return;
  D.metas = D.metas.filter(g => g.id !== id);
  sv(D);
  renderGoals();
}

// ── ROLETA (admin) ────────────────────────────────────────────────────────────

function renderRoleta() {
  const m    = getM();
  const list = txM(D.roleta, m);
  const enT  = list.reduce((s, r) => s + r.entrada, 0);
  const saT  = list.reduce((s, r) => s + r.saida, 0);
  const lucro = saT - enT;
  const bateu = list.filter(r => r.meta === 'bateu').length;

  document.getElementById('rol-stats').innerHTML = `
    <div class="r-stat">
      <div class="rl">Entrada total</div>
      <div class="rv red">${BRL(enT)}</div>
    </div>
    <div class="r-stat">
      <div class="rl">Saída total</div>
      <div class="rv green">${BRL(saT)}</div>
    </div>
    <div class="r-stat">
      <div class="rl">Resultado</div>
      <div class="rv ${lucro >= 0 ? 'green' : 'red'}">${BRL(lucro)}</div>
    </div>
    <div class="r-stat">
      <div class="rl">Metas batidas</div>
      <div class="rv">${bateu} / ${list.length}</div>
    </div>`;

  const el     = document.getElementById('rol-list');
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    el.innerHTML = '<li class="tx-item"><span class="empty-msg" style="padding:16px 0;">Nenhuma sessão registrada neste mês.</span></li>';
    return;
  }
  el.innerHTML = sorted.map(r => {
    const tc = r.meta === 'bateu' ? 'g' : r.meta === 'stop' ? 'r' : 'a';
    const tl = r.meta === 'bateu' ? 'Meta ok' : r.meta === 'stop' ? 'Stop' : 'Não bateu';
    const res = r.saida - r.entrada;
    return `
      <li class="tx-item">
        <div class="tx-left">
          <span class="tx-name">${fmtDate(r.date)}${r.obs ? ' — ' + r.obs : ''}</span>
          <span class="tx-meta">Entrada ${BRL(r.entrada)} → Saída ${BRL(r.saida)}</span>
        </div>
        <div class="tx-right">
          <span class="tag ${tc}">${tl}</span>
          <span class="tx-val ${res >= 0 ? 'pos' : 'neg'}">${res >= 0 ? '+' : ''}${BRL(res)}</span>
          <button class="delbtn" onclick="delRol('${r.id}')">×</button>
        </div>
      </li>`;
  }).join('');
}

function addRoleta() {
  const d  = document.getElementById('rol-date').value;
  const en = parseFloat(document.getElementById('rol-entrada').value) || 0;
  const sa = parseFloat(document.getElementById('rol-saida').value)   || 0;
  const mt = document.getElementById('rol-meta').value;
  const ob = document.getElementById('rol-obs').value.trim();
  if (!d) return;

  D.roleta.push({ id: Date.now().toString(), date: d, entrada: en, saida: sa, meta: mt, obs: ob });
  sv(D);
  document.getElementById('rol-entrada').value = '';
  document.getElementById('rol-saida').value   = '';
  document.getElementById('rol-obs').value     = '';
  renderRoleta();
  populateMonths();
}

function delRol(id) {
  if (!confirm('Excluir esta sessão?')) return;
  D.roleta = D.roleta.filter(r => r.id !== id);
  sv(D);
  renderRoleta();
}

// ── RESUMO PARA IA ─────────────────────────────────────────────────────────────

function gerarResumo() {
  const m    = getM();
  const recs = txM(D.receitas,  m);
  const vars = txM(D.variaveis, m);
  const fixT = D.fixas.reduce((s, f) => s + f.val, 0);
  const recT = recs.reduce((s, t) => s + t.val, 0);
  const varT = vars.reduce((s, t) => s + t.val, 0);
  const saldo = recT - fixT - varT;
  const fp    = D.fixasPagas[m] || {};
  const fpCount = Object.values(fp).filter(Boolean).length;
  const rolM  = AUTH.isAdmin() ? txM(D.roleta, m) : [];
  const rolRes = rolM.reduce((s, r) => s + (r.saida - r.entrada), 0);
  const pontPend = D.pontuais.filter(p => p.status === 'pendente');

  let txt = `=== RESUMO FINANCEIRO — ${fmtMes(m)} ===\nUsuário: ${AUTH.getUsername()}\n\n`;

  txt += `RECEITAS DO MÊS\n`;
  if (recs.length) {
    recs.forEach(r => { txt += `  ${r.pessoa} · ${r.cat}: ${BRL(r.val)}\n`; });
  } else { txt += `  Nenhuma receita lançada\n`; }
  txt += `  TOTAL: ${BRL(recT)}\n\n`;

  txt += `CONTAS FIXAS (${fpCount}/${D.fixas.length} pagas)\n`;
  if (D.fixas.length) {
    D.fixas.forEach(f => {
      txt += `  ${fp[f.id] ? '[PAGO]    ' : '[PENDENTE]'} ${f.nome}: ${BRL(f.val)}\n`;
    });
    txt += `  TOTAL: ${BRL(fixT)}\n\n`;
  } else { txt += `  Nenhuma conta fixa cadastrada\n\n`; }

  txt += `GASTOS VARIÁVEIS\n`;
  if (vars.length) {
    vars.forEach(v => { txt += `  ${v.cat} · ${v.desc}: ${BRL(v.val)}\n`; });
    txt += `  TOTAL: ${BRL(varT)}\n\n`;
  } else { txt += `  Nenhum gasto variável lançado\n\n`; }

  txt += `SALDO DO MÊS: ${BRL(saldo)}\n\n`;

  if (pontPend.length) {
    txt += `DÍVIDAS / GASTOS PENDENTES\n`;
    pontPend.forEach(p => {
      txt += `  ${p.desc}: ${BRL(p.valMin)}${p.valMax ? ' — ' + BRL(p.valMax) : ''}\n`;
    });
    txt += '\n';
  }

  if (D.metas.length) {
    txt += `METAS FINANCEIRAS\n`;
    D.metas.forEach(g => {
      const pct = Math.round((g.saved / g.total) * 100);
      txt += `  ${g.name}: ${BRL(g.saved)} / ${BRL(g.total)} (${pct}%)\n`;
    });
    txt += '\n';
  }

  if (rolM.length) {
    txt += `ROLETA — ${rolM.length} sessões · Resultado: ${BRL(rolRes)}\n\n`;
  }

  document.getElementById('resumo-text').textContent = txt;
  document.getElementById('resumo-box').style.display = 'block';
}

function copiarResumo() {
  const txt = document.getElementById('resumo-text').textContent;
  navigator.clipboard.writeText(txt).then(() => {
    const b = document.getElementById('copy-btn-text');
    const orig = b.innerHTML;
    b.innerHTML = '<i class="fas fa-check"></i> Copiado!';
    setTimeout(() => { b.innerHTML = orig; }, 2000);
  });
}
