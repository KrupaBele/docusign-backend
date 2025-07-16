const mongoose = require("mongoose");

const FieldSchema = new mongoose.Schema({
  id: String,
  type: String,
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  recipientId: String,
  required: Boolean,
  pageNumber: Number,
  signedData: mongoose.Schema.Types.Mixed,
});

const RecipientSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  role: String,
});

const TemplateSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  content: String,
  fields: [FieldSchema],
  recipients: [RecipientSchema],
  fileUrl: String,
  fileType: { type: String, required: true }, // Make it required
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Template", TemplateSchema);
