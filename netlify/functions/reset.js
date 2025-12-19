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
  
  const store = getStore("food-selector");
  const data = await getData(store);
  
  let changed = false;
  
  if (data.votes[visitorId]) {
    delete data.votes[visitorId];
    changed = true;
  }
  
  if (data.notes[visitorId]) {
    delete data.notes[visitorId];
    changed = true;
  }
  
  if (changed) {
    await store.setJSON("food-selector-data", data);
  }
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true })
  };
};

