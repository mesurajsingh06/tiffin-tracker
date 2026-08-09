/* ==========================================================================
   Tiffin Tracker — app.js
   All data lives in LocalStorage as an array of entry objects:
   { date: "YYYY-MM-DD", lunch: 100, dinner: 70, payment: 0, dailyTotal: 170 }
   One entry per date. dailyTotal = lunch + dinner (meal cost only, not
   reduced by payment — payment is tracked separately per the spec).
   ========================================================================== */

const STORAGE_KEY = 'tiffinTrackerEntries';
const DEFAULT_LUNCH = 100;
const DEFAULT_DINNER = 70;

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const fmt = (n) => `₹${inr.format(Math.round(n || 0))}`;
const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time

/* ---------------------------- Storage layer ---------------------------- */

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read entries from LocalStorage', e);
    return [];
  }
}

function saveEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to write entries to LocalStorage', e);
    showToast("Couldn't save — storage may be full");
  }
}

function findEntry(entries, date) {
  return entries.find((e) => e.date === date);
}

/** Create/update the meal portion of a day. Preserves any existing payment. */
function upsertMeal(date, lunch, dinner) {
  const entries = loadEntries();
  let entry = findEntry(entries, date);
  if (!entry) {
    entry = { date, lunch: 0, dinner: 0, payment: 0, dailyTotal: 0 };
    entries.push(entry);
  }
  entry.lunch = lunch;
  entry.dinner = dinner;
  entry.dailyTotal = lunch + dinner;
  saveEntries(entries);
  return entries;
}

/** Add a payment amount to a given date (accumulates if paid more than once/day). */
function addPayment(date, amount) {
  const entries = loadEntries();
  let entry = findEntry(entries, date);
  if (!entry) {
    entry = { date, lunch: 0, dinner: 0, payment: 0, dailyTotal: 0 };
    entries.push(entry);
  }
  entry.payment = (entry.payment || 0) + amount;
  saveEntries(entries);
  return entries;
}

function deleteEntry(date) {
  const entries = loadEntries().filter((e) => e.date !== date);
  saveEntries(entries);
  return entries;
}

/* ------------------------------ Calculations ---------------------------- */

function computeBalance(entries) {
  return entries.reduce((sum, e) => sum + (e.dailyTotal || 0) - (e.payment || 0), 0);
}

function computeMonthlyTotals(entries, year, month) {
  let spent = 0;
  let paid = 0;
  for (const e of entries) {
    const d = new Date(e.date + 'T00:00:00');
    if (d.getFullYear() === year && d.getMonth() === month) {
      spent += e.dailyTotal || 0;
      paid += e.payment || 0;
    }
  }
  return { spent, paid };
}

/* --------------------------------- State -------------------------------- */

let selectedLunch = DEFAULT_LUNCH;
let selectedDinner = DEFAULT_DINNER;

/* --------------------------------- Render -------------------------------- */

function render() {
  const entries = loadEntries().sort((a, b) => (a.date < b.date ? 1 : -1));

  renderDashboard(entries);
  renderHistory(entries);
  renderDayTotalPreview();
}

function renderDashboard(entries) {
  const balance = computeBalance(entries);
  const now = new Date();
  const { spent, paid } = computeMonthlyTotals(entries, now.getFullYear(), now.getMonth());
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });

  const balanceCard = document.getElementById('balanceCard');
  const balanceAmount = document.getElementById('balanceAmount');
  const balanceBadge = document.getElementById('balanceBadge');

  balanceAmount.textContent = fmt(Math.abs(balance));

  if (balance > 0) {
    balanceCard.className = 'rounded-2xl p-4 shadow-md bg-gradient-to-br from-red-500 to-red-600';
    balanceBadge.textContent = 'You owe';
    balanceBadge.classList.remove('hidden');
  } else if (balance < 0) {
    balanceCard.className = 'rounded-2xl p-4 shadow-md bg-gradient-to-br from-green-500 to-green-600';
    balanceBadge.textContent = 'In credit';
    balanceBadge.classList.remove('hidden');
  } else {
    balanceCard.className = 'rounded-2xl p-4 shadow-md bg-gradient-to-br from-blue-500 to-blue-600';
    balanceBadge.textContent = 'All settled';
    balanceBadge.classList.remove('hidden');
  }

  document.getElementById('monthSpent').textContent = fmt(spent);
  document.getElementById('monthPaid').textContent = fmt(paid);
  document.getElementById('monthLabel1').textContent = monthName;
  document.getElementById('monthLabel2').textContent = monthName;
}

