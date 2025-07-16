const { PDFDocument } = require("pdf-lib");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

async function generateFinalSignedPDF(document) {
  if (!document || !document.fileUrl) {
    throw new Error("Invalid document or missing fileUrl");
  }

  // Step 1: Fetch original PDF
  const existingPdfBytes = await fetch(document.fileUrl).then((res) =>
    res.arrayBuffer()
  );

  // Step 2: Load PDF document
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  // Step 3: Embed each signature
  for (const field of document.fields) {
    if (field.type === "signature" && field.signedData?.data) {
      try {
        const pngImageBytes = Buffer.from(
          field.signedData.data.split(",")[1],
          "base64"
        );
        const pngImage = await pdfDoc.embedPng(pngImageBytes);
        const page = pdfDoc.getPage(field.pageNumber - 1); // 0-indexed

        page.drawImage(pngImage, {
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
        });
      } catch (err) {
        console.error(`Error embedding signature for field ${field.id}:`, err);
      }
    }
  }

  // Step 4: Serialize PDF to bytes
  return await pdfDoc.save();
}

module.exports = generateFinalSignedPDF;
