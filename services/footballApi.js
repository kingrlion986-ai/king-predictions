const fetch = require("node-fetch");

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

async function apiGet(endpoint) {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "X-Auth-Token": API_KEY
      }
    });

    if (!res.ok) {
      console.log(`API ERROR ${res.status} on ${endpoint}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.log("FOOTBALL API ERROR:", err.message);
    return null;
  }
}

async function getMatches() {
  const data = await apiGet("/matches");
  return data?.matches || [];
}

async function getTeamRecentMatches(teamId, limit = 5) {
  const data = await apiGet(`/teams/${teamId}/matches?status=FINISHED&limit=${limit}`);
  return data?.matches || [];
}

module.exports = {
  getMatches,
  getTeamRecentMatches
};
