import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    resolve(configDir, 'index.html'),
    resolve(configDir, 'src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#07090d',
          900: '#0c1017',
          800: '#121826',
          700: '#1a2233',
          600: '#243047',
        },
        acid: {
          400: '#b8f54a',
          500: '#9ae01f',
          600: '#7ab80f',
        },
        frost: {
          300: '#9fb4d9',
          400: '#7a93c4',
        },
      },
      boxShadow: {
        panel: '0 0 0 1px rgba(184,245,74,0.08), 0 20px 50px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
