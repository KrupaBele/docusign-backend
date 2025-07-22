const express = require("express");
const router = express.Router();
const SignatureRequest = require("../models/SignatureRequest");
const nodemailer = require("nodemailer");
// const generateFinalSignedPDF = require("../utils/generateFinalSignedPDF");
const generateSignedPDF = require("../utils/generateSignedPDF");

const transporter = nodemailer.createTransport({
  service: "gmail", // ✅ Required for Gmail
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post("/send", async (req, res) => {
  try {
    const {
      recipients,
      documentTitle,
      documentContent,
      fields,
      fileUrl,
      fileType, // Make sure this is being sent from the frontend
      subject,
      message,
    } = req.body;

    // Ensure fileType is set properly
    const finalFileType = fileType || "application/pdf"; // Default to PDF if not specified

    const savedRequest = await new SignatureRequest({
      recipients,
      documentTitle,
      documentContent,
      subject,
      message,
      fileUrl,
      fileType: finalFileType, // Use the determined file type
      fields,
      status: "sent",
      sentAt: new Date(),
    }).save();

    // THEN attempt to send email
    let emailErrors = 0;

    await Promise.all(
      recipients.map(async (recipient) => {
        const signLink = `https://docusign-frontend-tawny.vercel.app/sign/${
          savedRequest._id
        }?recipient=${encodeURIComponent(recipient.email)}`;

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: recipient.email,
          subject: subject || "Please Sign Document",
          html: `
            <p>Hello ${recipient.name},</p>
            <p>${message || "You have a document pending your signature."}</p>
            <p><a href="${signLink}">Click here to sign</a></p>
          `,
        };

        try {
          await transporter.sendMail(mailOptions);
          console.log(`✅ Email sent to ${recipient.email}`);
        } catch (emailErr) {
          emailErrors++;
          console.error(
            `❌ Failed to send to ${recipient.email}:`,
            emailErr.message
          );
        }
      })
    );

    // If email errors occurred, return partial success
    if (emailErrors > 0) {
      return res.status(207).json({
        success: false,
        error: `Failed to send to ${emailErrors} recipient(s).`,
        id: savedRequest._id,
      });
    }

    // Success
    res.status(200).json({ success: true, id: savedRequest._id });
  } catch (err) {
    console.error("❌ Signature send failed:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const request = await SignatureRequest.findById(req.params.id);
    if (!request) {
      return res.status(403).json({
        error: `document ${req.params.id} : ${JSON.stringify(request)}`,
      });
    }

    // If it's a text document and no fileUrl exists, ensure documentContent is included
    if (
      request.fileType === "text/plain" &&
      !request.fileUrl &&
      !request.documentContent
    ) {
      request.documentContent = "Default document text"; // Or fetch from another source
    }

    res.status(200).json(request);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/signatures/:id/sign
// Modify the POST /api/signatures/:id/sign endpoint
router.post("/api/signatures/:id/sign", async (req, res) => {
  try {
    const { recipientId, fields } = req.body;
    const signatureRequest = await SignatureRequest.findById(req.params.id);

    if (!signatureRequest) {
      return res.status(404).json({ message: "Signature request not found" });
    }

    // Update existing fields and add new ones
    fields.forEach((newField) => {
      const existingFieldIndex = signatureRequest.fields.findIndex(
        (f) => f.id === newField.id && f.recipientId === newField.recipientId
      );

      if (existingFieldIndex >= 0) {
        signatureRequest.fields[existingFieldIndex] = {
          ...signatureRequest.fields[existingFieldIndex].toObject(),
          ...newField,
        };
      } else {
        signatureRequest.fields.push(newField);
      }
    });

    // Update recipient status
    const recipient = signatureRequest.recipients.find(
      (r) => r._id.toString() === recipientId
    );
    if (recipient?.signed) {
      return res.status(400).json({
        success: false,
        message: "You have already signed this document.",
      });
    }

    if (recipient) {
      recipient.signed = true;
    }

    // Check if all recipients signed
    const allSigned = signatureRequest.recipients.every((r) => r.signed);
    if (allSigned) {
      signatureRequest.status = "completed";

      // Generate final signed document with ALL fields
      // Use generateSignedPDF instead of generateFinalSignedPDF
      const pdfBytes = await generateSignedPDF(signatureRequest._id);
      const fileName = `${slugify(signatureRequest.documentTitle)}_signed`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          public_id: `signed_pdfs/${fileName}`,
          format: "pdf",
        },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return res
              .status(500)
              .json({ message: "Cloudinary upload failed" });
          }

          signatureRequest.fileUrl = result.secure_url;
          await signatureRequest.save();

          return res.json({
            success: true,
            message: "Signed successfully",
            fileUrl: signatureRequest.fileUrl,
          });
        }
      );

      streamifier.createReadStream(pdfBytes).pipe(uploadStream);
    }

    await signatureRequest.save();
    return res.json({
      success: true,
      message: "Signed successfully",
      fileUrl: signatureRequest.fileUrl,
    });
  } catch (err) {
    console.error("Error saving signed fields:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/signatures - Fetch all signature requests (most recent first)
router.get("/", async (req, res) => {
  try {
    const requests = await SignatureRequest.find().sort({ sentAt: -1 });
    res.status(200).json(requests);
  } catch (err) {
    console.error("❌ Error fetching all signature requests:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
