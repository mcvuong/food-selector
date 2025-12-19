// Food Selector App
const API_BASE = '';

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  // If no saved theme (or 'system'), don't set data-theme, let CSS handle it
  
  updateThemeButtons(savedTheme || 'system');
}

function setTheme(theme) {
  localStorage.setItem('theme', theme);
  
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    // System preference
    document.documentElement.removeAttribute('data-theme');
  }
  
  updateThemeButtons(theme);
}

function updateThemeButtons(activeTheme) {
  document.getElementById('theme-light').classList.toggle('active', activeTheme === 'light');
  document.getElementById('theme-system').classList.toggle('active', activeTheme === 'system');
  document.getElementById('theme-dark').classList.toggle('active', activeTheme === 'dark');
}

// Initialize theme immediately (before DOM load to prevent flash)
initTheme();

// DOM Elements
const nameModal = document.getElementById('name-modal');
const userNameInput = document.getElementById('user-name-input');
const setNameBtn = document.getElementById('set-name-btn');
const userBar = document.getElementById('user-bar');
const currentUserName = document.getElementById('current-user-name');
const changeNameBtn = document.getElementById('change-name-btn');
const restaurantsList = document.getElementById('restaurants-list');
const suggestInput = document.getElementById('suggest-input');
const suggestCuisineInput = document.getElementById('suggest-cuisine-input');
const suggestBtn = document.getElementById('suggest-btn');
const resetBtn = document.getElementById('reset-btn');

// Note modal elements
const noteModal = document.getElementById('note-modal');
const noteRestaurantTitle = document.getElementById('note-restaurant-title');
const existingNotes = document.getElementById('existing-notes');
const noteInput = document.getElementById('note-input');
const cancelNoteBtn = document.getElementById('cancel-note-btn');
const saveNoteBtn = document.getElementById('save-note-btn');

// State
let currentUser = null;
let currentNoteRestaurant = null;
let restaurantsData = []; // Store restaurant data for note modal access

// Escape HTML to prevent XSS and handle special characters
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Check for existing user cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
  return null;
}

// Initialize app
async function init() {
  currentUser = getCookie('visitorId');
  
  if (currentUser) {
    showUserBar(currentUser);
    nameModal.classList.add('hidden');
  } else {
    nameModal.classList.remove('hidden');
  }
  
  await loadRestaurants();
}

// Show user bar
function showUserBar(name) {
  currentUserName.textContent = name;
  userBar.classList.remove('hidden');
  nameModal.classList.add('hidden');
}

// Set user name
async function setUserName() {
  const name = userNameInput.value.trim();
  if (!name) {
    userNameInput.focus();
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/set-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    if (response.ok) {
      currentUser = name;
      showUserBar(name);
      await loadRestaurants();
    }
  } catch (error) {
    console.error('Error setting name:', error);
  }
}

