const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'data', 'votes.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Default restaurants with cuisine types
const defaultRestaurants = [
  { id: 'bishop-quigley', name: 'Bishop Quigley', cuisine: 'Gastropub', isDefault: true },
  { id: 'taste-of-poland', name: 'Taste of Poland', cuisine: 'Polish', isDefault: true },
  { id: 'notes-of-marrakesh', name: 'Notes of Marrakesh', cuisine: 'Moroccan', isDefault: true },
  { id: 'arepa-bar', name: 'Arepa Bar', cuisine: 'Venezuelan', isDefault: true },
  { id: 'chengdu', name: 'Chengdu', cuisine: 'Sichuan Chinese', isDefault: true },
  { id: 'wildflower-cafe', name: 'Wildflower Cafe', cuisine: 'Cafe', isDefault: true },
  { id: 'oak-hart-bbq', name: 'Oak Hart BBQ', cuisine: 'BBQ', isDefault: true }
];

// Initialize or load data
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // Migrate old vote format if needed
      if (!data.notes) data.notes = {};
      
      // Add cuisine types to existing restaurants if missing
      data.restaurants.forEach(r => {
        const defaultR = defaultRestaurants.find(d => d.id === r.id);
        if (defaultR && !r.cuisine) {
          r.cuisine = defaultR.cuisine;
        }
      });
      
      return data;
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
  
  // Initialize with defaults
  const initialData = {
    restaurants: defaultRestaurants,
    votes: {},  // { visitorId: { restaurantId: 'up' | 'down' } }
    notes: {}   // { visitorId: { restaurantId: 'note text' } }
  };
  saveData(initialData);
  return initialData;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get all restaurants and votes
app.get('/api/restaurants', (req, res) => {
  const data = loadData();
  const visitorId = req.cookies.visitorId;
  
  // Calculate vote counts and voters for each restaurant
  const restaurantsWithVotes = data.restaurants.map(restaurant => {
    const upvoters = [];
    const downvoters = [];
    const allNotes = [];
    
    // Collect votes
    Object.entries(data.votes).forEach(([visitorName, votes]) => {
      if (votes[restaurant.id] === 'up') {
        upvoters.push(visitorName);
      } else if (votes[restaurant.id] === 'down') {
        downvoters.push(visitorName);
      }
    });
    
    // Collect notes
    Object.entries(data.notes).forEach(([visitorName, notes]) => {
      if (notes[restaurant.id]) {
        allNotes.push({ author: visitorName, text: notes[restaurant.id] });
      }
    });
    
    const netScore = upvoters.length - downvoters.length;
    
    // Get current user's vote and note
    let userVote = null;
    let userNote = null;
    if (visitorId) {
      userVote = data.votes[visitorId]?.[restaurant.id] || null;
      userNote = data.notes[visitorId]?.[restaurant.id] || null;
    }
    
    return {
      ...restaurant,
      upvotes: upvoters.length,
      downvotes: downvoters.length,
      netScore,
      upvoters,
      downvoters,
      notes: allNotes,
      userVote,
      userNote
    };
  });
  
  // Sort by net score (descending), then by name
  restaurantsWithVotes.sort((a, b) => {
    if (b.netScore !== a.netScore) return b.netScore - a.netScore;
    return a.name.localeCompare(b.name);
  });
  
  res.json({
    restaurants: restaurantsWithVotes,
    currentUser: visitorId || null
  });
});

// Set user name (stored in cookie)
app.post('/api/set-user', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const trimmedName = name.trim();
  const data = loadData();
  const oldName = req.cookies.visitorId;
  
  // If user is changing their name, transfer their votes and notes
  if (oldName && oldName !== trimmedName) {
    if (data.votes[oldName]) {
      data.votes[trimmedName] = data.votes[oldName];
      delete data.votes[oldName];
    }
    if (data.notes[oldName]) {
      data.notes[trimmedName] = data.notes[oldName];
      delete data.notes[oldName];
    }
    
    // Also update any restaurant suggestions
    data.restaurants.forEach(r => {
      if (r.suggestedBy === oldName) {
        r.suggestedBy = trimmedName;
      }
    });
    
    saveData(data);
  }
  
  res.cookie('visitorId', trimmedName, { 
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: false 
  });
  res.json({ success: true, name: trimmedName });
});

