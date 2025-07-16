// const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
// const fetch = require("node-fetch");
// const fs = require("fs");
// const path = require("path");
// const SignatureRequest = require("../models/SignatureRequest");
// const slugify = require("slugify");

// async function generateSignedPDF(documentId) {
//   try {
//     console.log(`\n=== Starting PDF generation for document ${documentId} ===`);

//     const request = await SignatureRequest.findById(documentId);
//     if (!request) throw new Error("Document not found");

//     console.log(`📄 Document Title: ${request.documentTitle}`);
//     console.log(`📎 File URL: ${request.fileUrl}`);
//     console.log(`📝 File Type: ${request.fileType}`);
//     console.log(`📝 Total fields: ${request.fields.length}`);

//     let pdfDoc;
//     const existingPdfBytes = await fetch(request.fileUrl).then((res) =>
//       res.arrayBuffer()
//     );
//     pdfDoc = await PDFDocument.load(existingPdfBytes);

//     const pages = pdfDoc.getPages();
//     console.log(`📑 PDF has ${pages.length} page(s)`);

//     // Log all fields first
//     console.log("🔍 All fields:");
//     request.fields.forEach((field, index) => {
//       console.log(
//         `   ${index + 1}. ID: ${field.id}, Type: ${
//           field.type
//         }, Signed: ${!!field.signedData}, Page: ${field.pageNumber || 1}`
//       );
//     });

//     const signedFields = request.fields.filter((f) => f.signedData);
//     console.log(`✍️ Signed fields found: ${signedFields.length}`);

//     let successfullyAdded = 0;

//     for (const [index, field] of signedFields.entries()) {
//       console.log(`\n🔄 Processing field ${index + 1}:`);
//       console.log(`   - Field ID: ${field.id}`);
//       console.log(`   - Recipient: ${field.recipientId}`);
//       console.log(`   - Type: ${field.type}`);
//       console.log(`   - Page: ${field.pageNumber || 1}`);
//       console.log(`   - Position: (x=${field.x}, y=${field.y})`);
//       console.log(`   - Dimensions: ${field.width}×${field.height}`);

//       try {
//         const pageIndex = (field.pageNumber || 1) - 1;
//         if (pageIndex >= pages.length) {
//           console.warn("⚠️ Page index out of bounds - skipping");
//           continue;
//         }

//         const page = pages[pageIndex];
//         const { width: pageWidth, height: pageHeight } = page.getSize();

//         let yOnPage;
//         const currentPageNumber = field.pageNumber || 1;

//         // Adjust Y assuming field.y is relative to entire document height
//         yOnPage = field.y - (currentPageNumber - 1) * pageHeight;

//         if (yOnPage < 0 || yOnPage > pageHeight) {
//           console.warn(
//             `⚠️ Computed yOnPage (${yOnPage}) is out of bounds for page height ${pageHeight}`
//           );
//           continue;
//         }

//         const adjustedY = pageHeight - yOnPage - field.height;

//         console.log(`   - Page dimensions: ${pageWidth}×${pageHeight}`);
//         console.log(`   - Adjusted Y: ${adjustedY}`);

//         if (field.signedData) {
//           // Handle signature image
//           if (
//             field.signedData.type === "draw" ||
//             field.signedData.type === "upload"
//           ) {
//             const base64Data = field.signedData.data.split(",")[1];
//             if (!base64Data) {
//               console.warn("⚠️ Invalid image data - skipping");
//               continue;
//             }

//             const imageBytes = Buffer.from(base64Data, "base64");
//             let image;

//             try {
//               if (field.signedData.data.startsWith("data:image/png")) {
//                 image = await pdfDoc.embedPng(imageBytes);
//               } else if (
//                 field.signedData.data.startsWith("data:image/jpeg") ||
//                 field.signedData.data.startsWith("data:image/jpg")
//               ) {
//                 image = await pdfDoc.embedJpg(imageBytes);
//               } else {
//                 // Default to PNG if format not specified
//                 image = await pdfDoc.embedPng(imageBytes);
//               }

//               page.drawImage(image, {
//                 x: field.x,
//                 y: adjustedY,
//                 width: field.width,
//                 height: field.height,
//                 opacity: 1,
//               });

//               console.log("✅ Signature added successfully");
//               successfullyAdded++;
//             } catch (err) {
//               console.error("Error embedding image:", err);
//               // Fallback to text signature
//               const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
//               page.drawText("SIGNATURE", {
//                 x: field.x,
//                 y: adjustedY + field.height / 2,
//                 size: Math.min(field.height * 0.6, 12),
//                 font,
//               });
//               console.log("✅ Fallback text signature added");
//               successfullyAdded++;
//             }
//           }
//           // Handle typed signatures
//           else if (field.signedData.type === "type") {
//             try {
//               const { text, font: fontFamily } = JSON.parse(
//                 field.signedData.data
//               );
//               const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
//               const fontSize = Math.min(field.height * 0.7, 14);

//               page.drawText(text, {
//                 x: field.x,
//                 y: adjustedY + (field.height - fontSize) / 2,
//                 size: fontSize,
//                 font,
//               });
//               console.log("✅ Typed signature added successfully");
//               successfullyAdded++;
//             } catch (err) {
//               console.error("Error with typed signature:", err);
//               const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
//               page.drawText("SIGNATURE", {
//                 x: field.x,
//                 y: adjustedY + field.height / 2,
//                 size: Math.min(field.height * 0.6, 12),
//                 font,
//               });
//               console.log("✅ Fallback text signature added");
//               successfullyAdded++;
//             }
//           }
//         }
//       } catch (err) {
//         console.error(`❌ Error processing field ${field.id}:`, err);
//       }
//     }

