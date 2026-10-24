import { PREFECTURES, REGIONS, MAX_COUNT, STORAGE_KEY } from './data.js';
import { emptyState, parseState, summarize, setPrefectureCount, validCount, validMultiplier, format } from './model.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const icons = {
  route: '<path d="m3 20 6-16 6 12 6-12M3 20l12-4"/><circle cx="21" cy="4" r="2"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  edit: '<path d="m15 4 5 5M5 15 16 4a2 2 0 0 1 3 3L8 18l-5 2 2-5Z"/><path d="M12 21h9"/>',
  sliders: '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6 6-2Z"/>',
  'arrow-up-right': '<path d="M6 18 18 6M6 6h12v12"/>',
  'arrow-right': '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  pointer: '<path d="m4 3 6 17 3-7 7-3L4 3Zm9 10 6 6"/>',
  luggage: '<rect x="5" y="6" width="14" height="14" rx="2"/><path d="M9 6V3h6v3M8 10v6m8-6v6M8 20v2m8-2v2M10 6v14m4-14v14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`; }
function renderIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }
renderIcons();

let state = emptyState();
let storageIssue = false;
let toastTimer;
let mapMetric = 'score';
let currentPref = null;
let mapData = [];
let zoom = 1;
let pickerZoom = 1;
let pickerPrefectureId = null;
let confirmCallback = null;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3600);
}
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    state = parseState(saved);
    if (JSON.parse(saved).version !== state.version) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
} catch {
  storageIssue = true;
  toast('保存済みの記録を読み込めませんでした。設定からバックアップを読み込めます。');
}

function persist() {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    storageIssue = false;
    updateSaveStatus();
    return true;
  } catch {
    storageIssue = true;
    updateSaveStatus();
    toast('ブラウザに保存できません。設定から記録を書き出して保管してください。');
    return false;
  }
}
function updateSaveStatus() {
  const el = $('#save-status');
  el.classList.toggle('error', storageIssue);
  el.innerHTML = `<i></i>${storageIssue ? '保存を確認できません · バックアップ推奨' : 'このブラウザに自動保存'}`;
}

function updateUI() {
  const summary = summarize(state);
  $('#total-score').textContent = format(summary.score);
  $('#total-score').style.fontSize = summary.score >= 100000 ? '42px' : summary.score >= 10000 ? '52px' : '';
  $('#visited-count').textContent = summary.visited;
  $('#visit-count').textContent = format(summary.visits);
  $('#remaining-count').textContent = 47 - summary.visited;
  $('#completion-rate').textContent = `${Math.round(summary.visited / 47 * 100)}%`;
  $('#national-progress').setAttribute('aria-valuenow', summary.visited);
  $('#national-progress > span').style.width = `${summary.visited / 47 * 100}%`;
  $('#record-visited').textContent = summary.visited;
  $('#record-total').textContent = format(summary.visits);
  $('#journey-message').textContent = summary.visited === 47 ? '47の景色に、出会えた。' : summary.visited ? '旅のつづきを、記録しよう。' : '次の旅は、どこへ？';
  $('#journey-description').innerHTML = summary.visited === 47 ? '全国制覇、おめでとうございます。<br>何度訪れても、きっと新しい出会いが。' : summary.visited ? `あと${47 - summary.visited}の場所に、まだ見ぬ景色。<br>何度でも、好きな街へ。` : '小さな寄り道も、旅の足あと。<br>最初のひとつを記録してみましょう。';
  $('#region-grid').innerHTML = summary.regions.map(r => `<a class="region-card" href="#record/${r.id}"><div class="region-card-top"><h3>${r.name}</h3><span>${r.visited} / ${r.ids.length} 訪問済み</span></div><p class="eyebrow">${r.en}</p><div class="region-card-bottom"><span><strong>${format(r.visits)}</strong>回</span><span>×${format(r.multiplier)} → ${format(r.score)} pt</span></div><div class="progress-track"><span style="width:${r.visited / r.ids.length * 100}%"></span></div></a>`).join('');
  updateMapValues();
  renderHistory();
  updateEntryPreview();
  updateSaveStatus();
}

