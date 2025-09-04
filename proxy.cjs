const express = require("express");
const cors = require("cors");

// Richtiger Import für node-fetch in CommonJS:
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

app.post("/proxy/unrank", async (req, res) => {
  const response = await fetch("https://hitbloq.com/api/pools/unrank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  });
  const text = await response.text();
  console.log("Hitbloq Response:", text);
  try {
    const data = JSON.parse(text);
    res.json(data);
  } catch (e) {
    res.status(500).send(text);
  }
});

app.get("/proxy/map_pools_detailed", async (req, res) => {
  const response = await fetch("https://hitbloq.com/api/map_pools_detailed");
  const text = await response.text();
  console.log("Hitbloq Response:", text);
  try {
    const data = JSON.parse(text);
    res.json(data);
  } catch (e) {
    res.status(500).send(text);
  }
});

app.get("/proxy/ranked_list_detailed/:pool_id/:page", async (req, res) => {
  const { pool_id, page } = req.params;
  const url = `https://hitbloq.com/api/ranked_list_detailed/${pool_id}/${page}`;
  const response = await fetch(url);
  const text = await response.text();
  console.log("Hitbloq Response:", text);
  try {
    const data = JSON.parse(text);
    res.json(data);
  } catch (e) {
    res.status(500).send(text);
  }
});

app.listen(3001, () => console.log("Proxy läuft auf Port 3001"));