// Generate Google Maps search URL
function getGoogleMapsUrl(restaurantName) {
  const query = encodeURIComponent(`${restaurantName} Tulsa OK`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

// Load and render restaurants
async function loadRestaurants() {
  restaurantsList.innerHTML = '<div class="loading"></div>';
  
  try {
    const response = await fetch(`${API_BASE}/api/restaurants`);
    const data = await response.json();
    
    renderRestaurants(data.restaurants);
  } catch (error) {
    console.error('Error loading restaurants:', error);
    restaurantsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Failed to load restaurants</p>';
  }
}

// Render restaurant cards
function renderRestaurants(restaurants) {
  // Store for later access in note modal
  restaurantsData = restaurants;
  
  restaurantsList.innerHTML = restaurants.map(restaurant => {
    const isNew = !restaurant.isDefault;
    const hasNotes = restaurant.notes && restaurant.notes.length > 0;
    const scoreClass = restaurant.netScore > 0 ? 'positive' : restaurant.netScore < 0 ? 'negative' : '';
    
    return `
      <div class="restaurant-card" data-id="${restaurant.id}">
        <div class="vote-controls">
          <button class="vote-btn upvote ${restaurant.userVote === 'up' ? 'active' : ''}" data-id="${restaurant.id}" data-vote="up" title="Upvote">
            ▲
          </button>
          <span class="vote-score ${scoreClass}">${restaurant.netScore}</span>
          <button class="vote-btn downvote ${restaurant.userVote === 'down' ? 'active' : ''}" data-id="${restaurant.id}" data-vote="down" title="Downvote">
            ▼
          </button>
        </div>
        
        <div class="restaurant-info">
          <div class="restaurant-name">
            ${restaurant.name}
            ${isNew ? `<span class="new-badge"><span class="sparkle">✨</span> New!</span>` : ''}
          </div>
          <div class="restaurant-meta">
            ${restaurant.cuisine ? `<span class="cuisine-tag">${restaurant.cuisine}</span>` : ''}
            <a href="${getGoogleMapsUrl(restaurant.name)}" target="_blank" rel="noopener" class="restaurant-link">
              📍 Maps
            </a>
          </div>
          ${isNew ? `<div class="suggested-by">Suggested by ${restaurant.suggestedBy}</div>` : ''}
          ${hasNotes ? `
            <div class="notes-preview">
              ${restaurant.notes.slice(0, 2).map(note => `
                <div class="notes-preview-item">
                  <span class="notes-preview-author">${escapeHtml(note.author)}:</span>
                  <span class="notes-preview-text">${escapeHtml(note.text)}</span>
                </div>
              `).join('')}
              ${restaurant.notes.length > 2 ? `<div class="notes-preview-more" data-id="${restaurant.id}">+${restaurant.notes.length - 2} more note${restaurant.notes.length > 3 ? 's' : ''}...</div>` : ''}
            </div>
          ` : ''}
        </div>
        
        <div class="restaurant-actions">
          <button class="note-btn ${hasNotes ? 'has-notes' : ''}" data-id="${restaurant.id}" title="View/Add Notes">
            📝
          </button>
          
          <div class="vote-count">
            <div class="voters-preview">
              <span class="up-count">▲${restaurant.upvotes}</span>
              <span class="down-count">▼${restaurant.downvotes}</span>
            </div>
            <div class="tooltip">
              ${restaurant.upvoters.length > 0 ? `
                <div class="tooltip-section">
                  <div class="tooltip-title">Upvotes</div>
                  <ul class="tooltip-voters upvoters">
                    ${restaurant.upvoters.map(v => `<li>${v}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              ${restaurant.downvoters.length > 0 ? `
                <div class="tooltip-section">
                  <div class="tooltip-title">Downvotes</div>
                  <ul class="tooltip-voters downvoters">
                    ${restaurant.downvoters.map(v => `<li>${v}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              ${restaurant.upvoters.length === 0 && restaurant.downvoters.length === 0 ? `
                <div class="no-voters">No votes yet</div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers for vote buttons
  document.querySelectorAll('.vote-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const voteType = btn.dataset.vote;
      vote(id, voteType);
    });
  });
  
  // Add click handlers for note buttons
  document.querySelectorAll('.note-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openNoteModal(btn);
    });
  });
  
  // Add click handlers for "more notes" links
  document.querySelectorAll('.notes-preview-more').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = link.dataset.id;
      const noteBtn = document.querySelector(`.note-btn[data-id="${id}"]`);
      if (noteBtn) openNoteModal(noteBtn);
    });
  });
  
  // Add click handlers for vote count (to show voters on mobile)
  document.querySelectorAll('.vote-count').forEach(voteCount => {
    voteCount.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close any other open tooltips first
      document.querySelectorAll('.vote-count.active').forEach(other => {
        if (other !== voteCount) other.classList.remove('active');
      });
      // Toggle this one
      voteCount.classList.toggle('active');
    });
  });
}

// Vote for a restaurant
async function vote(restaurantId, voteType) {
  if (!currentUser) {
    nameModal.classList.remove('hidden');
    return;
  }
  
  // Get current vote state
  const upBtn = document.querySelector(`.vote-btn.upvote[data-id="${restaurantId}"]`);
  const downBtn = document.querySelector(`.vote-btn.downvote[data-id="${restaurantId}"]`);
  const currentVote = upBtn.classList.contains('active') ? 'up' : downBtn.classList.contains('active') ? 'down' : null;
  
  // Determine new vote type
  let newVoteType;
  if (currentVote === voteType) {
    // Toggle off
    newVoteType = 'none';
  } else {
    newVoteType = voteType;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, voteType: newVoteType })
    });
    
    if (response.ok) {
      await loadRestaurants();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to vote');
    }
  } catch (error) {
    console.error('Error voting:', error);
  }
}

