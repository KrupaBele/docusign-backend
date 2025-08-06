const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const SignatureRequest = require("../models/SignatureRequest");
const slugify = require("slugify");

async function generateSignedPDF(documentId) {
  try {
    console.log(`\n=== Starting PDF generation for document ${documentId} ===`);

    const request = await SignatureRequest.findById(documentId);
    if (!request) throw new Error("Document not found");

    console.log(`\ud83d\udcc4 Document Title: ${request.documentTitle}`);
    console.log(`\ud83d\udccc File URL: ${request.fileUrl}`);
    console.log(`\ud83d\uddd8\ufe0f File Type: ${request.fileType}`);
    console.log(`\ud83d\uddd8\ufe0f Total fields: ${request.fields.length}`);

    let pdfDoc;
    let pages = [];

    if (request.fileType === "text/plain") {
      console.log("📝 Creating new PDF from text content");
      pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const title = request.documentTitle || "Untitled Document";

      // Draw the document title at the top
      page.drawText(title, {
        x: 50,
        y: 820,
        size: 18,
        font,
        color: rgb(0, 0, 0),
      });

      const lines = (request.documentContent || "").split("\n");
      let y = 800 - 30; // Slightly lower to give space after the title

      for (const line of lines) {
        page.drawText(line, {
          x: 50,
          y,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
        y -= 18;
        if (y < 50) break;
      }

      pages = pdfDoc.getPages();
    } else {
      // Handle regular PDF files
      const existingPdfBytes = await fetch(request.fileUrl).then((res) =>
        res.arrayBuffer()
      );
      pdfDoc = await PDFDocument.load(existingPdfBytes);
      pages = pdfDoc.getPages();
    }

    const signedFields = request.fields.filter((f) => f.signedData);
    let successfullyAdded = 0;

    for (const field of signedFields) {
      const pageIndex = (field.pageNumber || 1) - 1;
      if (pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Scale coordinates if renderedWidth/renderedHeight are present
      const useScaling = field.renderedWidth && field.renderedHeight;

      const normalizedX = useScaling
        ? (field.x / field.renderedWidth) * pageWidth
        : field.x;

      const normalizedY = useScaling
        ? (field.y / field.renderedHeight) * pageHeight
        : field.y;

      const yOnPage = normalizedY - pageIndex * pageHeight;
      let adjustedY = pageHeight - yOnPage - field.height / 2;
      let adjustedX = normalizedX;

      // Clip to avoid out-of-bound placement
      //  adjustedX = Math.min(adjustedX, pageWidth - field.width);
      //  adjustedY = Math.max(0, Math.min(adjustedY, pageHeight - field.height));
      // Only clip if actually overflowing
      if (adjustedX < 0) {
        adjustedX = 0;
      } else if (adjustedX + field.width > pageWidth) {
        adjustedX = pageWidth - field.width;
      }

      if (adjustedY < 0) {
        adjustedY = 0;
      } else if (adjustedY + field.height > pageHeight) {
        adjustedY = pageHeight;
      }

      try {
        if (
          field.signedData.type === "draw" ||
          field.signedData.type === "upload"
        ) {
          const base64Data = field.signedData.data?.split(",")[1];
          if (!base64Data) continue;

          const imageBytes = Buffer.from(base64Data, "base64");
          let image;

          if (field.signedData.data.startsWith("data:image/png")) {
            image = await pdfDoc.embedPng(imageBytes);
          } else if (
            field.signedData.data.startsWith("data:image/jpeg") ||
            field.signedData.data.startsWith("data:image/jpg")
          ) {
            image = await pdfDoc.embedJpg(imageBytes);
          } else {
            image = await pdfDoc.embedPng(imageBytes);
          }

          const isTextFile = request.fileType === "text/plain";
          const isNarrowPDF =
            field.renderedWidth &&
            field.renderedHeight &&
            field.renderedWidth < field.renderedHeight;
          const shouldNotShift = isNarrowPDF
            ? field.x - 100 > field.renderedWidth
            : field.x + 30 > field.renderedWidth;

          const isWideRender =
            field.renderedWidth && field.renderedWidth > 1000;

          page.drawImage(image, {
            x: isTextFile
              ? adjustedX
              : isWideRender
              ? field.x - field.width
              : shouldNotShift
              ? adjustedX
              : isNarrowPDF
              ? field.x - field.width - 200
              : field.x - field.width - 100,
            y: adjustedY,
            width: field.width,
            height: field.height,
            opacity: 1,
          });

          successfullyAdded++;
        } else if (field.signedData.type === "type") {
          const isTextFile = request.fileType === "text/plain";
          const isNarrowPDF =
            field.renderedWidth &&
            field.renderedHeight &&
            field.renderedWidth < field.renderedHeight;
          const shouldNotShift = isNarrowPDF
            ? field.x - 100 > field.renderedWidth
            : field.x + 30 > field.renderedWidth;

          const isWideRender =
            field.renderedWidth && field.renderedWidth > 1000;
          const { text } = JSON.parse(field.signedData.data);
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const fontSize = Math.min(field.height * 0.7, 14);
          page.drawText(text, {
            x: isTextFile
              ? adjustedX
              : isWideRender
              ? field.x - field.width / 2
              : shouldNotShift
              ? adjustedX + field.width / 2
              : isNarrowPDF
              ? field.x - field.width / 2 - 200
              : field.x - field.width / 2 - 100,
            y: adjustedY + field.height / 2,
            size: fontSize,
            font,
          });
          successfullyAdded++;
        }
      } catch (err) {
        console.error(`❌ Error placing signature:`, err);
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        page.drawText("SIGNATURE", {
          x: adjustedX,
          y: adjustedY + field.height / 2,
          size: Math.min(field.height * 0.6, 12),
          font,
        });
        successfullyAdded++;
      }
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (err) {
    console.error("❌ Fatal error in PDF generation:", err);
    throw err;
  }
}

module.exports = generateSignedPDF;
