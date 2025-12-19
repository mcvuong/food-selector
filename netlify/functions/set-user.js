const { getStore } = require("@netlify/blobs");

// Default restaurants
const defaultRestaurants = [
  { id: 'bishop-quigley', name: 'Bishop Quigley', cuisine: 'Gastropub', isDefault: true },
  { id: 'taste-of-poland', name: 'Taste of Poland', cuisine: 'Polish', isDefault: true },
  { id: 'notes-of-marrakesh', name: 'Notes of Marrakesh', cuisine: 'Moroccan', isDefault: true },
  { id: 'arepa-bar', name: 'Arepa Bar', cuisine: 'Venezuelan', isDefault: true },
  { id: 'chengdu', name: 'Chengdu', cuisine: 'Sichuan Chinese', isDefault: true },
  { id: 'wildflower-cafe', name: 'Wildflower Cafe', cuisine: 'Cafe', isDefault: true },
  { id: 'oak-hart-bbq', name: 'Oak Hart BBQ', cuisine: 'BBQ', isDefault: true }
];

async function getData(store) {
  try {
    const data = await store.get("food-selector-data", { type: "json" });
    if (data) {
      if (!data.notes) data.notes = {};
      return data;
    }
  } catch (e) {}
  
  const initialData = { restaurants: defaultRestaurants, votes: {}, notes: {} };
  await store.setJSON("food-selector-data", initialData);
  return initialData;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) cookies[name] = decodeURIComponent(value);
    });
  }
  return cookies;
}

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  
  try {
    const store = getStore("food-selector");
  const cookies = parseCookies(event.headers.cookie);
  const oldName = cookies.visitorId;
  
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  
  const { name } = body;
  if (!name || !name.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Name is required' }) };
  }
  
  const trimmedName = name.trim();
  const data = await getData(store);
  
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
    data.restaurants.forEach(r => {
      if (r.suggestedBy === oldName) r.suggestedBy = trimmedName;
    });
    await store.setJSON("food-selector-data", data);
  }
  
  // Set cookie
  const cookieValue = `visitorId=${encodeURIComponent(trimmedName)}; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`;
  
  return {
    statusCode: 200,
    headers: {
      ...headers,
      'Set-Cookie': cookieValue
    },
    body: JSON.stringify({ success: true, name: trimmedName })
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