function renderHistory(entries) {
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');

  if (!entries.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = entries
    .map((e) => {
      const d = new Date(e.date + 'T00:00:00');
      const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
      const lunchChip = e.lunch > 0
        ? `<span class="text-[11px] bg-blue-50 text-blue-700 rounded-md px-1.5 py-0.5 font-medium">Lunch ${fmt(e.lunch)}</span>`
        : `<span class="text-[11px] bg-gray-50 text-gray-400 rounded-md px-1.5 py-0.5 font-medium">No lunch</span>`;
      const dinnerChip = e.dinner > 0
        ? `<span class="text-[11px] bg-blue-50 text-blue-700 rounded-md px-1.5 py-0.5 font-medium">Dinner ${fmt(e.dinner)}</span>`
        : `<span class="text-[11px] bg-gray-50 text-gray-400 rounded-md px-1.5 py-0.5 font-medium">No dinner</span>`;
      const paymentChip = e.payment > 0
        ? `<span class="text-[11px] bg-green-50 text-green-700 rounded-md px-1.5 py-0.5 font-medium">Paid ${fmt(e.payment)}</span>`
        : '';

      return `
        <div class="flex items-center justify-between gap-2 border border-gray-100 rounded-xl px-3 py-2.5">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-gray-700">${dateLabel}</p>
            <div class="flex flex-wrap gap-1 mt-1">${lunchChip}${dinnerChip}${paymentChip}</div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <p class="text-sm font-bold text-gray-800 tabular-nums">${fmt(e.dailyTotal || 0)}</p>
            <button class="delete-entry text-gray-300 active:text-red-500 p-1" data-date="${e.date}" aria-label="Delete entry">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          </div>
        </div>`;
    })
    .join('');

  list.querySelectorAll('.delete-entry').forEach((btn) => {
    btn.addEventListener('click', () => {
      const date = btn.getAttribute('data-date');
      if (confirm(`Delete the entry for ${date}? This cannot be undone.`)) {
        deleteEntry(date);
        render();
        showToast('Entry deleted');
      }
    });
  });
}

function renderDayTotalPreview() {
  document.getElementById('dayTotalPreview').textContent = fmt(selectedLunch + selectedDinner);
}

/* ------------------------------ Toggle buttons --------------------------- */

function setMealButtonStyles() {
  document.querySelectorAll('.meal-btn').forEach((btn) => {
    const meal = btn.getAttribute('data-meal');
    const value = Number(btn.getAttribute('data-value'));
    const currentValue = meal === 'lunch' ? selectedLunch : selectedDinner;
    const isActive = value === currentValue;
    btn.setAttribute('data-active', String(isActive));
    if (isActive) {
      btn.className = 'toggle-btn meal-btn rounded-xl border-2 py-2.5 text-sm font-semibold border-brand-600 bg-brand-50 text-brand-700';
    } else {
      btn.className = 'toggle-btn meal-btn rounded-xl border-2 py-2.5 text-sm font-semibold border-gray-200 bg-white text-gray-400';
    }
  });
}

/* ---------------------------------- CSV ----------------------------------- */

function exportCsv() {
  const entries = loadEntries().sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!entries.length) {
    showToast('No entries to export yet');
    return;
  }

  const header = ['Date', 'Lunch', 'Dinner', 'Payment', 'Daily Total'];
  const rows = entries.map((e) => [
    e.date,
    e.lunch || 0,
    e.dinner || 0,
    e.payment || 0,
    e.dailyTotal || 0,
  ]);
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tiffin-tracker-${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV downloaded');
}

/* --------------------------------- Toast ---------------------------------- */

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  // restart animation
  toast.classList.remove('show');
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 1800);
}

/* ------------------------------ Bottom nav spy ----------------------------- */

function setupNavSpy() {
  const sections = ['log-section', 'payment-section', 'history-section'].map((id) => document.getElementById(id));
  const navButtons = document.querySelectorAll('.nav-btn');

  const setActive = (id) => {
    navButtons.forEach((btn) => {
      const isActive = btn.getAttribute('data-nav') === id;
      btn.classList.toggle('text-brand-600', isActive);
      btn.classList.toggle('text-gray-400', !isActive);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
  );
  sections.forEach((s) => s && observer.observe(s));
  setActive('log-section');
}

/* ---------------------------------- Init ----------------------------------- */

function init() {
  const logDateInput = document.getElementById('logDate');
  const paymentDateInput = document.getElementById('paymentDate');
  logDateInput.value = todayStr();
  paymentDateInput.value = todayStr();
  logDateInput.max = todayStr();
  paymentDateInput.max = todayStr();

  // When the log date changes, reflect any already-saved meal choices for that day.
  logDateInput.addEventListener('change', () => {
    const entries = loadEntries();
    const existing = findEntry(entries, logDateInput.value);
    selectedLunch = existing ? existing.lunch || 0 : DEFAULT_LUNCH;
    selectedDinner = existing ? existing.dinner || 0 : DEFAULT_DINNER;
    setMealButtonStyles();
    renderDayTotalPreview();
  });

  document.querySelectorAll('.meal-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const meal = btn.getAttribute('data-meal');
      const value = Number(btn.getAttribute('data-value'));
      if (meal === 'lunch') selectedLunch = value;
      else selectedDinner = value;
      setMealButtonStyles();
      renderDayTotalPreview();
    });
  });

  document.getElementById('saveDay').addEventListener('click', () => {
    const date = logDateInput.value || todayStr();
    upsertMeal(date, selectedLunch, selectedDinner);
    render();
    showToast(`Saved ${date} — ${fmt(selectedLunch + selectedDinner)}`);
  });

  document.querySelectorAll('.quick-amt').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('paymentAmount').value = btn.getAttribute('data-amt');
    });
  });

  document.getElementById('logPayment').addEventListener('click', () => {
    const date = paymentDateInput.value || todayStr();
    const amountInput = document.getElementById('paymentAmount');
    const amount = Number(amountInput.value);
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount first');
      return;
    }
    addPayment(date, amount);
    amountInput.value = '';
    render();
    showToast(`Logged payment of ${fmt(amount)}`);
  });

  document.getElementById('exportCsv').addEventListener('click', exportCsv);

  setMealButtonStyles();
  setupNavSpy();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
