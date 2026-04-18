import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // shadcn CSS-variable mappings
        background:         'var(--background)',
        foreground:         'var(--foreground)',
        border:             'var(--border)',
        input:              'var(--input)',
        ring:               'var(--ring)',
        card: {
          DEFAULT:          'var(--card)',
          foreground:       'var(--card-foreground)',
        },
        popover: {
          DEFAULT:          'var(--popover)',
          foreground:       'var(--popover-foreground)',
        },
        primary: {
          DEFAULT:          'var(--primary)',
          foreground:       'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT:          'var(--secondary)',
          foreground:       'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT:          'var(--muted)',
          foreground:       'var(--muted-foreground)',
        },
        accent: {
          DEFAULT:          'var(--accent)',
          foreground:       'var(--accent-foreground)',
          violet:           'var(--accent-violet)',
          teal:             'var(--accent-teal)',
        },
        destructive: {
          DEFAULT:          'var(--destructive)',
          foreground:       'var(--destructive-foreground)',
        },
        surface: {
          DEFAULT:  '#131314',
          low:      '#1C1B1C',
          container:'#201F20',
          high:     '#2A2829',
          highest:  '#353436',
        },
        brand: {
          DEFAULT: '#F28705',
          muted:   'rgba(242,135,5,0.15)',
          end:     '#FFB690',
        },
        agent: {
          research: '#F29F05',
          market:   '#A1A1AA',
          strategy: '#FFDBCA',
        },
        'on-surface':         '#E8E3DD',
        'on-surface-variant': '#9E9489',
        'on-surface-muted':   '#6B6460',
        'outline-variant':    '#584237',
        status: {
          pending:       'var(--status-pending-bg)',
          running:       'var(--status-running-bg)',
          done:          'var(--status-done-bg)',
          failed:        'var(--status-failed-bg)',
          paused:        'var(--status-paused-bg)',
          'pending-text':'var(--status-pending-text)',
          'running-text':'var(--status-running-text)',
          'done-text':   'var(--status-done-text)',
          'failed-text': 'var(--status-failed-text)',
          'paused-text':       'var(--status-paused-text)',
          'approved-surface': 'var(--status-approved-surface)',
          'rejected-surface': 'var(--status-rejected-surface)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #F28705, #FFB690)',
      },
      boxShadow: {
        ambient: '0 12px 40px -10px rgba(0,0,0,0.5), 0 0 20px rgba(249,115,22,0.05)',
      },
      animation: {
        'pulse-status': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
export default config;
