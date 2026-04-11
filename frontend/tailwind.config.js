/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        sidebar: {
          bg:           '#ffffff',
          border:       '#f1f5f9',
          text:         '#64748b',
          hover:        '#f1f5f9',
          active:       '#eef2ff',
          'active-text':'#4f46e5',
        },
        /* ── Role brand colours ────────────────────── */
        patient: {
          primary: '#16A34A',   /* green-600  */
          light:   '#DCFCE7',   /* green-100  */
          dark:    '#166534',   /* green-800  */
          hover:   '#15803D',   /* green-700  */
          subtle:  '#F0FDF4',   /* green-50   */
          border:  '#86EFAC',   /* green-300  */
          muted:   '#4ADE80',   /* green-400  */
        },
        doctor: {
          primary: '#2563EB',   /* blue-600   */
          light:   '#DBEAFE',   /* blue-100   */
          dark:    '#1E3A8A',   /* blue-900   */
          hover:   '#1D4ED8',   /* blue-700   */
          subtle:  '#EFF6FF',   /* blue-50    */
          border:  '#93C5FD',   /* blue-300   */
          muted:   '#60A5FA',   /* blue-400   */
        },
        hospital: {
          primary: '#7C3AED',   /* violet-600  */
          light:   '#EDE9FE',   /* violet-100  */
          dark:    '#4C1D95',   /* violet-900  */
          hover:   '#6D28D9',   /* violet-700  */
          subtle:  '#F5F3FF',   /* violet-50   */
          border:  '#C4B5FD',   /* violet-300  */
          muted:   '#A78BFA',   /* violet-400  */
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft':    '0 2px 8px -2px rgba(0,0,0,0.08), 0 1px 4px -1px rgba(0,0,0,0.04)',
        'medium':  '0 4px 16px -4px rgba(0,0,0,0.10), 0 2px 8px -2px rgba(0,0,0,0.06)',
        'sidebar': '4px 0 24px -4px rgba(0,0,0,0.06)',
        /* role-coloured glows */
        'glow-green':  '0 4px 20px -4px rgba(22, 163, 74, 0.35)',
        'glow-blue':   '0 4px 20px -4px rgba(37,  99, 235, 0.35)',
        'glow-purple': '0 4px 20px -4px rgba(124, 58, 237, 0.35)',
      },
      transitionDuration: {
        '250': '250ms',
      },
      spacing: {
        'sidebar':           '240px',
        'sidebar-collapsed': '70px',
      },
      width: {
        'sidebar':           '240px',
        'sidebar-collapsed': '70px',
      },
    },
  },
  plugins: [],
};
