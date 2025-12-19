const { getStore } = require("@netlify/blobs");

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

// Helper to get or initialize data
async function getData(store) {
  try {
    const data = await store.get("food-selector-data", { type: "json" });
    if (data) {
      if (!data.notes) data.notes = {};
      return data;
    }
  } catch (e) {
    // Data doesn't exist yet
  }
  
  // Initialize with defaults
  const initialData = {
    restaurants: defaultRestaurants,
    votes: {},
    notes: {}
  };
  await store.setJSON("food-selector-data", initialData);
  return initialData;
}

// Helper to save data
async function saveData(store, data) {
  await store.setJSON("food-selector-data", data);
}

// Parse cookies from header
function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  try {
    const store = getStore({
      name: "food-selector",
      siteID: process.env.MY_SITE_ID,
      token: process.env.NETLIFY_AUTH_TOKEN
    });
    const cookies = parseCookies(event.headers.cookie);
    const visitorId = cookies.visitorId;
  
  if (event.httpMethod === 'GET') {
    const data = await getData(store);
    
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
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        restaurants: restaurantsWithVotes,
        currentUser: visitorId || null
      })
    };
  }
  
  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
};

