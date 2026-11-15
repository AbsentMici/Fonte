(() => {
'use strict';

const KEY = 'fonte.v1';
const IMG = (id, i) => `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/${encodeURIComponent(id)}/${i}.jpg`;

const MUSCLES = {
  abdominals: 'Abdominaux', abductors: 'Abducteurs', adductors: 'Adducteurs', biceps: 'Biceps',
  calves: 'Mollets', chest: 'Pectoraux', forearms: 'Avant-bras', glutes: 'Fessiers',
  hamstrings: 'Ischio-jambiers', lats: 'Dorsaux', 'lower back': 'Lombaires',
  'middle back': 'Milieu du dos', neck: 'Cou', quadriceps: 'Quadriceps', shoulders: 'Épaules',
  traps: 'Trapèzes', triceps: 'Triceps',
};
const EQUIP = {
  barbell: 'Barre', dumbbell: 'Haltères', machine: 'Machine', cable: 'Poulie',
  'body only': 'Poids du corps', kettlebells: 'Kettlebell', bands: 'Élastiques',
  'e-z curl bar': 'Barre EZ', 'exercise ball': 'Swiss ball', 'medicine ball': 'Médecine-ball',
  'foam roll': 'Rouleau', other: 'Autre',
};

/* ---------- Utilitaires ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n > 0 ? n : 0; };
const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const pad = n => String(n).padStart(2, '0');
const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const elapsed = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600); return (h ? h + ':' + pad(Math.floor(s / 60) % 60) : Math.floor(s / 60)) + ':' + pad(s % 60); };
const mins = ms => { const m = Math.max(1, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`; };
const day = t => {
  const d = new Date(t), o = { weekday: 'long', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  const s = d.toLocaleDateString('fr-FR', o);
  return s[0].toUpperCase() + s.slice(1);
};
const opts = (map, sel, all) => (all ? `<option value="">${all}</option>` : '') +
  Object.entries(map).sort((a, b) => a[1].localeCompare(b[1], 'fr'))
    .map(([k, v]) => `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${v}</option>`).join('');

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2200);
}

/* ---------- Données ---------- */
const blank = () => ({ routines: [], workouts: [], active: null, custom: [], rest: 90 });
let S = blank();
try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* données illisibles : on repart de zéro */ }

let saveT;
const saveNow = () => { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { toast('Espace de stockage plein'); } };
const save = saveNow;
const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(saveNow, 400); };
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });

let LIB = [], BYID = new Map();
function index() {
  BYID = new Map();
  for (const x of [...S.custom, ...LIB]) {
    x._n = norm([x.n, ...x.p.map(m => MUSCLES[m] || m), EQUIP[x.e] || x.e].join(' '));
    BYID.set(x.id, x);
  }
}
const ex = id => BYID.get(id) || { id, n: 'Exercice inconnu', e: 'other', p: [], s: [], g: 0, i: [] };
const allEx = () => [...S.custom.filter(x => !x.hidden), ...LIB];
const thumb = x => x.g
  ? `<img class="thumb" loading="lazy" alt="" src="${IMG(x.id, 0)}">`
  : `<div class="thumb ph">${esc(x.n[0] || '?').toUpperCase()}</div>`;
const meta = x => [x.p.map(m => MUSCLES[m] || m).join(', '), EQUIP[x.e] || x.e].filter(Boolean).join(' · ');

function lastSets(exId) {
  for (let i = S.workouts.length - 1; i >= 0; i--) {
    const e = S.workouts[i].exercises.find(e => e.exId === exId);
    if (e) return e.sets;
  }
  return [];
}
const volume = w => w.exercises.reduce((a, e) => a + e.sets.reduce((b, s) => b + s.w * s.r, 0), 0);

/* ---------- Navigation ---------- */
let tab = 'home', stack = [];
const cur = () => stack[stack.length - 1];
const go = p => { stack.push(p); render(); scrollTo(0, 0); };
const curRoutine = () => cur()?.page === 'routine' ? S.routines.find(r => r.id === cur().id) : null;
const ctx = () => curRoutine()?.exercises || S.active?.exercises || [];

