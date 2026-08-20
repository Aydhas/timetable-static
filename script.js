/**
 * TIET Student Timetable — script.js
 * Data format: timetable.json
 *   { "1A11": { "Monday": { "08:50 AM": [code,room,name,type,week,electives] } } }
 *
 * Slot array: [code, room, name, type, week, electivesList]
 *   week: null = every week, 1 = week-1 only, 2 = week-2 only
 *   electivesList: [] or [{subject_code, subject_name, type, place}, ...]
 */

// ─────────────────────────────────────────────────────────────────────────────
// Data + cache
// ─────────────────────────────────────────────────────────────────────────────
let _data = null;

async function getData() {
  if (_data) return _data;
  const res = await fetch('timetable.json');
  if (!res.ok) throw new Error('Failed to load timetable.json');
  _data = await res.json();
  return _data;
}

const TIME_SLOTS = [
  '08:00 AM','08:50 AM','09:40 AM','10:30 AM','11:20 AM',
  '12:10 PM','01:00 PM','01:50 PM','02:40 PM','03:30 PM','04:20 PM'
];
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday'];

// Per-batch elective selections: { batchId: { "Monday|08:50 AM": selectedIndex } }
// Stored in sessionStorage so it persists across navigation but resets on close
function getElectiveSelections(batchId) {
  try {
    const raw = sessionStorage.getItem('electives_' + batchId);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveElectiveSelections(batchId, selections) {
  try { sessionStorage.setItem('electives_' + batchId, JSON.stringify(selections)); } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Route detection
// ─────────────────────────────────────────────────────────────────────────────
const isHome      = !!document.getElementById('form');
const isTimetable = !!document.getElementById('tt-table');

if (isHome)      initHome();
if (isTimetable) initTimetable();

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────
async function initHome() {
  const loadingEl = document.getElementById('loading-state');
  const formEl    = document.getElementById('form');
  const submitBtn = document.getElementById('submit-btn');
  let allGroups   = [];

  try {
    const data = await getData();
    allGroups = Object.keys(data).sort();
    loadingEl.style.display = 'none';
    formEl.style.display    = '';
  } catch (err) {
    loadingEl.innerHTML = 'Failed to load timetable data. Please refresh.';
    console.error(err);
    return;
  }

  const searchInput     = document.getElementById('group-search');
  const resultsBox      = document.getElementById('search-results');
  const selectedDisplay = document.getElementById('selected-display');

  let selectedClass = '', activeIdx = -1;

  function yearLabel(code) {
    const y = code[0];
    return y === '1' ? 'First Year' : y === '2' ? 'Second Year' :
           y === '3' ? 'Third Year'  : y === '4' ? 'Fourth Year' : `Year ${y}`;
  }

  function renderResults(query) {
    resultsBox.innerHTML = '';
    activeIdx = -1;
    const q = query.trim().toLowerCase();
    if (!q) { resultsBox.classList.remove('show'); return; }

    const matches = allGroups
      .filter(g => g.toLowerCase().includes(q))
      .slice(0, 50);

    if (!matches.length) {
      resultsBox.innerHTML = '<div id="no-results">No matching groups found</div>';
      resultsBox.classList.add('show');
      return;
    }

    matches.forEach(g => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.dataset.classname = g;
      div.innerHTML = `<span class="search-item-code">${g}</span>
                       <span class="search-item-year">${yearLabel(g)}</span>`;
      div.addEventListener('mousedown', e => { e.preventDefault(); selectGroup(g); });
      resultsBox.appendChild(div);
    });
    resultsBox.classList.add('show');
  }

  function selectGroup(classname) {
    selectedClass = classname;
    searchInput.value = classname;
    resultsBox.classList.remove('show');
    selectedDisplay.innerHTML =
      `<span class="selected-badge">
        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
        ${classname} &nbsp;·&nbsp; ${yearLabel(classname)}
      </span>`;
    submitBtn.disabled = false;
  }

  searchInput.addEventListener('input', () => {
    selectedClass = '';
    selectedDisplay.innerHTML = '';
    submitBtn.disabled = true;
    renderResults(searchInput.value);
  });

  searchInput.addEventListener('keydown', e => {
    const items = resultsBox.querySelectorAll('.search-item');
    if      (e.key === 'ArrowDown')  { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); }
    else if (e.key === 'Enter')  {
      if (activeIdx >= 0 && items[activeIdx]) { e.preventDefault(); selectGroup(items[activeIdx].dataset.classname); }
      return;
    }
    else if (e.key === 'Escape') { resultsBox.classList.remove('show'); return; }
    items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
    if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) resultsBox.classList.remove('show');
  });

  document.getElementById('form').addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedClass) return;
    window.location.href = `timetable.html?batch=${encodeURIComponent(selectedClass)}`;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TIMETABLE PAGE
