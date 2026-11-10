import { defineConfig } from 'vite';
import chat from './api/chat.js';

export default defineConfig({
  plugins: [{
    name: 'local-chat-api',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 100000) { res.statusCode = 413; return res.end(); }
        }
        try { req.body = JSON.parse(body || '{}'); } catch { res.statusCode = 400; return res.end(); }
        res.status = code => { res.statusCode = code; return res; };
        res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
        await chat(req, res);
      });
    },
  }],
});
