// Vercel serverless entry — imports the Express app and exports it as the
// default handler. Vercel's Node.js runtime wraps this automatically.
import "../server/dist/index.js";
export { app as default } from "../server/dist/index.js";