// ─────────────────────────────────────────────────────────────────────────────
async function initTimetable() {
  const params      = new URLSearchParams(window.location.search);
  const batchId     = params.get('batch');
  const loadingEl   = document.getElementById('tt-loading');
  const errorEl     = document.getElementById('tt-error');
  const containerEl = document.getElementById('tt-container');
  const subheaderEl = document.getElementById('tt-subheader');
  const tableEl     = document.getElementById('tt-table');

  if (!batchId) { loadingEl.style.display = 'none'; errorEl.style.display = ''; return; }

  const year = batchId[0];
  const yearText = year === '1' ? 'First Year' : year === '2' ? 'Second Year' :
                   year === '3' ? 'Third Year'  : year === '4' ? 'Fourth Year' : '';
  document.title = `${batchId} – TIET Timetable`;

  try {
    const data = await getData();
    const batchData = data[batchId];
    if (!batchData) { loadingEl.style.display = 'none'; errorEl.style.display = ''; return; }

    if (document.getElementById('tt-group-code'))
      document.getElementById('tt-group-code').textContent = batchId;
    if (document.getElementById('tt-group-year'))
      document.getElementById('tt-group-year').textContent = yearText;

    // Load saved elective selections
    const selections = getElectiveSelections(batchId);

    renderTable(tableEl, batchData, batchId, selections);

    loadingEl.style.display   = 'none';
    if (subheaderEl) subheaderEl.style.display = '';
    containerEl.style.display = '';

    // Trigger mobile day-cards rebuild after table is ready
    document.dispatchEvent(new Event('timetable-ready'));

  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.style.display   = '';
    console.error(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE RENDERER
// ─────────────────────────────────────────────────────────────────────────────
function renderTable(tableEl, batchData, batchId, selections) {
  tableEl.innerHTML = '';

  // ── Header row (Day names) ──
  const headTr = document.createElement('tr');
  // Time column header
  const timeTh = document.createElement('td');
  timeTh.className = 'header-day';
  timeTh.innerHTML = '<div class="cell-inner">Time</div>';
  headTr.appendChild(timeTh);

  DAYS.forEach(day => {
    const td = document.createElement('td');
    td.className = 'header-day';
    td.innerHTML = `<div class="cell-inner">${day.slice(0,3).toUpperCase()}</div>`;
    headTr.appendChild(td);
  });
  tableEl.appendChild(headTr);

  // ── Data rows (one per time slot) ──
  TIME_SLOTS.forEach(time => {
    const tr = document.createElement('tr');

    // Time cell
    const timeTd = document.createElement('td');
    timeTd.className = 'header-time';
    timeTd.innerHTML = `<div class="cell-inner">${formatTime(time)}</div>`;
    tr.appendChild(timeTd);

    DAYS.forEach(day => {
      const slot = batchData[day]?.[time] ?? null;
      const selKey = `${day}|${time}`;
      const selIdx = selections[selKey] ?? null;
      const td = buildCell(slot, selKey, batchId, selections);
      tr.appendChild(td);
    });

    tableEl.appendChild(tr);
  });
}

function formatTime(t) {
  // "08:50 AM" -> "8:50am"
  return t.replace(/^0/, '').replace(' ', '').toLowerCase();
}

function buildCell(slot, selKey, batchId, selections) {
  const td = document.createElement('td');

  if (!slot) {
    td.className = 'cell-empty';
    td.innerHTML = '<div class="cell-inner"></div>';
    return td;
  }

  const [code, room, name, type, week, electives] = slot;
  const isElective = type === 'Elective' && electives && electives.length > 0;
  const selIdx = selections[selKey] ?? null;

  if (isElective) {
    return buildElectiveCell(td, slot, selKey, batchId, selections);
  }

  // Normal / alt-week cell
  const typeClass = typeToClass(type);
  td.className = typeClass;

  const inner = document.createElement('div');
  inner.className = 'cell-inner';

  if (code) {
    const codeEl = document.createElement('span');
    codeEl.className = 'cell-code';
    codeEl.textContent = `${code}${room ? '\n' + room : ''}`;
    inner.appendChild(codeEl);

    if (name) {
      const nameEl = document.createElement('span');
      nameEl.className = 'cell-name';
      nameEl.textContent = name;
      inner.appendChild(nameEl);
    }

    if (week === 1 || week === 2) {
      const weekEl = document.createElement('span');
      weekEl.className = 'cell-week';
      weekEl.textContent = `Week ${week}`;
      inner.appendChild(weekEl);
    }
  }

  td.appendChild(inner);
  return td;
}

function buildElectiveCell(td, slot, selKey, batchId, selections) {
  const [, , , , , electives] = slot;
  const selIdx = selections[selKey] ?? null;
  const chosen = selIdx !== null ? electives[selIdx] : null;

  if (chosen) {
    // Render the chosen elective like a normal cell
    const typeClass = typeToClass(chosen.type);
    td.className = typeClass + ' cell-elective-chosen';

    const inner = document.createElement('div');
    inner.className = 'cell-inner';
    inner.style.cursor = 'pointer';
    inner.title = 'Click to change elective';

    const codeEl = document.createElement('span');
    codeEl.className = 'cell-code';
    codeEl.textContent = `${chosen.subject_code}\n${chosen.place}`;
    inner.appendChild(codeEl);

    const nameEl = document.createElement('span');
    nameEl.className = 'cell-name';
    nameEl.textContent = chosen.subject_name;
    inner.appendChild(nameEl);

    const editEl = document.createElement('span');
    editEl.className = 'cell-elective-edit';
    editEl.textContent = '✎ change';
    inner.appendChild(editEl);

    inner.addEventListener('click', () => openElectiveModal(slot, selKey, batchId, selections));
    td.appendChild(inner);
  } else {
    // Unset elective — show SELECT button
    td.className = 'cell-elective';

    const inner = document.createElement('div');
    inner.className = 'cell-inner';

    const label = document.createElement('span');
    label.className = 'cell-elective-label';
    label.textContent = 'Elective';
    inner.appendChild(label);

    const btn = document.createElement('button');
    btn.className = 'cell-elective-btn';
    btn.textContent = 'SELECT';
    btn.addEventListener('click', () => openElectiveModal(slot, selKey, batchId, selections));
    inner.appendChild(btn);

    td.appendChild(inner);
  }

  return td;
}

// ─────────────────────────────────────────────────────────────────────────────
// ELECTIVE MODAL
// ─────────────────────────────────────────────────────────────────────────────
let _currentModal = null;

function openElectiveModal(slot, selKey, batchId, selections) {
  const [, , , , , electives] = slot;
  const selIdx = selections[selKey] ?? null;

  // Parse day/time from selKey e.g. "Monday|08:50 AM"
  const [dayStr, timeStr] = selKey.split('|');
  const timeLabel = formatTime(timeStr).toUpperCase().replace('AM',' AM').replace('PM',' PM');

  // Remove existing modal
  if (_currentModal) _currentModal.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-header">
      <div>
        <h3 class="modal-title">Edit Class Slot</h3>
        <p class="modal-subtitle">${dayStr.toUpperCase()} AT ${formatTime(timeStr).toUpperCase()}</p>
      </div>
      <button class="modal-close" aria-label="Close">✕</button>
    </div>
    <div class="modal-body">
      <label class="modal-field-label">Select Elective Subject</label>
      <select class="modal-select" id="modal-select">
        <option value="-1">-- Choose elective subject --</option>
        ${electives.map((e, i) =>
          `<option value="${i}" ${i === selIdx ? 'selected' : ''}>
            ${e.subject_code} - ${e.subject_name} (${e.place})
          </option>`
        ).join('')}
      </select>
      <div class="modal-detail" id="modal-detail" style="display:none;"></div>
    </div>
    <div class="modal-footer">
      <button class="modal-btn-remove" id="modal-remove">🗑 Remove Slot</button>
      <div style="display:flex;gap:8px;">
        <button class="modal-btn-cancel" id="modal-cancel">Cancel</button>
        <button class="modal-btn-save" id="modal-save">Save Class</button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _currentModal = overlay;

  const selectEl  = modal.querySelector('#modal-select');
  const detailEl  = modal.querySelector('#modal-detail');
  const saveBtn   = modal.querySelector('#modal-save');
  const removeBtn = modal.querySelector('#modal-remove');
  const cancelBtn = modal.querySelector('#modal-cancel');
  const closeBtn  = modal.querySelector('.modal-close');

  function showDetail(idx) {
    if (idx < 0 || idx >= electives.length) { detailEl.style.display = 'none'; return; }
    const e = electives[idx];
    detailEl.style.display = '';
    detailEl.innerHTML = `
      <div class="detail-row"><span class="detail-label">SUBJECT NAME</span><span class="detail-value">${e.subject_name}</span></div>
      <div class="detail-cols">
        <div><span class="detail-label">SUBJECT CODE</span><span class="detail-value detail-code">${e.subject_code}</span></div>
        <div><span class="detail-label">ROOM / PLACE</span><span class="detail-value">${e.place}</span></div>
      </div>
      <div class="detail-row"><span class="detail-label">CLASS TYPE</span><span class="detail-value">${e.type}</span></div>
    `;
  }

  // Show detail for pre-selected
  if (selIdx !== null) showDetail(selIdx);

  selectEl.addEventListener('change', () => {
    const v = parseInt(selectEl.value);
    showDetail(v);
  });

  function closeModal() { overlay.remove(); _currentModal = null; }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  removeBtn.addEventListener('click', () => {
    delete selections[selKey];
    saveElectiveSelections(batchId, selections);
    closeModal();
    refreshTable(batchId, selections);
  });

  saveBtn.addEventListener('click', () => {
    const v = parseInt(selectEl.value);
    if (v >= 0) {
      selections[selKey] = v;
      saveElectiveSelections(batchId, selections);
      closeModal();
      refreshTable(batchId, selections);
    }
  });
}

async function refreshTable(batchId, selections) {
  const data = await getData();
  const batchData = data[batchId];
  const tableEl = document.getElementById('tt-table');
  if (tableEl && batchData) {
    renderTable(tableEl, batchData, batchId, selections);
    document.dispatchEvent(new Event('timetable-ready'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function typeToClass(type) {
  if (!type) return 'cell-empty';
  const t = type.toLowerCase();
  if (t === 'lecture')   return 'cell-l';
  if (t === 'practical') return 'cell-p';
  if (t === 'tutorial')  return 'cell-t';
  return 'cell-empty';
}