// Vote for a restaurant (upvote or downvote)
app.post('/api/vote', (req, res) => {
  const { restaurantId, voteType } = req.body; // voteType: 'up', 'down', or 'none'
  const visitorId = req.cookies.visitorId;
  
  if (!visitorId) {
    return res.status(401).json({ error: 'Please set your name first' });
  }
  
  if (!['up', 'down', 'none'].includes(voteType)) {
    return res.status(400).json({ error: 'Invalid vote type' });
  }
  
  const data = loadData();
  
  // Check if restaurant exists
  const restaurant = data.restaurants.find(r => r.id === restaurantId);
  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }
  
  // Initialize votes for this user if needed
  if (!data.votes[visitorId]) {
    data.votes[visitorId] = {};
  }
  
  // Set or remove vote
  if (voteType === 'none') {
    delete data.votes[visitorId][restaurantId];
  } else {
    data.votes[visitorId][restaurantId] = voteType;
  }
  
  saveData(data);
  res.json({ success: true });
});

// Add or update a note
app.post('/api/note', (req, res) => {
  const { restaurantId, note } = req.body;
  const visitorId = req.cookies.visitorId;
  
  if (!visitorId) {
    return res.status(401).json({ error: 'Please set your name first' });
  }
  
  const data = loadData();
  
  // Check if restaurant exists
  const restaurant = data.restaurants.find(r => r.id === restaurantId);
  if (!restaurant) {
    return res.status(404).json({ error: 'Restaurant not found' });
  }
  
  // Initialize notes for this user if needed
  if (!data.notes[visitorId]) {
    data.notes[visitorId] = {};
  }
  
  // Set or remove note
  if (!note || !note.trim()) {
    delete data.notes[visitorId][restaurantId];
  } else {
    data.notes[visitorId][restaurantId] = note.trim();
  }
  
  saveData(data);
  res.json({ success: true });
});

// Suggest a new restaurant
app.post('/api/suggest', (req, res) => {
  const { name, cuisine } = req.body;
  const visitorId = req.cookies.visitorId;
  
  if (!visitorId) {
    return res.status(401).json({ error: 'Please set your name first' });
  }
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Restaurant name is required' });
  }
  
  const data = loadData();
  
  // Generate ID from name
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  // Check if already exists
  if (data.restaurants.find(r => r.id === id)) {
    return res.status(400).json({ error: 'This restaurant already exists!' });
  }
  
  // Add new restaurant
  const newRestaurant = {
    id,
    name: name.trim(),
    cuisine: cuisine?.trim() || null,
    isDefault: false,
    suggestedBy: visitorId,
    suggestedAt: new Date().toISOString()
  };
  
  data.restaurants.push(newRestaurant);
  
  // Auto-upvote for the suggester
  if (!data.votes[visitorId]) {
    data.votes[visitorId] = {};
  }
  data.votes[visitorId][id] = 'up';
  
  saveData(data);
  res.json({ success: true, restaurant: newRestaurant });
});

// Reset current user's votes and notes
app.post('/api/reset', (req, res) => {
  const visitorId = req.cookies.visitorId;
  
  if (!visitorId) {
    return res.status(401).json({ error: 'Please set your name first' });
  }
  
  const data = loadData();
  let changed = false;
  
  // Delete this user's votes
  if (data.votes[visitorId]) {
    delete data.votes[visitorId];
    changed = true;
  }
  
  // Delete this user's notes
  if (data.notes[visitorId]) {
    delete data.notes[visitorId];
    changed = true;
  }
  
  if (changed) {
    saveData(data);
  }
  
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`🍕 Food Selector running at http://localhost:${PORT}`);
});
