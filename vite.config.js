import { defineConfig } from 'vite';
import { pagesBase } from './scripts/pages-base.js';

export default defineConfig({ base: pagesBase() });
