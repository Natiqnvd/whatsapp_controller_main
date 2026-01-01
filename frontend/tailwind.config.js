// tailwind.config.js
/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  content: [
    path.resolve(__dirname, 'index.html'),
    path.resolve(__dirname, 'src/**/*.{js,ts,jsx,tsx,html}')
  ],
  theme: {
    extend: {
      // Custom theme configurations can be added here
    },
  },
  plugins: [
    forms
  ],
};
