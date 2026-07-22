import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://mindlynx.ai',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
});
