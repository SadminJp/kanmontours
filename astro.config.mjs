// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sadminjp.github.io',
  base: '/kanmontours',
  i18n: {
    locales: ['en', 'ja'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
