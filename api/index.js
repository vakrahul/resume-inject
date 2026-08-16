// Vercel serverless entry point — CommonJS wrapper
// Dynamically imports the ESM Express app and re-exports it
let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = import("../server/dist/index.js").then((m) => m.app);
  }
  return appPromise;
}

module.exports = async (req, res) => {
  const app = await getApp();
  return app(req, res);
};
