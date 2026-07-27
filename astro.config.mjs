import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://mindlynx.ai',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [sitemap()],
  // The dev toolbar overlays the bottom of the viewport and steals clicks
  // from the cookie notice during local testing.
  devToolbar: { enabled: false },
});
