/**
 * TIET First Year Timetable — static site JS
 * Handles index.html (search) and timetable.html (display).
 * data.json is fetched once and cached.
 */

let _data = null;

async function getData() {
  if (_data) return _data;
  const res = await fetch('data.json');
  if (!res.ok) throw new Error('Failed to load data.json');
  _data = await res.json();
  return _data;
}

const isHome      = !!document.getElementById('form');
const isTimetable = !!document.getElementById('tt-table');

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
if (isHome) initHome();

async function initHome() {
  const loadingEl  = document.getElementById('loading-state');
  const formEl     = document.getElementById('form');
  const submitBtn  = document.getElementById('submit-btn');
  let allGroups    = [];

  try {
    const data = await getData();
    for (const [sheet, sections] of Object.entries(data)) {
      for (const classname of Object.keys(sections)) {
        allGroups.push({ sheet, classname });
      }
    }
    allGroups.sort((a, b) => a.classname.localeCompare(b.classname));
    loadingEl.style.display = 'none';
    formEl.style.display    = '';
  } catch (err) {
    loadingEl.innerHTML = 'Failed to load data. Please refresh the page.';
    console.error(err);
    return;
  }

  const searchInput     = document.getElementById('group-search');
  const resultsBox      = document.getElementById('search-results');
  const selectedDisplay = document.getElementById('selected-display');

  let selectedSheet = '';
  let selectedClass = '';
  let activeIdx     = -1;

  function renderResults(query) {
    resultsBox.innerHTML = '';
    activeIdx = -1;
    const q = query.trim().toLowerCase();
    if (!q) { resultsBox.classList.remove('show'); return; }

    const matches = allGroups
      .filter(g => g.classname.toLowerCase().includes(q) || g.sheet.toLowerCase().includes(q))
      .slice(0, 40);

    if (matches.length === 0) {
      resultsBox.innerHTML = '<div id="no-results">No matching groups found</div>';
      resultsBox.classList.add('show');
      return;
    }

    matches.forEach(g => {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.dataset.sheet     = g.sheet;
      div.dataset.classname = g.classname;
      div.innerHTML = `
        <span class="search-item-code">${g.classname}</span>
        <span class="search-item-year">${g.sheet}</span>
      `;
      div.addEventListener('mousedown', e => { e.preventDefault(); selectGroup(g.sheet, g.classname); });
      resultsBox.appendChild(div);
    });
    resultsBox.classList.add('show');
  }

  function selectGroup(sheet, classname) {
    selectedSheet = sheet;
    selectedClass = classname;
    searchInput.value = classname;
    resultsBox.classList.remove('show');
    selectedDisplay.innerHTML = `
      <span class="selected-badge">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        ${classname} &nbsp;·&nbsp; ${sheet}
      </span>`;
    submitBtn.disabled = false;
  }

  searchInput.addEventListener('input', () => {
    selectedSheet = ''; selectedClass = '';
    selectedDisplay.innerHTML = '';
    submitBtn.disabled = true;
    renderResults(searchInput.value);
  });

  searchInput.addEventListener('keydown', e => {
    const items = resultsBox.querySelectorAll('.search-item');
    if (e.key === 'ArrowDown')    { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, items.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); }
    else if (e.key === 'Enter') {
      if (activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        const el = items[activeIdx];
        selectGroup(el.dataset.sheet, el.dataset.classname);
      }
      return;
    } else if (e.key === 'Escape') { resultsBox.classList.remove('show'); return; }
    items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
    if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) resultsBox.classList.remove('show');
  });

  document.getElementById('form').addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedSheet || !selectedClass) return;
    window.location.href = `timetable.html?${new URLSearchParams({ sheet: selectedSheet, classname: selectedClass })}`;
  });
}

// ── TIMETABLE PAGE ────────────────────────────────────────────────────────────
if (isTimetable) initTimetable();

async function initTimetable() {
  const params      = new URLSearchParams(window.location.search);
  const sheet       = params.get('sheet');
  const classname   = params.get('classname');
  const loadingEl   = document.getElementById('tt-loading');
  const errorEl     = document.getElementById('tt-error');
  const containerEl = document.getElementById('tt-container');
  const subheaderEl = document.getElementById('tt-subheader');
  const tableEl     = document.getElementById('tt-table');

  if (!sheet || !classname) {
    loadingEl.style.display = 'none';
    errorEl.style.display   = '';
    return;
  }

  document.title = `${classname} Timetable – TIET`;

  try {
    const data = await getData();
    const sectionData = data[sheet]?.[classname];
    if (!sectionData) {
      loadingEl.style.display = 'none';
      errorEl.style.display   = '';
      return;
    }

    document.getElementById('tt-group-code').textContent = classname;
    document.getElementById('tt-group-year').textContent = sheet;

    renderTable(tableEl, sectionData);

    loadingEl.style.display   = 'none';
    subheaderEl.style.display = '';
    containerEl.style.display = '';

  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.style.display   = '';
    console.error(err);
  }
}

function renderTable(tableEl, rows) {
  tableEl.innerHTML = '';

  rows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');

    row.forEach((cell, colIndex) => {
      const td     = document.createElement('td');
      const inner  = document.createElement('div');
      inner.className = 'cell-inner';

      const lines = (cell.course || '').split('\n').filter(Boolean);

      if (cell.color === 'dark') {
        // Header cells
        if (rowIndex === 0) {
          td.className = 'header-day';
          inner.textContent = lines[0] || '';
        } else if (colIndex === 0) {
          td.className = 'header-time';
          inner.textContent = lines[0] || '';
        } else {
          td.className = 'cell-empty';
        }
      } else if (!lines.length || !lines[0]) {
        td.className = 'cell-empty';
      } else {
        // Subject cell — pick class from color
        const colorMap = { danger: 'cell-l', warning: 'cell-p', primary: 'cell-t', success: 'cell-empty' };
        td.className = colorMap[cell.color] || 'cell-empty';

        // Primary line: code + room
        const codeEl = document.createElement('span');
        codeEl.className   = 'cell-code';
        codeEl.textContent = lines[0];
        inner.appendChild(codeEl);

        // Subject name
        if (lines[1] && !lines[1].startsWith('(Week')) {
          const nameEl = document.createElement('span');
          nameEl.className   = 'cell-name';
          nameEl.textContent = lines[1];
          inner.appendChild(nameEl);
        }

        // Alt-week badge (could be lines[1] or lines[2])
        const weekLine = lines.find(l => l.startsWith('(Week'));
        if (weekLine) {
          const weekEl = document.createElement('span');
          weekEl.className   = 'cell-week';
          weekEl.textContent = weekLine.replace(/[()]/g, '');
          inner.appendChild(weekEl);
        }
      }

      td.appendChild(inner);
      tr.appendChild(td);
    });

    tableEl.appendChild(tr);
  });
}
