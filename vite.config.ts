import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
        'process.env.OPENROUTER_MODEL': JSON.stringify(env.OPENROUTER_MODEL),
        'process.env.MODEL_OUTLINE': JSON.stringify(env.MODEL_OUTLINE),
        'process.env.MODEL_PLANNING': JSON.stringify(env.MODEL_PLANNING),
        'process.env.MODEL_WRITING': JSON.stringify(env.MODEL_WRITING),
        'process.env.MODEL_REALISM': JSON.stringify(env.MODEL_REALISM),
        'process.env.MODEL_POLISH': JSON.stringify(env.MODEL_POLISH),
        'process.env.MODEL_ANALYSIS': JSON.stringify(env.MODEL_ANALYSIS),
        'process.env.SITE_URL': JSON.stringify(env.SITE_URL),
        'process.env.SITE_NAME': JSON.stringify(env.SITE_NAME),
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