function render() {
  const p = cur();
  $('#view').innerHTML = p ? PAGES[p.page](p) : TABS[tab]();
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  if (!p && tab === 'lib') drawList('lib');
  tick();
}
const head = (title, right = '') =>
  `<header class="bar"><button class="ico back" data-a="back" aria-label="Retour">‹</button><h1 class="grow">${esc(title)}</h1>${right}</header>`;

/* ---------- Séance ---------- */
function defaultName() {
  const h = new Date().getHours();
  return h < 12 ? 'Séance du matin' : h < 18 ? "Séance de l'après-midi" : 'Séance du soir';
}
const emptySet = () => ({ w: '', r: '', done: false });
function startWorkout(r) {
  S.active = {
    name: r?.name || defaultName(), start: Date.now(),
    exercises: (r?.exercises || []).map(e => ({ exId: e.exId, sets: Array.from({ length: e.sets }, emptySet) })),
  };
  tab = 'home'; stack = []; save(); render(); scrollTo(0, 0);
}

function moveBtns(i) {
  return `<button class="ico" data-a="mv" data-i="${i}" data-d="-1" aria-label="Monter">↑</button>
    <button class="ico" data-a="mv" data-i="${i}" data-d="1" aria-label="Descendre">↓</button>
    <button class="ico" data-a="rm" data-i="${i}" aria-label="Retirer">✕</button>`;
}
const exLink = x => `<button class="exlink" data-a="open-ex" data-id="${esc(x.id)}">${thumb(x)}<b>${esc(x.n)}</b></button>`;

function activeView() {
  const a = S.active;
  return `<header class="bar">
      <div class="grow"><input class="title-in" data-in="aname" value="${esc(a.name)}" placeholder="Nom de la séance" aria-label="Nom de la séance">
      <div class="sub" id="elapsed"></div></div>
      <button class="btn primary" data-a="finish">Terminer</button>
    </header>
    ${a.exercises.map((e, i) => {
      const x = ex(e.exId), prev = lastSets(e.exId);
      return `<section class="card">
        <div class="exhead">${exLink(x)}${moveBtns(i)}</div>
        <div class="srow shead"><span>Série</span><span>Précédent</span><span>kg</span><span>Reps</span><span></span></div>
        ${e.sets.map((s, j) => {
          const p = prev[j];
          return `<div class="srow${s.done ? ' done' : ''}">
            <span class="sn">${j + 1}</span>
            <span class="prev">${p ? `${fmt(p.w)} kg × ${p.r}` : '—'}</span>
            <input inputmode="decimal" data-in="w" data-i="${i}" data-j="${j}" value="${esc(s.w)}" placeholder="${p ? fmt(p.w) : ''}" aria-label="Poids">
            <input inputmode="numeric" data-in="r" data-i="${i}" data-j="${j}" value="${esc(s.r)}" placeholder="${p ? p.r : ''}" aria-label="Répétitions">
            <button class="chk" data-a="check" data-i="${i}" data-j="${j}" aria-label="Valider la série">✓</button>
          </div>`;
        }).join('')}
        <div class="row">
          <button class="btn small tonal grow" data-a="add-set" data-i="${i}">+ Série</button>
          <button class="btn small ghost" data-a="del-set" data-i="${i}">− Série</button>
        </div>
      </section>`;
    }).join('') || '<p class="empty">Ajoutez un premier exercice pour commencer.</p>'}
    <button class="btn block tonal" data-a="addex">+ Ajouter des exercices</button>
    <button class="btn block danger" data-a="discard">Abandonner la séance</button>`;
}

