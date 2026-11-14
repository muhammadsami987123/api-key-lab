'use strict';

/* Vercel entry point.
   Vercel only auto-routes serverless functions that live inside `api/`,
   so this file exists purely to satisfy that convention. The real handler
   lives in `backend/handlers/` and is shared with the local dev server. */

module.exports = require('../backend/handlers/chat');
