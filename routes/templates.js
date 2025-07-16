const express = require("express");
const router = express.Router();
const Template = require("../models/Template");

// POST: Save template
router.post("/", async (req, res) => {
  try {
    const template = new Template(req.body);
    const saved = await template.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: List all templates
router.get("/", async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