function finish() {
  const a = S.active;
  const exs = a.exercises
    .map(e => ({ exId: e.exId, sets: e.sets.filter(s => s.done).map(s => ({ w: num(s.w), r: num(s.r) })) }))
    .filter(e => e.sets.length);
  if (!exs.length) {
    if (confirm('Aucune série validée. Abandonner la séance ?')) endActive();
    return;
  }
  if (a.exercises.some(e => e.sets.some(s => !s.done)) && !confirm('Les séries non cochées ne seront pas enregistrées. Terminer ?')) return;
  const w = { id: uid(), name: a.name.trim() || 'Séance', start: a.start, end: Date.now(), exercises: exs };
  S.workouts.push(w);
  S.active = null; rest = null;
  tab = 'hist'; stack = [{ page: 'workout', id: w.id }];
  save(); render(); scrollTo(0, 0);
  toast('Séance enregistrée 💪');
}
function endActive() { S.active = null; rest = null; save(); render(); }

/* ---------- Minuteur de repos ---------- */
let rest = null, ac;
function startRest() {
  if (!S.rest) return;
  rest = { end: Date.now() + S.rest * 1000 };
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); } catch { /* pas de son */ }
  tick();
}
function beep() {
  navigator.vibrate?.(300);
  if (!ac) return;
  [0, 0.25, 0.5].forEach(t => {
    const o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime + t;
    o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.25, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    o.start(t0); o.stop(t0 + 0.2);
  });
}
function tick() {
  const el = $('#elapsed');
  if (el && S.active) el.textContent = elapsed(Date.now() - S.active.start);
  const bar = $('#rest');
  if (rest) {
    const left = rest.end - Date.now();
    if (left <= 0) { if (left > -2000) beep(); rest = null; }
    else $('#rest-t').textContent = clock(left);
  }
  bar.hidden = !rest;
}
setInterval(tick, 500);

/* ---------- Onglets ---------- */
const TABS = {
  home() {
    if (S.active) return activeView();
    return `<h1>Fonte</h1>
      <button class="btn primary block big" data-a="start">Démarrer une séance vide</button>
      <div class="sect"><h2>Routines</h2><button class="btn small tonal" data-a="new-routine">+ Nouvelle</button></div>
      ${S.routines.map(r => `<section class="card">
        <button class="cardlink" data-a="edit-routine" data-id="${r.id}">
          <b>${esc(r.name || 'Routine sans nom')}</b>
          <small>${esc(r.exercises.map(e => ex(e.exId).n).join(', ') || 'Aucun exercice')}</small>
        </button>
        <button class="btn primary block" data-a="start-routine" data-id="${r.id}">Démarrer</button>
      </section>`).join('') || '<p class="empty">Aucune routine pour l\'instant. Créez-en une pour lancer vos séances en un geste.</p>'}`;
  },
  hist() {
    return `<h1>Historique</h1>` + ([...S.workouts].reverse().map(w => `<button class="card cardlink" data-a="open-w" data-id="${w.id}">
        <b>${esc(w.name)}</b>
        <small>${day(w.start)} · ${mins(w.end - w.start)} · ${fmt(volume(w))} kg</small>
        <ul class="mini">${w.exercises.map(e => `<li>${e.sets.length} × ${esc(ex(e.exId).n)}</li>`).join('')}</ul>
      </button>`).join('') || '<p class="empty">Vos séances terminées apparaîtront ici.</p>');
  },
  lib() {
    return `<div class="sect" style="margin-top:8px"><h1 style="margin:0">Exercices</h1><button class="btn small tonal" data-a="new-custom">+ Créer</button></div>${filters('lib')}`;
  },
  set() {
    return `<h1>Réglages</h1>
      <section class="card"><div class="row stepper">
        <span><b>Minuteur de repos</b><small>Démarre quand vous cochez une série</small></span>
        <button data-a="rest-set" data-d="-15" aria-label="Moins">−</button>
        <b>${S.rest ? clock(S.rest * 1000) : 'Off'}</b>
        <button data-a="rest-set" data-d="15" aria-label="Plus">+</button>
      </div></section>
      <section class="card">
        <b>Sauvegarde</b>
        <small>Vos données restent uniquement sur cet appareil. Exportez un fichier de temps en temps pour ne rien perdre.</small>
        <button class="btn tonal block" data-a="export">Exporter mes données</button>
        <button class="btn tonal block" data-a="import">Importer une sauvegarde</button>
      </section>
      <p class="empty">${S.workouts.length} séance${S.workouts.length > 1 ? 's' : ''} enregistrée${S.workouts.length > 1 ? 's' : ''} · ${LIB.length + S.custom.filter(x => !x.hidden).length} exercices<br>
      <small>Exercices et photos : free-exercise-db (domaine public).</small></p>`;
  },
};

