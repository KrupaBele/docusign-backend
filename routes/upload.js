const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// Configure multer to store files in "uploads/" directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // folder name
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${file.originalname}`;
    cb(null, filename);
  },
});

const upload = multer({ storage });

// POST /api/upload
router.post("/", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;

  // Return both fileUrl and fileType
  res.status(200).json({
    fileUrl,
    protocol: req.protocol,
    fileType: req.file.mimetype, // This should be automatically detected by multer
  });
});

module.exports = router;
