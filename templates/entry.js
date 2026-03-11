/* Shared JS for both pages */
console.log('entry.js loaded');
const STORAGE_KEY = 'entries_v1';
console.log('STORAGE_KEY:', STORAGE_KEY);

// Make sure we're running in a browser environment
if (typeof window !== 'undefined') {
  // Get all entries from localStorage
  window.getEntries = function() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read entries:', e);
    return [];
  }
}

  // Save entries to localStorage
  window.saveEntries = function(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (e) {
    console.error('Failed to save entries:', e);
    return false;
  }
}

}

// Show a toast notification
function showToast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

// Initialize the add entry page
(function initAddPage() {
  const form = document.getElementById('add-form');
  if (!form) return; // Not on the add page

  // Set default date to today
  const dateInput = document.getElementById('date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('title')?.value.trim();
    const details = document.getElementById('details')?.value.trim() || '';
    const date = document.getElementById('date')?.value || new Date().toISOString().split('T')[0];
    const category = document.getElementById('category')?.value.trim() || 'General';

    if (!title) {
      showToast('Please enter a title');
      return;
    }

    const entries = getEntries();
    const now = new Date();
    const newEntry = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'entry-' + now.getTime(),
      title,
      details,
      date: date,
      category: category,
      priority: 'medium',
      status: 'active',
      location: 'Goa',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    entries.unshift(newEntry);
    const saved = saveEntries(entries);
    
    if (saved) {
      showToast('✅ Entry added successfully!');
      form.reset();
      
      // Reset the date field
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
      
      // Redirect to store page after a short delay
      setTimeout(() => {
        window.location.href = '/store.html';
      }, 1000);
    } else {
      showToast('❌ Failed to save entry. Please try again.');
    }
  });
})();

/* Page: store.html (View/Manage Data) */
(function initStorePage(){
  const tableBody = document.querySelector('#entries-body');
  const clearBtn = document.getElementById('clear-all');
  const exportBtn = document.getElementById('export');

  if (!tableBody) return; // Not on this page

  function render() {
    const entries = getEntries();
    tableBody.innerHTML = '';

    if (entries.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.className = 'empty';
      td.textContent = 'No data stored yet. Add some entries on the Add Data page!';
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    for (const e of entries) {
      const tr = document.createElement('tr');

      const tdTitle = document.createElement('td');
      tdTitle.textContent = e.title || '-';

      const tdCategory = document.createElement('td');
      tdCategory.innerHTML = `<span class="badge">${e.category || 'General'}</span>`;

      const tdDate = document.createElement('td');
      tdDate.textContent = e.date ? new Date(e.date).toDateString() : '-';

      const tdDetails = document.createElement('td');
      tdDetails.textContent = e.details || '-';

      const tdActions = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'danger';
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        const confirmDelete = confirm('Delete this entry?');
        if (!confirmDelete) return;
        const all = getEntries().filter(x => x.id !== e.id);
        saveEntries(all);
        render();
        showToast('Entry deleted');
      });
      tdActions.appendChild(del);

      tr.appendChild(tdTitle);
      tr.appendChild(tdCategory);
      tr.appendChild(tdDate);
      tr.appendChild(tdDetails);
      tr.appendChild(tdActions);
      tableBody.appendChild(tr);
    }
  }

  render();

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!confirm('This will clear ALL saved entries. Continue?')) return;
      saveEntries([]);
      render();
      showToast('All entries cleared');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = getEntries();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'entries.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('Data exported');
    });
  }
})();