//     console.log(`\n📊 Results:`);
//     console.log(`   - Total fields processed: ${signedFields.length}`);
//     console.log(`   - Successfully added: ${successfullyAdded}`);

//     const pdfBytes = await pdfDoc.save();
//     console.log(`💾 PDF generation completed (${pdfBytes.length} bytes)`);
//     return pdfBytes;
//   } catch (err) {
//     console.error("❌ Fatal error in PDF generation:", err);
//     throw err;
//   }
// }

// module.exports = generateSignedPDF;

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

    console.log(`📄 Document Title: ${request.documentTitle}`);
    console.log(`📎 File URL: ${request.fileUrl}`);
    console.log(`📝 File Type: ${request.fileType}`);
    console.log(`📝 Total fields: ${request.fields.length}`);

    let pdfDoc;
    let pages;

    if (request.fileType === "text/plain") {
      console.log("📝 Creating new PDF from text content");
      pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595, 842]); // A4 size
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const lines = (request.documentContent || "").split("\n");
      let y = 800; // Start near top of page

      for (const line of lines) {
        page.drawText(line, {
          x: 50,
          y,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
        y -= 18; // Line spacing
        if (y < 50) break; // Stop before bottom margin
      }

      pages = pdfDoc.getPages();
    } else {
      if (!request.fileUrl) throw new Error("File URL is missing");
      const existingPdfBytes = await fetch(request.fileUrl).then((res) =>
        res.arrayBuffer()
      );
      pdfDoc = await PDFDocument.load(existingPdfBytes);
      pages = pdfDoc.getPages();
    }

    console.log(`📑 PDF has ${pages.length} page(s)`);

    // Log all fields
    console.log("🔍 All fields:");
    request.fields.forEach((field, index) => {
      console.log(
        `   ${index + 1}. ID: ${field.id}, Type: ${
          field.type
        }, Signed: ${!!field.signedData}, Page: ${field.pageNumber || 1}`
      );
    });

    const signedFields = request.fields.filter((f) => f.signedData);
    console.log(`✍️ Signed fields found: ${signedFields.length}`);

    let successfullyAdded = 0;

    for (const [index, field] of signedFields.entries()) {
      console.log(`\n🔄 Processing field ${index + 1}:`);
      console.log(`   - Field ID: ${field.id}`);
      console.log(`   - Recipient: ${field.recipientId}`);
      console.log(`   - Type: ${field.type}`);
      console.log(`   - Page: ${field.pageNumber || 1}`);
      console.log(`   - Position: (x=${field.x}, y=${field.y})`);
      console.log(`   - Dimensions: ${field.width}×${field.height}`);

      try {
        const pageIndex = (field.pageNumber || 1) - 1;
        if (pageIndex >= pages.length) {
          console.warn("⚠️ Page index out of bounds - skipping");
          continue;
        }

        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();

        let yOnPage = field.y - (field.pageNumber - 1) * pageHeight;
        const adjustedY = pageHeight - yOnPage - field.height;

        if (adjustedY < 0 || adjustedY > pageHeight) {
          console.warn(
            `⚠️ Adjusted Y (${adjustedY}) is out of bounds for page height ${pageHeight}`
          );
          continue;
        }

        if (field.signedData) {
          if (
            field.signedData.type === "draw" ||
            field.signedData.type === "upload"
          ) {
            const base64Data = field.signedData.data?.split(",")[1];
            if (!base64Data) {
              console.warn("⚠️ Invalid image data - skipping");
              continue;
            }

            const imageBytes = Buffer.from(base64Data, "base64");
            let image;

            try {
              if (field.signedData.data.startsWith("data:image/png")) {
                image = await pdfDoc.embedPng(imageBytes);
              } else if (
                field.signedData.data.startsWith("data:image/jpeg") ||
                field.signedData.data.startsWith("data:image/jpg")
              ) {
                image = await pdfDoc.embedJpg(imageBytes);
              } else {
                image = await pdfDoc.embedPng(imageBytes); // default
              }

              page.drawImage(image, {
                x: field.x,
                y: adjustedY,
                width: field.width,
                height: field.height,
                opacity: 1,
              });

              console.log("✅ Signature image added");
              successfullyAdded++;
            } catch (err) {
              console.error("Error embedding image:", err);
              const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
              page.drawText("SIGNATURE", {
                x: field.x,
                y: adjustedY + field.height / 2,
                size: Math.min(field.height * 0.6, 12),
                font,
              });
              console.log("✅ Fallback text signature added");
              successfullyAdded++;
            }
          } else if (field.signedData.type === "type") {
            try {
              const { text } = JSON.parse(field.signedData.data);
              const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
              const fontSize = Math.min(field.height * 0.7, 14);
              page.drawText(text, {
                x: field.x,
                y: adjustedY + (field.height - fontSize) / 2,
                size: fontSize,
                font,
              });
              console.log("✅ Typed signature added");
              successfullyAdded++;
            } catch (err) {
              console.error("Error parsing typed signature:", err);
              const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
              page.drawText("SIGNATURE", {
                x: field.x,
                y: adjustedY + field.height / 2,
                size: Math.min(field.height * 0.6, 12),
                font,
              });
              console.log("✅ Fallback text signature added");
              successfullyAdded++;
            }
          }
        }
      } catch (err) {
        console.error(`❌ Error processing field ${field.id}:`, err);
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   - Total signed fields: ${signedFields.length}`);
    console.log(`   - Successfully added: ${successfullyAdded}`);

    const pdfBytes = await pdfDoc.save();
    console.log(`💾 PDF generation completed (${pdfBytes.length} bytes)`);

    return pdfBytes;
  } catch (err) {
    console.error("❌ Fatal error in PDF generation:", err);
    throw err;
  }
}

module.exports = generateSignedPDF;
