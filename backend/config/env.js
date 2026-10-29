const path = require('node:path');
const dotenv = require('dotenv');

// Shell/hosting variables take precedence. Local overrides are never loaded by
// production or test processes, and every entry point resolves the same files.
const root = path.join(__dirname, '..');
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.join(root, '.env.development.local'), quiet: true });
}
dotenv.config({ path: path.join(root, '.env'), quiet: true });
