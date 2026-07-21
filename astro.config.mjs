import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://mindlynx.ai',
  output: 'static',
  adapter: vercel(),
});
