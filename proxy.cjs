const express = require("express");
const cors = require("cors");

// Richtiger Import für node-fetch in CommonJS:
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
app.use(cors());
app.use(express.json());

app.post("/proxy/unrank", async (req, res) => {
  console.log("Proxying:", "POST https://hitbloq.com/api/pools/unrank", req.body);
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

app.post("/proxy/rank", async (req, res) => {
  console.log("Proxying:", "POST https://hitbloq.com/api/pools/rank", req.body);
  const response = await fetch("https://hitbloq.com/api/pools/rank", {
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
  const url = "https://hitbloq.com/api/map_pools_detailed";
  console.log("Proxying:", "GET", url);
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

app.get("/proxy/ranked_list_detailed/:pool_id/:page", async (req, res) => {
  const { pool_id, page } = req.params;
  const url = `https://hitbloq.com/api/ranked_list_detailed/${pool_id}/${page}`;
  console.log("Proxying:", "GET", url);
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

app.post("/proxy/recalculate_cr", async (req, res) => {
  console.log("Proxying:", "POST https://hitbloq.com/api/pools/recalculate_cr", req.body);
  const response = await fetch("https://hitbloq.com/api/pools/recalculate_cr", {
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

app.post("/proxy/set_manual", async (req, res) => {
  console.log("Proxying:", "POST https://hitbloq.com/api/pools/set_manual", req.body);
  const response = await fetch("https://hitbloq.com/api/pools/set_manual", {
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

app.post("/proxy/set_automatic", async (req, res) => {
  console.log("Proxying:", "POST https://hitbloq.com/api/pools/set_automatic", req.body);
  const response = await fetch("https://hitbloq.com/api/pools/set_automatic", {
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

app.listen(3001, () => console.log("Proxy läuft auf Port 3001"));