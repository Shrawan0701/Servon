const PDFDocument = require("pdfkit");

const generateSalesReportPDF = (reportData) => {
  return new Promise((resolve, reject) => {
    // Margin 0 is crucial for drawing edge-to-edge color blocks!
    const doc = new PDFDocument({ margin: 0, size: "A4" });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // --- 1. DARK MODE HEADER STRIP ---
    doc.rect(0, 0, 595.28, 100).fill("#111827");
    // Brand Name
    doc.fillColor("#10B981").font("Helvetica-Bold").fontSize(32).text("Servon.", 50, 35);
    // Subtitle
    doc.fillColor("#9CA3AF").font("Helvetica-Bold").fontSize(10).text("PREMIUM SALES REPORT", 50, 75, { letterSpacing: 2 });

    // --- 2. REPORT METADATA ---
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(16).text("Performance Overview", 50, 130);
    doc.fillColor("#6B7280").font("Helvetica").fontSize(11).text(`Date Range: ${reportData.startDate} to ${reportData.endDate}`, 50, 150);
    doc.fillColor("#9CA3AF").fontSize(10).text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 50, 165);

    // --- 3. PREMIUM KPI CARDS ---
    const kpiY = 200;

    // Card 1: Revenue (Green)
    doc.rect(50, kpiY, 235, 75).fillAndStroke("#ECFDF5", "#A7F3D0");
    doc.fillColor("#065F46").font("Helvetica-Bold").fontSize(10).text("TOTAL REVENUE", 65, kpiY + 15);
    doc.fillColor("#047857").font("Helvetica-Bold").fontSize(22).text(`Rs. ${Number(reportData.totalRevenue).toFixed(0)}`, 65, kpiY + 35);

    // Card 2: Orders (Gray)
    doc.rect(305, kpiY, 235, 75).fillAndStroke("#F9FAFB", "#E5E7EB");
    doc.fillColor("#4B5563").font("Helvetica-Bold").fontSize(10).text("TOTAL ORDERS", 320, kpiY + 15);
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(22).text(`${reportData.totalOrders}`, 320, kpiY + 35);


    // --- 4. TABLE SECTION ---
    let tableTop = 320;
    
    // Table Header (Dark)
    doc.rect(50, tableTop, 490, 35).fill("#111827");
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10);
    doc.text("ITEM NAME", 70, tableTop + 12);
    doc.text("QTY SOLD", 300, tableTop + 12, { width: 80, align: "center" });
    doc.text("REVENUE", 400, tableTop + 12, { width: 120, align: "right" });

    // Table Rows (Alternating Colors)
    let yPos = tableTop + 35;
    
    if (!reportData.items || reportData.items.length === 0) {
      doc.fillColor("#6B7280").font("Helvetica").fontSize(12).text("No sales data available for this period.", 50, yPos + 30, { align: "center", width: 490 });
    } else {
      reportData.items.forEach((item, i) => {
        // Pagination Check
        if (yPos > 730) {
          doc.addPage();
          yPos = 50;
          
          // Redraw Header on new page
          doc.rect(50, yPos, 490, 35).fill("#111827");
          doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(10);
          doc.text("ITEM NAME", 70, yPos + 12);
          doc.text("QTY SOLD", 300, yPos + 12, { width: 80, align: "center" });
          doc.text("REVENUE", 400, yPos + 12, { width: 120, align: "right" });
          yPos += 35;
        }

        // Draw light gray background for alternating rows (zebra striping)
        if (i % 2 === 0) {
          doc.rect(50, yPos, 490, 30).fill("#F9FAFB");
        }

        // Draw text
        doc.fillColor("#374151").font("Helvetica").fontSize(11);
        
        // Truncate long names so they don't break the layout
        const displayName = item.name.length > 35 ? item.name.substring(0, 35) + "..." : item.name;
        
        doc.text(displayName, 70, yPos + 10);
        // Note: Using qty_sold as your original code did
        doc.text(item.qty_sold.toString(), 300, yPos + 10, { width: 80, align: "center" });
        doc.font("Helvetica-Bold").text(`Rs. ${Number(item.revenue).toFixed(2)}`, 400, yPos + 10, { width: 120, align: "right" });

        // Draw bottom border line for the row
        doc.moveTo(50, yPos + 30).lineTo(540, yPos + 30).strokeColor("#E5E7EB").lineWidth(1).stroke();

        yPos += 30;
      });
    }

    // --- 5. FOOTER ---
    doc.rect(0, 790, 595.28, 55).fill("#F3F4F6");
    doc.fillColor("#9CA3AF").font("Helvetica").fontSize(10).text("© 2026 Servon Business Dashboard. All rights reserved.", 0, 810, { align: "center" });

    doc.end();
  });
};

const generateQRPDF = async (tableNumber, qrCodeDataUrl) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [300, 350], margin: 30 });
    const buffers = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    doc.fontSize(16).fillColor("#111").text("Servon", { align: "center" });
    doc.fontSize(12).fillColor("#555").text(`Table ${tableNumber}`, {
      align: "center",
    });

    doc.moveDown(0.5);

    // QR code image from data URL
    const base64Data = qrCodeDataUrl.replace(
      /^data:image\/png;base64,/,
      ""
    );
    const imgBuffer = Buffer.from(base64Data, "base64");

    doc.image(imgBuffer, {
      fit: [220, 220],
      align: "center",
    });

    doc.moveDown(1);

    doc
      .fontSize(10)
      .fillColor("#888")
      .text("Scan to order", { align: "center" });

    doc.end();
  });
};

module.exports = { generateSalesReportPDF, generateQRPDF };