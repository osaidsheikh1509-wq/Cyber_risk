/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        cyber: {
          950: '#070b14',
          900: '#0b1329',
          800: '#111d40',
          700: '#1b2a59',
          border: '#1e293b',
          accent: '#06b6d4',
          danger: '#f43f5e',
          warning: '#f59e0b',
          success: '#10b981',
        },
        theme: {
          bg: 'var(--bg-primary)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-surface-elevated)',
          card: 'var(--bg-card)',
          'card-hover': 'var(--bg-card-hover)',
          'card-subtle': 'var(--bg-card-subtle)',
          input: 'var(--bg-input)',
          border: 'var(--border-color)',
          'border-subtle': 'var(--border-subtle)',
          text: 'var(--text-primary)',
          'text-secondary': 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          accent: 'var(--accent-primary)',
          'accent-hover': 'var(--accent-hover)',
          'accent-subtle': 'var(--accent-subtle)',
          'accent-text': 'var(--accent-text)',
        }
      }
    },
  },
  plugins: [],
}