function populateEntryForm() {
  $('#history-prefecture').insertAdjacentHTML('beforeend', REGIONS.map(r => `<option value="${r.id}">${r.name}</option>`).join(''));
}
function selectEntryPrefecture(id) {
  const pref = PREFECTURES.find(p => p.id === id);
  $('#visit-prefecture').value = pref ? pref.id : '';
  $('#selected-prefecture').textContent = pref ? `${pref.name}（${REGIONS.find(r => r.id === pref.region).name}）` : '都道府県が選択されていません';
  $('#selected-prefecture').classList.toggle('has-selection', Boolean(pref));
  $('#visit-count-input').value = pref ? state.counts[pref.id] : 0;
  updateEntryPreview();
}
function updateEntryPreview() {
  const id = Number($('#visit-prefecture').value);
  const pref = PREFECTURES.find(p => p.id === id);
  const count = $('#visit-count-input').valueAsNumber;
  const valid = validCount(count);
  $('#count-minus').disabled = !valid || count === 0;
  $('#count-plus').disabled = !valid || count === MAX_COUNT;
  $('#save-visit').disabled = !pref || !valid;
  $$('[data-count-preset]').forEach(button => {
    const active = valid && Number(button.dataset.countPreset) === count;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
  if (!pref || !valid) {
    $('#entry-score').textContent = '—';
    $('#entry-formula').textContent = !pref ? '地図から都道府県を選択してください' : `0〜${format(MAX_COUNT)}回の整数で指定してください`;
    return;
  }
  const multiplier = state.multipliers[pref.region];
  $('#entry-score').textContent = `${format(Math.round(count * multiplier * 100) / 100)} pt`;
  $('#entry-formula').textContent = `${format(count)}回 × ${REGIONS.find(r => r.id === pref.region).name} ${format(multiplier)}倍`;
}
$('#visit-count-input').addEventListener('input', updateEntryPreview);
$('#count-minus').addEventListener('click', () => { $('#visit-count-input').value = Math.max(0, $('#visit-count-input').valueAsNumber - 1); updateEntryPreview(); });
$('#count-plus').addEventListener('click', () => { $('#visit-count-input').value = Math.min(MAX_COUNT, $('#visit-count-input').valueAsNumber + 1); updateEntryPreview(); });
$$('[data-count-preset]').forEach(button => button.addEventListener('click', () => { $('#visit-count-input').value = button.dataset.countPreset; updateEntryPreview(); }));
$('#visit-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!$('#visit-form').reportValidity()) return;
  try {
    const id = Number($('#visit-prefecture').value);
    const count = $('#visit-count-input').valueAsNumber;
    setPrefectureCount(state, id, count);
    persist(); updateUI();
    if (!storageIssue) toast(`${PREFECTURES[id - 1].name}の累計回数を${format(count)}回に更新しました。`);
  } catch (error) { toast(error.message); }
});
function resetEntry() {
  $('#visit-form').reset(); selectEntryPrefecture(null);
}
function renderHistory() {
  const region = $('#history-prefecture').value;
  const onlyVisited = $('#visited-only').checked;
  const prefs = summarize(state).prefectures.filter(p => (region === 'all' || p.region === region) && (!onlyVisited || p.visits > 0));
  $('#history-count').textContent = `${prefs.length}都道府県`;
  if (!prefs.length) {
    $('#visit-history').innerHTML = `<div class="history-empty">${icon('map')}<h3>条件に合う都道府県がありません</h3><p>地方や「訪問済みのみ」の条件を変えてください。</p></div>`;
    return;
  }
  $('#visit-history').innerHTML = `<div class="history-table-wrap"><table class="history-table"><thead><tr><th scope="col">都道府県</th><th scope="col">地方</th><th scope="col">行った回数</th><th scope="col">得点</th></tr></thead><tbody>${prefs.map(p => `<tr><td>${p.name}</td><td>${REGIONS.find(r => r.id === p.region).name}</td><td><strong>${format(p.visits)}</strong> 回</td><td><strong>${format(p.score)}</strong> pt<small>${format(p.visits)}回 × ${format(state.multipliers[p.region])}倍</small></td></tr>`).join('')}</tbody></table></div>`;
}
$('#history-prefecture').addEventListener('change', renderHistory);
$('#visited-only').addEventListener('change', renderHistory);

function route() {
  const parts = location.hash.slice(1).split('/');
  const recording = parts[0] === 'record';
  $('#map-view').hidden = recording;
  $('#record-view').hidden = !recording;
  $$('[data-view]').forEach(el => {
    const active = el.dataset.view === (recording ? 'record' : 'map');
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  $('#page-title').textContent = recording ? '地図を選んで、回数を記録。' : '旅の足あとを、日本地図に。';
  $('#page-subtitle').textContent = recording ? '行った場所と、行った回数。あなたの旅をシンプルに。' : '訪れた場所も、何度も通った街も。あなたの旅を、ひとつずつ。';
  if (recording && REGIONS.some(r => r.id === parts[1])) {
    $('#history-prefecture').value = parts[1]; renderHistory();
  }
}
window.addEventListener('hashchange', route);

// The supplied CC0 vector is bundled locally. No third-party map API, tracking,
// or network request is required to draw the prefectures.
async function loadMap() {
  try {
    const response = await fetch('./assets/map-data.json');
    if (!response.ok) throw new Error('Map unavailable');
    mapData = await response.json();
    renderPrefecturePicker();
    const paths = mapData.map(p => {
      const transform = p.id === 47 ? 'transform="translate(390,-1050)"' : '';
      const x = p.x + (p.id === 47 ? 390 : 0);
      const y = p.y - (p.id === 47 ? 1050 : 0);
      const shortName = p.name === '北海道' ? p.name : p.name.replace(/[都府県]$/, '');
      return `<g class="pref-target" data-map-id="${p.id}" role="button" tabindex="0" aria-label="${p.name}の来訪結果を確認"><title>${p.name}</title><path class="pref-shape" d="${p.d}" ${transform}/><text class="pref-label" data-label-id="${p.id}" x="${x}" y="${y}"><tspan class="pref-name" x="${x}" dy="-12">${shortName}</tspan><tspan class="pref-number" x="${x}" dy="43">0</tspan></text></g>`;
    }).join('');
    $('#map-stage').innerHTML = `<svg class="japan-map" id="japan-map" xmlns="http://www.w3.org/2000/svg" viewBox="-90 -80 2180 2080" aria-label="47都道府県の来訪回数マップ"><g class="map-flourish"><text class="map-small" x="180" y="180">A JOURNEY OF YOUR OWN</text><text class="map-caption" x="180" y="272">ひとつの旅、</text><text class="map-caption" x="180" y="340">ひとつの足あと。</text><path d="M220 443c100-90 220 90 330-10s180-110 260-60" stroke="#d9ddcc" fill="none" stroke-width="3" stroke-dasharray="7 12"/><circle cx="220" cy="443" r="8" stroke="#b4bea2" fill="none" stroke-width="3"/><circle cx="810" cy="373" r="8" fill="#b4bea2"/><path d="M320 755H560V1010H320" stroke="#dce0d1" stroke-width="2" fill="none" stroke-dasharray="6 9"/><text class="map-small" x="350" y="1065">OKINAWA</text><g transform="translate(1850 750)"><path d="m0-65 17 65H-17Z" fill="#a5ae98"/><path d="m0 65 17-65H-17Z" fill="#e3e6d8"/><text class="map-small" x="-8" y="-90">N</text></g></g><g id="map-prefectures">${paths}</g></svg>`;
    updateMapValues();
    $('#map-stage').addEventListener('click', event => {
      const pref = event.target.closest('[data-map-id]');
      if (pref) openPref(Number(pref.dataset.mapId));
    });
    $('#map-stage').addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const pref = event.target.closest('[data-map-id]');
      if (pref) { event.preventDefault(); openPref(Number(pref.dataset.mapId)); }
    });
    $('#download-map').disabled = false;
  } catch {
    $('#open-prefecture-picker').disabled = true;
    $('#prefecture-picker-hint').textContent = '地図を読み込めませんでした。ページを再読み込みしてください。';
    $('#map-stage').innerHTML = '<div class="map-loading">地図を読み込めませんでした。<a href="#record">一覧から記録する →</a></div>';
    $('#download-map').disabled = true;
    $('#zoom-in').disabled = true;
    $('#zoom-out').disabled = true;
  }
}
function renderPrefecturePicker() {
  const shapes = mapData.map(p => {
    const transform = p.id === 47 ? 'transform="translate(390,-1050)"' : '';
    const x = p.x + (p.id === 47 ? 390 : 0);
    const y = p.y - (p.id === 47 ? 1050 : 0);
    const name = p.name === '北海道' ? p.name : p.name.replace(/[都府県]$/, '');
    return `<g class="picker-prefecture" data-pick-prefecture="${p.id}" role="button" tabindex="0" aria-label="${p.name}を選択" aria-pressed="false"><title>${p.name}</title><path class="pref-shape" d="${p.d}" ${transform}/><text class="picker-prefecture-name" x="${x}" y="${y + 10}">${name}</text></g>`;
  }).join('');
  $('#picker-map-stage').innerHTML = `<svg class="pref-picker-svg" xmlns="http://www.w3.org/2000/svg" viewBox="-90 -80 2180 2080" aria-label="都道府県を選択する日本地図">${shapes}</svg>`;
  $('#open-prefecture-picker').disabled = false;
}
function selectPickerPrefecture(id) {
  pickerPrefectureId = PREFECTURES.some(p => p.id === id) ? id : null;
  const pref = PREFECTURES.find(p => p.id === pickerPrefectureId);
  $('#picker-selection').textContent = pref ? `${pref.name}（${REGIONS.find(r => r.id === pref.region).name}）` : '都道府県を選択してください';
  $('#confirm-prefecture').disabled = !pref;
  $$('[data-pick-prefecture]').forEach(el => el.setAttribute('aria-pressed', Number(el.dataset.pickPrefecture) === pickerPrefectureId));
}
function setPickerZoom(value) {
  pickerZoom = Math.min(3, Math.max(1, value));
  const svg = $('.pref-picker-svg');
  if (!svg) return;
  svg.style.width = `${pickerZoom * 100}%`; svg.style.height = `${pickerZoom * 100}%`;
  $('#picker-zoom-reset').textContent = `${Math.round(pickerZoom * 100)}%`;
  $('#picker-zoom-out').disabled = pickerZoom === 1;
  $('#picker-zoom-in').disabled = pickerZoom === 3;
}
$('#open-prefecture-picker').addEventListener('click', () => {
  selectPickerPrefecture(Number($('#visit-prefecture').value));
  setPickerZoom(1);
  $('#picker-map-stage').scrollTo(0, 0);
  showDialog($('#prefecture-picker-dialog'));
});
$('#picker-map-stage').addEventListener('click', event => {
  const pref = event.target.closest('[data-pick-prefecture]');
  if (pref) selectPickerPrefecture(Number(pref.dataset.pickPrefecture));
});
$('#picker-map-stage').addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const pref = event.target.closest('[data-pick-prefecture]');
  if (pref) { event.preventDefault(); selectPickerPrefecture(Number(pref.dataset.pickPrefecture)); }
});
$('#confirm-prefecture').addEventListener('click', () => {
  if (!pickerPrefectureId) return;
  if (Number($('#visit-prefecture').value) !== pickerPrefectureId) selectEntryPrefecture(pickerPrefectureId);
  else updateEntryPreview();
  $('#prefecture-picker-dialog').close();
});
$('#picker-zoom-in').addEventListener('click', () => setPickerZoom(pickerZoom + .5));
$('#picker-zoom-out').addEventListener('click', () => setPickerZoom(pickerZoom - .5));
$('#picker-zoom-reset').addEventListener('click', () => setPickerZoom(1));
function updateMapValues() {
  const summary = summarize(state);
  $$('[data-map-id]').forEach(group => {
    const id = Number(group.dataset.mapId);
    const pref = summary.prefectures[id - 1];
    const value = mapMetric === 'score' ? pref.score : pref.visits;
    group.setAttribute('aria-label', `${pref.name} ${format(pref.score)}点、${format(pref.visits)}回来訪。結果を確認`);
    group.querySelector('title').textContent = `${pref.name}：${format(pref.score)}点 / ${format(pref.visits)}回`;
    group.querySelector('.pref-shape').classList.toggle('is-visited', pref.visits > 0);
    group.querySelector('.pref-label').classList.toggle('is-visited', pref.visits > 0);
    const label = group.querySelector('.pref-number');
    label.textContent = format(value);
    label.setAttribute('dy', $('#show-names').checked ? '43' : '16');
    label.style.fontSize = String(format(value)).length > 5 ? '27px' : '';
  });
}
$$('[data-metric]').forEach(button => button.addEventListener('click', () => {
  mapMetric = button.dataset.metric;
  $$('[data-metric]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
  $('.map-card h2').textContent = mapMetric === 'score' ? 'わたしの旅の地図 · 得点' : 'わたしの旅の地図 · 来訪回数';
  updateMapValues();
}));
$('#show-names').addEventListener('change', event => { $('#map-stage').classList.toggle('hide-names', !event.target.checked); updateMapValues(); });
function setZoom(value) {
  zoom = Math.min(2.5, Math.max(1, value));
  const map = $('#japan-map');
  if (!map) return;
  map.style.width = `${zoom * 100}%`; map.style.height = `${zoom * 100}%`;
  $('#zoom-reset').textContent = `${Math.round(zoom * 100)}%`;
  $('#zoom-out').disabled = zoom === 1;
  $('#zoom-in').disabled = zoom === 2.5;
}
$('#zoom-in').addEventListener('click', () => setZoom(zoom + .25));
$('#zoom-out').addEventListener('click', () => setZoom(zoom - .25));
$('#zoom-reset').addEventListener('click', () => setZoom(1));

function showDialog(dialog) { if (!dialog.open) dialog.showModal(); }
$$('dialog').forEach(dialog => {
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
});
function openPref(id) {
  currentPref = PREFECTURES.find(p => p.id === id);
  const pref = summarize(state).prefectures[id - 1];
  const multiplier = state.multipliers[pref.region];
  $('#pref-dialog-title').textContent = pref.name;
  $('#pref-dialog-region').textContent = REGIONS.find(r => r.id === pref.region).en;
  $('#pref-results').innerHTML = `<div><span>得点</span><strong>${format(pref.score)}<small>pt</small></strong></div><div><span>来訪回数</span><strong>${format(pref.visits)}<small>回</small></strong></div>`;
  $('#pref-calculation').innerHTML = `<p class="pref-count-formula">${format(pref.visits)}回 × ${format(multiplier)}倍 ＝ ${format(pref.score)} pt</p>`;
  showDialog($('#pref-dialog'));
}
$('#pref-add').addEventListener('click', () => {
  $('#pref-dialog').close(); resetEntry();
  location.hash = '#record'; selectEntryPrefecture(currentPref.id);
  window.scrollTo({ top: 0 });
});

function openSettings() {
  $('#multiplier-grid').innerHTML = REGIONS.map(r => `<label class="multiplier-field">${r.name}<span class="multiplier-input"><input type="number" name="${r.id}" min="0" max="100" step="0.01" inputmode="decimal" required value="${state.multipliers[r.id]}" aria-label="${r.name}の得点倍率"><span>倍</span></span></label>`).join('');
  showDialog($('#settings-dialog'));
}
$('#open-settings').addEventListener('click', openSettings);
$('#score-settings').addEventListener('click', openSettings);
$('#footer-backup').addEventListener('click', () => { openSettings(); $('#export-data').scrollIntoView({ block: 'center' }); });
$('#default-multipliers').addEventListener('click', () => { $$('#multiplier-form input').forEach(input => input.value = 1); });
$('#multiplier-form').addEventListener('submit', event => {
  event.preventDefault();
  const next = Object.fromEntries(REGIONS.map(r => [r.id, $('#multiplier-form').elements.namedItem(r.id).valueAsNumber]));
  if (!Object.values(next).every(validMultiplier)) { toast('倍率は0〜100、小数第2位までで入力してください。'); return; }
  state.multipliers = next; persist(); updateUI(); $('#settings-dialog').close();
  if (!storageIssue) toast('地方ごとの得点倍率を保存しました。');
});

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function localDate() { return new Intl.DateTimeFormat('sv-SE').format(new Date()); }
$('#export-data').addEventListener('click', () => {
  download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `tabinoato-${localDate()}.json`);
  toast('バックアップを書き出しました。');
});
$('#import-data').addEventListener('click', () => $('#import-file').click());
function confirmAction(title, description, label, callback) {
  $('#confirm-title').textContent = title; $('#confirm-description').textContent = description;
  $('#confirm-action').textContent = label; confirmCallback = callback;
  showDialog($('#confirm-dialog'));
}
$('#confirm-action').addEventListener('click', () => {
  const callback = confirmCallback; confirmCallback = null; $('#confirm-dialog').close(); callback?.();
});
$('#import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  if (file.size > 20000000) { toast('ファイルが大きすぎます。20MB以下のJSONを選んでください。'); return; }
  try {
    const imported = parseState(await file.text());
    const summary = summarize(imported);
    confirmAction('記録を読み込みますか？', `訪問済み ${summary.visited}都道府県・のべ${format(summary.visits)}回の記録です。\n現在の来訪記録と倍率が、このファイルの内容に置き換わります。`, '読み込む', () => {
      state = imported; resetEntry(); persist(); updateUI(); $('#settings-dialog').close();
      if (!storageIssue) toast('バックアップから記録を復元しました。');
    });
  } catch (error) { toast(error instanceof SyntaxError ? 'JSONファイルを読み込めませんでした。' : error.message); }
});
$('#reset-data').addEventListener('click', () => confirmAction('来訪記録をリセットしますか？', 'すべての都道府県の来訪回数を0回に戻します。\n元に戻すにはバックアップが必要です。地方の倍率は維持されます。', 'リセットする', () => {
  state.counts = emptyState().counts; resetEntry(); persist(); updateUI(); $('#settings-dialog').close();
  if (!storageIssue) toast('来訪記録をリセットしました。');
}));

