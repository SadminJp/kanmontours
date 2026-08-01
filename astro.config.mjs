// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kanmontours.jp',
  i18n: {
    locales: ['en', 'ja'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: true,
    },
  },
});