/* ---------- Pages ---------- */
const PAGES = {
  routine(p) {
    const r = S.routines.find(r => r.id === p.id);
    if (!r) return head('Routine');
    return head('Routine') + `
      <input class="field" data-in="rname" value="${esc(r.name)}" placeholder="Nom de la routine (ex. Push, Jambes…)" aria-label="Nom de la routine" style="margin-bottom:12px">
      ${r.exercises.map((e, i) => `<section class="card">
        <div class="exhead">${exLink(ex(e.exId))}${moveBtns(i)}</div>
        <div class="row stepper"><span>Séries</span>
          <button data-a="r-sets" data-i="${i}" data-d="-1" aria-label="Moins">−</button><b>${e.sets}</b>
          <button data-a="r-sets" data-i="${i}" data-d="1" aria-label="Plus">+</button></div>
      </section>`).join('') || '<p class="empty">Cette routine est vide.</p>'}
      <button class="btn block tonal" data-a="addex">+ Ajouter des exercices</button>
      ${r.exercises.length ? '<button class="btn block primary" data-a="start-routine" data-id="' + r.id + '">Démarrer cette routine</button>' : ''}
      <button class="btn block danger" data-a="del-routine">Supprimer la routine</button>`;
  },

  workout(p) {
    const w = S.workouts.find(w => w.id === p.id);
    if (!w) return head('Séance');
    return head(w.name) + `
      <p class="sub" style="margin:0 0 14px">${day(w.start)} · ${mins(w.end - w.start)} · ${fmt(volume(w))} kg soulevés</p>
      ${w.exercises.map(e => `<section class="card">
        <div class="exhead">${exLink(ex(e.exId))}</div>
        ${setLines(e.sets)}
      </section>`).join('')}
      <button class="btn block tonal" data-a="w-routine" data-id="${w.id}">Enregistrer comme routine</button>
      <button class="btn block danger" data-a="del-w" data-id="${w.id}">Supprimer la séance</button>`;
  },

  exercise(p) {
    const x = ex(p.id);
    const sess = S.workouts
      .map(w => ({ w, sets: w.exercises.filter(e => e.exId === x.id).flatMap(e => e.sets) }))
      .filter(s => s.sets.length);
    const all = sess.flatMap(s => s.sets);
    const weighted = all.some(s => s.w > 0);
    const maxOf = (arr, f) => arr.reduce((m, v) => Math.max(m, f(v)), 0);
    const stats = !all.length ? '' : weighted
      ? `<div class="stats">
          <div class="stat"><b>${fmt(maxOf(all, s => s.w))} kg</b><small>Charge max</small></div>
          <div class="stat"><b>${fmt(maxOf(all, s => s.w * (1 + s.r / 30)))} kg</b><small>1RM estimé</small></div>
          <div class="stat"><b>${fmt(maxOf(sess, s => s.sets.reduce((a, t) => a + t.w * t.r, 0)))} kg</b><small>Volume max</small></div>
        </div>`
      : `<div class="stats">
          <div class="stat"><b>${maxOf(all, s => s.r)}</b><small>Reps max</small></div>
          <div class="stat"><b>${maxOf(sess, s => s.sets.reduce((a, t) => a + t.r, 0))}</b><small>Reps / séance</small></div>
          <div class="stat"><b>${sess.length}</b><small>Séances</small></div>
        </div>`;
    return head(x.n) + `
      ${x.g ? `<div class="imgs">${Array.from({ length: x.g }, (_, i) => `<img alt="" src="${IMG(x.id, i)}">`).join('')}</div>` : ''}
      <div class="chips">
        ${x.p.map(m => `<span class="chip main">${MUSCLES[m] || esc(m)}</span>`).join('')}
        ${x.s.map(m => `<span class="chip">${MUSCLES[m] || esc(m)}</span>`).join('')}
        <span class="chip">${EQUIP[x.e] || esc(x.e)}</span>
      </div>
      ${stats}
      ${all.length ? `<section class="card"><h2 style="margin-bottom:10px">${weighted ? 'Charge max par séance' : 'Reps max par séance'}</h2>
        ${chart(sess.map(s => maxOf(s.sets, t => weighted ? t.w : t.r)), weighted ? 'kg' : 'reps')}</section>` : ''}
      ${sess.slice(-8).reverse().map(s => `<section class="card"><b>${day(s.w.start)}</b><small style="margin-bottom:6px">${esc(s.w.name)}</small>${setLines(s.sets)}</section>`).join('')
        || '<p class="empty">Pas encore de séance avec cet exercice.</p>'}
      ${x.i.length ? `<section class="card"><h2>Exécution</h2><ol class="steps">${x.i.map(t => `<li>${esc(t)}</li>`).join('')}</ol></section>` : ''}
      ${x.custom ? `<button class="btn block danger" data-a="del-custom" data-id="${esc(x.id)}">Supprimer cet exercice</button>` : ''}`;
  },
};