$('#download-map').addEventListener('click', async () => {
  const button = $('#download-map');
  if (!$('#japan-map')) return;
  button.disabled = true;
  try {
    const summary = summarize(state);
    const clone = $('#japan-map').cloneNode(true);
    clone.removeAttribute('style');
    clone.setAttribute('x', '80'); clone.setAttribute('y', '290'); clone.setAttribute('width', '1440'); clone.setAttribute('height', '1360');
    clone.querySelectorAll('[tabindex]').forEach(el => { el.removeAttribute('tabindex'); el.removeAttribute('role'); });
    const css = `.pref-shape{fill:#eeeee5;stroke:#fdfcf8;stroke-width:4;stroke-linejoin:round}.pref-shape.is-visited{fill:#dab19c}.pref-label{text-anchor:middle;fill:#65705c}.pref-label.is-visited{fill:#803e2c}.pref-name{font:24px sans-serif;paint-order:stroke;stroke:#fdfcf8;stroke-width:3}.pref-number{font:600 38px sans-serif;paint-order:stroke;stroke:#fdfcf8;stroke-width:5}.map-flourish{fill:#7b8176;font-family:sans-serif}.map-caption{font:39px serif;letter-spacing:5px;fill:#8b8f7e}.map-small{font:20px sans-serif;letter-spacing:5px;fill:#a6ac9c}${$('#show-names').checked ? '' : '.pref-name{display:none}.pref-number{font-size:56px}'} `;
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1820" viewBox="0 0 1600 1820"><style>${css}</style><rect width="1600" height="1820" fill="#fdfcf8"/><text x="100" y="110" fill="#ae573e" font-family="serif" font-size="45">たびのあと</text><text x="100" y="170" fill="#7b8176" font-family="sans-serif" font-size="20" letter-spacing="5">MY JAPAN TRAVEL MAP · ${mapMetric === 'score' ? 'SCORE (pt)' : 'VISITS'}</text><text x="1490" y="115" text-anchor="end" fill="#515f47" font-family="serif" font-size="68">${format(summary.score)} pt</text><text x="1490" y="170" text-anchor="end" fill="#7b8176" font-family="sans-serif" font-size="23">${summary.visited} / 47 都道府県　のべ${format(summary.visits)}回来訪</text><path d="M100 220H1500" stroke="#e1e3d8"/>${new XMLSerializer().serializeToString(clone)}<path d="M100 1680H1500" stroke="#e1e3d8"/><text x="100" y="1735" fill="#7b8176" font-family="sans-serif" font-size="20">ひとつの旅、ひとつの足あと。　${localDate()}</text><text x="1500" y="1770" text-anchor="end" fill="#939889" font-family="sans-serif" font-size="14">Map by lalamalink · CC0</text></svg>`;
    const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1820;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Cannot export');
      download(blob, `tabinoato-map-${localDate()}.png`);
      toast('旅の地図を画像に保存しました。');
    } finally { URL.revokeObjectURL(url); }
  } catch { toast('画像を保存できませんでした。もう一度お試しください。'); }
  finally { button.disabled = false; }
});

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try { state = parseState(event.newValue); storageIssue = false; updateUI(); }
  catch { toast('別タブの記録を読み込めませんでした。'); }
});

populateEntryForm(); updateUI(); route(); loadMap();
