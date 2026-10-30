import qrcode from 'qrcode-generator';

// Generate in the app: bill printing must never fetch a QR image from the web.
export function paymentQR(upiString) {
  if (!upiString) return null;
  const qr = qrcode(0, 'M');
  qr.addData(upiString);
  qr.make();
  return qr.createDataURL(4, 2);
}