const setLines = sets => sets.map((s, j) =>
  `<div class="setline"><span>${j + 1}</span><span>${s.w ? fmt(s.w) + ' kg × ' : ''}${s.r}${s.w ? '' : ' reps'}</span></div>`).join('');

function chart(vals, unit) {
  if (vals.length < 2) return '<small>La courbe apparaîtra après deux séances.</small>';
  const W = 300, H = 110, p = 8, mn = Math.min(...vals), mx = Math.max(...vals), sp = mx - mn || 1;
  const pts = vals.map((v, i) => [p + i * (W - 2 * p) / (vals.length - 1), H - p - (v - mn) * (H - 2 * p) / sp].map(n => n.toFixed(1)));
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de progression">
      <polyline points="${pts.map(q => q.join(',')).join(' ')}"/>${pts.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="3"/>`).join('')}</svg>
    <div class="chart-l"><span>${fmt(vals[0])} ${unit}</span><span>${fmt(vals[vals.length - 1])} ${unit}</span></div>`;
}

/* ---------- Bibliothèque et sélecteur ---------- */
const F = { lib: { q: '', m: '', e: '', limit: 80 }, pick: { q: '', m: '', e: '', limit: 80, sel: new Set() } };
let pickCb = null;

function filters(k) {
  const f = F[k];
  return `<div class="filters">
      <input type="search" data-f="q" data-k="${k}" value="${esc(f.q)}" placeholder="Rechercher un exercice" aria-label="Rechercher">
      <div class="row">
        <select data-f="m" data-k="${k}" aria-label="Muscle">${opts(MUSCLES, f.m, 'Tous les muscles')}</select>
        <select data-f="e" data-k="${k}" aria-label="Matériel">${opts(EQUIP, f.e, 'Tout le matériel')}</select>
      </div>
    </div><div id="list-${k}"></div>`;
}
function drawList(k) {
  const f = F[k], box = $('#list-' + k);
  if (!box) return;
  const words = norm(f.q).split(/\s+/).filter(Boolean);
  const res = allEx().filter(x => (!f.m || x.p.includes(f.m)) && (!f.e || x.e === f.e) && words.every(w => x._n.includes(w)));
  box.innerHTML = (res.slice(0, f.limit).map(x =>
    `<button class="exrow${k === 'pick' && f.sel.has(x.id) ? ' sel' : ''}" data-a="exrow" data-k="${k}" data-id="${esc(x.id)}">
      ${thumb(x)}<span><b>${esc(x.n)}</b><small>${esc(meta(x))}</small></span>${k === 'pick' ? '<i>✓</i>' : ''}
    </button>`).join('') || (LIB.length ? '<p class="empty">Aucun exercice trouvé.</p>' : '<p class="empty">Chargement…</p>'))
    + (res.length > f.limit ? `<button class="btn block tonal" data-a="more" data-k="${k}">Afficher plus (${res.length - f.limit})</button>` : '');
}

function openSheet(html) { const s = $('#sheet'); s.innerHTML = `<div class="sheet-in">${html}</div>`; s.hidden = false; s.scrollTop = 0; }
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; pickCb = null; }
const sheetHead = t => `<header class="bar"><button class="ico" data-a="close-sheet" aria-label="Fermer">✕</button><h1 class="grow">${t}</h1></header>`;

