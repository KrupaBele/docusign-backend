require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const slugify = require("slugify");
const signaturesRoute = require("./routes/signatures");
const SignatureRequest = require("./models/SignatureRequest");
const generateSignedPDF = require("./utils/generateSignedPDF");

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
// Replace the simple cors() with explicit origins
const corsOptions = {
  origin: [
    "https://docusign-frontend-tawny.vercel.app", // Your production frontend
    "http://localhost:5173", // Local development
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());

// Serve uploaded files
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/templates", require("./routes/templates"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/signatures", signaturesRoute);

app.get("/api/status", (req, res) => {
  res.send("Server running successfully!");
});

// 🔹 SIGN DOCUMENT AND GENERATE FINAL SIGNED PDF
app.post("/api/signatures/:id/sign", async (req, res) => {
  const { id } = req.params;
  const { recipientId, fields } = req.body;

  try {
    const document = await SignatureRequest.findById(id);
    if (!document) return res.status(404).json({ error: "Document not found" });

    // Update all fields with the new signature data
    document.fields = fields.map((field) => {
      const existingField = document.fields.find((f) => f.id === field.id);
      return existingField ? { ...existingField, ...field } : field;
    });

    // Update recipient status
    const recipient = document.recipients.find(
      (r) => r._id.toString() === recipientId
    );
    if (recipient) recipient.signed = true;

    // Check if all recipients have signed
    const allSigned = document.recipients.every((r) => r.signed);

    // Save the document updates regardless of signing status
    await document.save();

    if (allSigned) {
      // Generate PDF only after all fields are properly updated
      const pdfBytes = await generateSignedPDF(document._id);

      if (!pdfBytes) {
        throw new Error("Failed to generate PDF");
      }

      const fileName = `${slugify(document.documentTitle)}_signed.pdf`;
      const filePath = path.join(__dirname, "uploads", fileName);

      if (!fs.existsSync(path.join(__dirname, "uploads"))) {
        fs.mkdirSync(path.join(__dirname, "uploads"));
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw", // important for PDF
          public_id: `signed_docs/${slugify(document.documentTitle)}_signed`,
          format: "pdf",
        },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return res.status(500).json({ error: "Cloudinary upload failed" });
          }

          // Update document with final signed version
          document.fileUrl = result.secure_url;
          document.status = "completed";
          await document.save();

          res.json({
            message: "Document signed and uploaded",
            fileUrl: result.secure_url,
          });
        }
      );

      // pipe pdfBytes to Cloudinary upload stream
      const bufferStream = require("streamifier").createReadStream(pdfBytes);
      bufferStream.pipe(uploadStream);

      document.status = "completed";
      await document.save();
    } else {
      res.json(document);
    }
  } catch (err) {
    console.error("Error signing document:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: true,
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
