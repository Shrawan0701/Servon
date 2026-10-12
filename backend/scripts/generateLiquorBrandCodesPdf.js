const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

const brandCodes = [
  [10, "Tuborg Strong"], [11, "Tuborg"], [12, "Tuborg Classic"], [13, "Kingfisher"], [14, "Kingfisher Ultra"], [15, "Carlsberg Beer"], [16, "Heineken Beer"], [17, "Budweiser"], [18, "Godfather Beer"], [19, "London Beer"], [20, "Breezer"],
  [21, "Royal Stag"], [22, "Royal Stag Double"], [23, "Royal Green"], [24, "Signature"], [25, "Imperial Blue"], [26, "McDowell's Rum"], [27, "McDowell's"], [28, "McDowell's Platinum"], [29, "B7"], [30, "DSP Black"], [31, "Goa"], [32, "Grand Masters"], [33, "Iconiq White"], [34, "Royal Challenge"], [35, "Oaksmith Silver"], [36, "Oaksmith Gold"], [37, "Oaken"], [38, "Antiquity"], [39, "Green Label"], [40, "Officer's Choice"], [41, "Jameson"], [42, "Black Dog"], [43, "Teachers"], [44, "Black & White"], [45, "VAT 69"], [46, "Ballantine's"], [47, "Haywards 2000"], [48, "Haywards"], [49, "Masters Delight"], [50, "Classic Gold"], [51, "Brown Man"], [52, "Premium Whisky"], [53, "Barrel Whisky"], [54, "X-Treme Whisky"], [55, "Empire"], [56, "Blenders Reserve"], [57, "After Dark"], [58, "Amber Whisky"], [59, "Vulcan Blue"], [60, "Alpha Bull"], [61, "Kalani White"],
  [62, "Bullet Rum"], [63, "Old Monk"], [64, "Dark Old Rum"], [65, "Gold Medal Rum"], [66, "Mad Rum"], [67, "Blak Bacardi"],
  [68, "Smirnoff"], [69, "Vodka"], [70, "Xclamation"], [71, "Xclamation Vodka"], [72, "Silver Kastle Vodka"], [73, "Gold Medal Vodka"], [74, "Shaky Vodka Jamun"], [75, "Smirnoff Jamun"],
  [76, "Bombay"], [77, "Bombay Quarter"], [78, "Lemon Duet Gin"], [79, "Knight Fox Gin"], [80, "Doctor Brandy"],
  [81, "Let's Go Cranberry"], [82, "Bacardi Limon"], [83, "Magic Moments"], [84, "Magik Moments"], [85, "Magic Moment"],
  [86, "OC Blue"], [87, "REO Wain"], [88, "B10 Sterling"], [89, "Red Label"], [90, "100 Pipers"], [91, "Romeno"], [92, "Danona"], [93, "Khata Khat"], [94, "Royal Barrel"], [95, "Mumbai Malti"], [96, "Cannon"], [97, "Bullet Strong"],
].map(([code, name]) => ({ code, name }));

const outputDir = path.resolve(__dirname, "../../docs");
const outputPath = path.join(outputDir, "servon-liquor-brand-codes.pdf");
fs.mkdirSync(outputDir, { recursive: true });

const doc = new PDFDocument({ size: "A4", margin: 36, info: { Title: "Servon Liquor Brand Codes" } });
doc.pipe(fs.createWriteStream(outputPath));

const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
const tableTop = 132;
const rowHeight = 22;
const colGap = 18;
const colWidth = (pageWidth - colGap) / 2;
const leftX = doc.page.margins.left;
const rightX = leftX + colWidth + colGap;

function drawHeader() {
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#111827").text("Servon Liquor Brand Codes", leftX, 36);
  doc.font("Helvetica").fontSize(10).fillColor("#4B5563").text("Use category code 8 for Liquor, then enter the brand code below to view that brand's bottle variants.", leftX, 66, { width: pageWidth });
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text("Category Code", leftX, 94);
  doc.font("Helvetica").fontSize(10).text("8 - Liquor", leftX + 94, 94);
  doc.moveTo(leftX, 116).lineTo(leftX + pageWidth, 116).strokeColor("#D1D5DB").stroke();
}

function drawColumnHeader(x, y) {
  doc.roundedRect(x, y, colWidth, rowHeight, 4).fill("#111827");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF").text("BRAND CODE", x + 10, y + 7, { width: 78 });
  doc.text("BRAND NAME", x + 98, y + 7, { width: colWidth - 108 });
}

function drawRow(x, y, item, index) {
  doc.roundedRect(x, y, colWidth, rowHeight, 3).fill(index % 2 === 0 ? "#F9FAFB" : "#FFFFFF");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(String(item.code), x + 10, y + 6, { width: 78 });
  doc.font("Helvetica").fontSize(10).fillColor("#111827").text(item.name, x + 98, y + 6, { width: colWidth - 108 });
  doc.roundedRect(x, y, colWidth, rowHeight, 3).strokeColor("#E5E7EB").stroke();
}

function drawFooter() {
  const y = doc.page.height - 42;
  doc.moveTo(leftX, y - 10).lineTo(leftX + pageWidth, y - 10).strokeColor("#E5E7EB").stroke();
  doc.font("Helvetica").fontSize(8).fillColor("#6B7280").text("Servon POS - Liquor brand code reference", leftX, y, { width: pageWidth / 2 });
  doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, leftX + pageWidth / 2, y, { width: pageWidth / 2, align: "right" });
}

drawHeader();
drawColumnHeader(leftX, tableTop);
drawColumnHeader(rightX, tableTop);

let y = tableTop + rowHeight + 6;
const rowsPerColumn = Math.floor((doc.page.height - y - 58) / rowHeight);
brandCodes.forEach((item, index) => {
  const pageIndex = Math.floor(index / (rowsPerColumn * 2));
  const indexOnPage = index - pageIndex * rowsPerColumn * 2;

  if (indexOnPage === 0 && index !== 0) {
    drawFooter();
    doc.addPage();
    drawHeader();
    drawColumnHeader(leftX, tableTop);
    drawColumnHeader(rightX, tableTop);
    y = tableTop + rowHeight + 6;
  }

  const inRightColumn = indexOnPage >= rowsPerColumn;
  const rowIndex = inRightColumn ? indexOnPage - rowsPerColumn : indexOnPage;
  const x = inRightColumn ? rightX : leftX;
  drawRow(x, y + rowIndex * rowHeight, item, index);
});

drawFooter();
doc.end();

console.log(outputPath);