function openPicker(cb) {
  Object.assign(F.pick, { q: '', m: '', e: '', limit: 80, sel: new Set() });
  pickCb = cb;
  openSheet(sheetHead('Ajouter des exercices') + filters('pick') +
    '<div class="sheet-foot"><button class="btn primary block" id="pick-ok" data-a="pick-ok" disabled>Ajouter</button></div>');
  drawList('pick');
}

/* ---------- Sauvegarde ---------- */
async function exportData() {
  saveNow();
  const name = `fonte-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
$('#imp').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (!Array.isArray(d.workouts) || !Array.isArray(d.routines)) throw 0;
    if (!confirm(`Remplacer les données actuelles par cette sauvegarde (${d.workouts.length} séances) ?`)) return;
    S = Object.assign(blank(), d); rest = null;
    save(); index(); render(); toast('Sauvegarde importée');
  } catch { alert("Ce fichier n'est pas une sauvegarde Fonte valide."); }
});

/* ---------- Actions ---------- */
const A = {
  tab(d) { tab = d.tab; stack = []; render(); scrollTo(0, 0); },
  back() { stack.pop(); render(); },
  start() { startWorkout(); },
  'start-routine'(d) { startWorkout(S.routines.find(r => r.id === d.id)); },
  finish,
  discard() { if (confirm('Abandonner cette séance ? Rien ne sera enregistré.')) endActive(); },

  check(d, el) {
    const e = S.active.exercises[d.i], s = e.sets[d.j];
    if (s.done) s.done = false;
    else {
      const p = lastSets(e.exId)[d.j];
      if (s.w === '' && p?.w) s.w = fmt(p.w);
      if (s.r === '' && p) s.r = String(p.r);
      if (!num(s.r)) {
        const inp = el.parentElement.querySelector('[data-in="r"]');
        inp.classList.add('bad'); inp.focus();
        return;
      }
      s.done = true;
      startRest();
    }
    save(); render();
  },
  'add-set'(d) {
    const sets = S.active.exercises[d.i].sets, l = sets[sets.length - 1];
    sets.push({ w: l?.w || '', r: l?.r || '', done: false });
    save(); render();
  },
  'del-set'(d) { const sets = S.active.exercises[d.i].sets; if (sets.length > 1) { sets.pop(); save(); render(); } },

  mv(d) {
    const l = ctx(), i = +d.i, j = i + +d.d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]]; save(); render();
  },
  rm(d) {
    const l = ctx(), e = l[d.i];
    if (Array.isArray(e.sets) && e.sets.some(s => s.done) && !confirm('Retirer cet exercice et ses séries validées ?')) return;
    l.splice(+d.i, 1); save(); render();
  },
  addex() {
    const list = ctx(), isRoutine = !!curRoutine();
    openPicker(ids => {
      ids.forEach(id => list.push(isRoutine ? { exId: id, sets: 3 } : { exId: id, sets: [emptySet()] }));
      save(); render();
    });
  },

  'new-routine'() { const r = { id: uid(), name: '', exercises: [] }; S.routines.push(r); save(); go({ page: 'routine', id: r.id }); },
  'edit-routine'(d) { go({ page: 'routine', id: d.id }); },
  'del-routine'() {
    if (!confirm('Supprimer cette routine ?')) return;
    const id = cur().id; S.routines = S.routines.filter(r => r.id !== id);
    stack.pop(); save(); render();
  },
  'r-sets'(d) { const e = ctx()[d.i]; e.sets = Math.min(12, Math.max(1, e.sets + +d.d)); save(); render(); },

  'open-w'(d) { go({ page: 'workout', id: d.id }); },
  'del-w'(d) {
    if (!confirm('Supprimer définitivement cette séance ?')) return;
    S.workouts = S.workouts.filter(w => w.id !== d.id); stack.pop(); save(); render();
  },
  'w-routine'(d) {
    const w = S.workouts.find(w => w.id === d.id);
    S.routines.push({ id: uid(), name: w.name, exercises: w.exercises.map(e => ({ exId: e.exId, sets: e.sets.length })) });
    save(); toast('Routine créée');
  },

  'open-ex'(d) { go({ page: 'exercise', id: d.id }); },
  exrow(d, el) {
    if (d.k === 'lib') return go({ page: 'exercise', id: d.id });
    const sel = F.pick.sel;
    sel.has(d.id) ? sel.delete(d.id) : sel.add(d.id);
    el.classList.toggle('sel', sel.has(d.id));
    const ok = $('#pick-ok');
    ok.disabled = !sel.size; ok.textContent = sel.size ? `Ajouter (${sel.size})` : 'Ajouter';
  },
  more(d) { F[d.k].limit += 80; drawList(d.k); },
  'pick-ok'() { const cb = pickCb, ids = [...F.pick.sel]; closeSheet(); cb?.(ids); },
  'close-sheet': closeSheet,

  'new-custom'() {
    openSheet(sheetHead('Nouvel exercice') + `
      <label class="lab">Nom<input class="field" id="c-name" placeholder="Ex. Développé couché prise serrée"></label>
      <label class="lab">Muscle principal<select class="field" id="c-m">${opts(MUSCLES, 'chest')}</select></label>
      <label class="lab">Matériel<select class="field" id="c-e">${opts(EQUIP, 'barbell')}</select></label>
      <button class="btn primary block" data-a="c-save">Créer l'exercice</button>`);
  },
  'c-save'() {
    const n = $('#c-name').value.trim();
    if (!n) return $('#c-name').focus();
    S.custom.unshift({ id: 'c_' + uid(), n, e: $('#c-e').value, p: [$('#c-m').value], s: [], c: 'strength', g: 0, i: [], custom: true });
    save(); index(); closeSheet(); render(); toast('Exercice créé');
  },
  'del-custom'(d) {
    if (!confirm('Supprimer cet exercice de la bibliothèque ? Votre historique est conservé.')) return;
    ex(d.id).hidden = true; stack.pop(); save(); render();
  },

  'rest-adj'(d) { if (rest) { rest.end += d.d * 1000; tick(); } },
  'rest-skip'() { rest = null; tick(); },
  'rest-set'(d) { S.rest = Math.min(600, Math.max(0, S.rest + +d.d)); save(); render(); },
  export: exportData,
  import() { $('#imp').click(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (el && A[el.dataset.a]) A[el.dataset.a](el.dataset, el);
});
document.addEventListener('input', e => {
  const el = e.target, d = el.dataset;
  if (d.f) { F[d.k][d.f] = el.value; F[d.k].limit = 80; drawList(d.k); return; }
  if (!d.in) return;
  el.classList.remove('bad');
  if (d.in === 'aname') S.active.name = el.value;
  else if (d.in === 'rname') curRoutine().name = el.value;
  else S.active.exercises[d.i].sets[d.j][d.in] = el.value.trim();
  saveSoon();
});

/* ---------- Démarrage ---------- */
index(); render();
fetch('data/exercises.json').then(r => r.json()).then(d => { LIB = d; index(); render(); })
  .catch(() => toast('Bibliothèque indisponible'));
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
