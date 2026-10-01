import app from '../src/app';

// Vercel serverless entry point — exports the Express app as the request handler.
// `module.exports` (not ESM `export default`) is required for Vercel's Node.js runtime
// to recognise the Express app as the HTTP handler when using CommonJS output.
module.exports = app;
