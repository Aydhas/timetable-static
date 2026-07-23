/**
 * Thapar Timetable — static site JS
 * Handles both index.html (search) and timetable.html (display).
 * data.json is fetched once and cached for the session.
 */

// ── Data cache ────────────────────────────────────────────────────────────────
let _data = null;

async function getData() {
  if (_data) return _data;
  const res = await fetch('data.json');
  if (!res.ok) throw new Error('Failed to load data.json');
  _data = await res.json();
  return _data;
}

// ── Route detection ───────────────────────────────────────────────────────────
const isHome      = document.getElementById('form') !== null;
const isTimetable = document.getElementById('tt-table') !== null;

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
if (isHome) {
  initHome();
}

async function initHome() {
  const loadingEl = document.getElementById('loading-state');
  const formEl    = document.getElementById('form');

  let allGroups = [];

  try {
    const data = await getData();

    // Build flat list [{sheet, classname}] from data.json structure
    // Structure: { "1ST YEAR A": { "1A1A": [...], "1A1B": [...] }, ... }
    for (const [sheet, sections] of Object.entries(data)) {
      for (const classname of Object.keys(sections)) {
        allGroups.push({ sheet, classname });
      }
    }

    // Sort alphabetically by classname for nicer results
    allGroups.sort((a, b) => a.classname.localeCompare(b.classname));

    loadingEl.style.display = 'none';
    formEl.style.display    = '';
  } catch (err) {
    loadingEl.textContent = 'Failed to load data. Please refresh.';
    console.error(err);
    return;
  }

  // ── Search UI ───────────────────────────────────────────────────────────────
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
      .filter(g =>
        g.classname.toLowerCase().includes(q) ||
        g.sheet.toLowerCase().includes(q)
      )
      .slice(0, 40);

    if (matches.length === 0) {
      resultsBox.innerHTML = '<div id="no-results">No groups found</div>';
      resultsBox.classList.add('show');
      return;
    }

    matches.forEach(g => {
      const div = document.createElement('div');
      div.className         = 'search-item';
      div.dataset.sheet     = g.sheet;
      div.dataset.classname = g.classname;
      div.innerHTML = `${g.classname}<span class="sheet-label">${g.sheet}</span>`;
      div.addEventListener('mousedown', e => {
        e.preventDefault();
        selectGroup(g.sheet, g.classname);
      });
      resultsBox.appendChild(div);
    });

    resultsBox.classList.add('show');
  }

  function selectGroup(sheet, classname) {
    selectedSheet         = sheet;
    selectedClass         = classname;
    searchInput.value     = classname;
    resultsBox.classList.remove('show');
    selectedDisplay.innerHTML =
      `<span class="selected-badge">✓ ${classname} &nbsp;·&nbsp; ${sheet}</span>`;
  }

  searchInput.addEventListener('input', () => {
    selectedSheet = '';
    selectedClass = '';
    selectedDisplay.innerHTML = '';
    renderResults(searchInput.value);
  });

  searchInput.addEventListener('keydown', e => {
    const items = resultsBox.querySelectorAll('.search-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0 && items[activeIdx]) {
        e.preventDefault();
        const el = items[activeIdx];
        selectGroup(el.dataset.sheet, el.dataset.classname);
      }
      return;
    } else if (e.key === 'Escape') {
      resultsBox.classList.remove('show');
      return;
    }
    items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
    if (items[activeIdx]) items[activeIdx].scrollIntoView({ block: 'nearest' });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) {
      resultsBox.classList.remove('show');
    }
  });

  // ── Form submit ─────────────────────────────────────────────────────────────
  document.getElementById('form').addEventListener('submit', e => {
    e.preventDefault();
    if (!selectedSheet || !selectedClass) {
      alert('Please search and select a group first');
      return;
    }
    const params = new URLSearchParams({ sheet: selectedSheet, classname: selectedClass });
    window.location.href = `timetable.html?${params}`;
  });
}

// ── TIMETABLE PAGE ────────────────────────────────────────────────────────────
if (isTimetable) {
  initTimetable();
}

async function initTimetable() {
  const params    = new URLSearchParams(window.location.search);
  const sheet     = params.get('sheet');
  const classname = params.get('classname');

  const loadingEl   = document.getElementById('tt-loading');
  const errorEl     = document.getElementById('tt-error');
  const containerEl = document.getElementById('tt-container');
  const titleEl     = document.getElementById('tt-title');
  const tableEl     = document.getElementById('tt-table');

  if (!sheet || !classname) {
    loadingEl.style.display = 'none';
    errorEl.style.display   = '';
    return;
  }

  document.title = `${classname} Time Table`;

  try {
    const data = await getData();

    const sectionData = data[sheet]?.[classname];
    if (!sectionData) {
      loadingEl.style.display = 'none';
      errorEl.style.display   = '';
      return;
    }

    titleEl.textContent = `${classname} — ${sheet}`;
    renderTable(tableEl, sectionData);

    loadingEl.style.display   = 'none';
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
      const td  = document.createElement('td');
      const div = document.createElement('div');
      div.textContent = cell.course;

      if (cell.color === 'dark') {
        if (rowIndex === 0) {
          td.className = 'header-day';
        } else if (colIndex === 0) {
          td.className = 'header-time';
        } else {
          td.className = 'bg-dark empty';
        }
      } else {
        td.className = `bg-${cell.color}`;
      }

      td.appendChild(div);
      tr.appendChild(td);
    });

    tableEl.appendChild(tr);
  });
}