// Open note modal
function openNoteModal(btn) {
  if (!currentUser) {
    nameModal.classList.remove('hidden');
    return;
  }
  
  const restaurantId = btn.dataset.id;
  const restaurant = restaurantsData.find(r => r.id === restaurantId);
  
  if (!restaurant) return;
  
  currentNoteRestaurant = restaurantId;
  noteRestaurantTitle.textContent = restaurant.name;
  
  // Display existing notes (excluding current user's note)
  const notes = restaurant.notes || [];
  const otherNotes = notes.filter(n => n.author !== currentUser);
  
  if (otherNotes.length > 0) {
    existingNotes.innerHTML = `
      <div class="existing-notes-title">Notes from everyone</div>
      ${otherNotes.map(note => `
        <div class="note-item">
          <div class="note-author">${escapeHtml(note.author)}</div>
          <div class="note-text">${escapeHtml(note.text)}</div>
        </div>
      `).join('')}
    `;
  } else {
    existingNotes.innerHTML = '<div class="no-notes">No notes from others yet.</div>';
  }
  
  // Set user's existing note if any
  const userNote = restaurant.userNote || '';
  noteInput.value = userNote;
  noteInput.placeholder = userNote ? 'Edit your note...' : 'Add your note... (recommendations, dietary info, etc.)';
  
  // Update save button text
  saveNoteBtn.textContent = userNote ? 'Update Note' : 'Save Note';
  
  noteModal.classList.remove('hidden');
  noteInput.focus();
}

// Close note modal
function closeNoteModal() {
  noteModal.classList.add('hidden');
  currentNoteRestaurant = null;
  noteInput.value = '';
}

// Save note
async function saveNote() {
  if (!currentNoteRestaurant) return;
  
  const note = noteInput.value.trim();
  
  try {
    const response = await fetch(`${API_BASE}/api/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: currentNoteRestaurant, note })
    });
    
    if (response.ok) {
      closeNoteModal();
      await loadRestaurants();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to save note');
    }
  } catch (error) {
    console.error('Error saving note:', error);
  }
}

// Suggest new restaurant
async function suggestRestaurant() {
  const name = suggestInput.value.trim();
  const cuisine = suggestCuisineInput.value.trim();
  
  if (!name) {
    suggestInput.focus();
    return;
  }
  
  if (!currentUser) {
    nameModal.classList.remove('hidden');
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, cuisine })
    });
    
    if (response.ok) {
      suggestInput.value = '';
      suggestCuisineInput.value = '';
      await loadRestaurants();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to add suggestion');
    }
  } catch (error) {
    console.error('Error suggesting:', error);
  }
}

// Reset current user's votes
async function resetVotes() {
  if (!currentUser) {
    nameModal.classList.remove('hidden');
    return;
  }
  
  if (!confirm('Are you sure you want to clear all your votes and notes?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/reset`, {
      method: 'POST'
    });
    
    if (response.ok) {
      await loadRestaurants();
    } else {
      const error = await response.json();
      alert(error.error || 'Failed to clear votes');
    }
  } catch (error) {
    console.error('Error resetting:', error);
  }
}

// Event Listeners
setNameBtn.addEventListener('click', setUserName);
userNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') setUserName();
});

changeNameBtn.addEventListener('click', () => {
  userNameInput.value = currentUser || '';
  nameModal.classList.remove('hidden');
  userNameInput.focus();
  userNameInput.select();
});

suggestBtn.addEventListener('click', suggestRestaurant);
suggestInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') suggestRestaurant();
});

resetBtn.addEventListener('click', resetVotes);

// Note modal events
cancelNoteBtn.addEventListener('click', closeNoteModal);
saveNoteBtn.addEventListener('click', saveNote);
noteModal.addEventListener('click', (e) => {
  if (e.target === noteModal) closeNoteModal();
});
noteInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.metaKey) saveNote();
});

// Theme toggle event listeners
document.getElementById('theme-light').addEventListener('click', () => setTheme('light'));
document.getElementById('theme-system').addEventListener('click', () => setTheme('system'));
document.getElementById('theme-dark').addEventListener('click', () => setTheme('dark'));

// Close vote tooltips when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.vote-count')) {
    document.querySelectorAll('.vote-count.active').forEach(el => {
      el.classList.remove('active');
    });
  }
});

// Initialize
init();
