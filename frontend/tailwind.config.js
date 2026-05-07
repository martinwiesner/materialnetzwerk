/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.2s ease-out',
      },
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['ABCCamera', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // RZZ CI — Materialien + Logo: Core Blue #0033FF
        primary: {
          50:  '#e6eeff',
          100: '#ccd9ff',
          200: '#99b3ff',
          300: '#6690ff',
          400: '#3366ff',
          500: '#3380FF',  // Bright Horizon (Akteure)
          600: '#1a5fe6',
          700: '#0033FF',  // Core Blue (Materialien, Logo)
          800: '#0029cc',
          900: '#001f99',
        },
        // RZZ CI — Projekte: Extra Grün #639530
        project: {
          50:  '#f0f7e6',
          100: '#dcedc8',
          200: '#b9db8f',
          300: '#92c35a',
          400: '#78ab3c',
          500: '#639530',  // Extra Grün
          600: '#507826',
          700: '#3e5c1d',
          800: '#2c4014',
          900: '#1a260c',
        },
        // RZZ CI — Akteure: Pulse Red #FF3B36
        actor: {
          50:  '#fff0ef',
          100: '#ffdcdb',
          200: '#ffb9b7',
          300: '#ff8a87',
          400: '#ff5c58',
          500: '#FF3B36',  // Pulse Red
          600: '#e82f2a',
          700: '#cc1f1a',
          800: '#a81714',
          900: '#880f0c',
        },
        // RZZ CI neutral
        rzz: {
          'soft-sky':    '#CCFAFF',
          'icy-breeze':  '#99F2FF',
          'cloud-gray':  '#D9D9D9',
          'cloud-light': '#EBEBEB',
          'urban-ash':   '#666666',
          'extra-gruen': '#639530',
        },
      },
    },
  },
  plugins: [],
};
