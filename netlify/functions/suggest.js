const { getStore } = require("@netlify/blobs");

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
  
  const cookies = parseCookies(event.headers.cookie);
  const visitorId = cookies.visitorId;
  
  if (!visitorId) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Please set your name first' }) };
  }
  
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  
  const { name, cuisine } = body;
  
  if (!name || !name.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Restaurant name is required' }) };
  }
  
  const store = getStore("food-selector");
  const data = await getData(store);
  
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  if (data.restaurants.find(r => r.id === id)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'This restaurant already exists!' }) };
  }
  
  const newRestaurant = {
    id,
    name: name.trim(),
    cuisine: cuisine?.trim() || null,
    isDefault: false,
    suggestedBy: visitorId,
    suggestedAt: new Date().toISOString()
  };
  
  data.restaurants.push(newRestaurant);
  
  if (!data.votes[visitorId]) {
    data.votes[visitorId] = {};
  }
  data.votes[visitorId][id] = 'up';
  
  await store.setJSON("food-selector-data", data);
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, restaurant: newRestaurant })
  };
};

