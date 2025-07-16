const mongoose = require("mongoose");

const SignatureRequestSchema = new mongoose.Schema({
  documentTitle: String,
  documentContent: String,
  subject: String,
  message: String,
  fileUrl: String,
  fileType: String,
  fields: Array,
  recipients: [
    {
      name: String,
      email: String,
      role: String,
      signed: { type: Boolean, default: false },
      signedAt: Date,
    },
  ],
  status: {
    type: String,
    enum: ["draft", "sent", "viewed", "signed", "completed"],
    default: "sent",
  },
  sentAt: Date,
});

module.exports = mongoose.model("SignatureRequest", SignatureRequestSchema);
