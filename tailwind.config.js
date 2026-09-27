/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(210, 100%, 60%)',
          50: 'hsl(var(--primary) / 0.1)',
          100: 'hsl(var(--primary) / 0.2)',
          200: 'hsl(var(--primary) / 0.3)',
          500: 'hsl(var(--primary))',
          600: 'hsl(var(--primary))',
          700: 'hsl(210, 100%, 60%)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          hover: 'hsl(0, 63%, 41%)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        charcoal: {
          50: 'hsl(var(--background))',
          100: 'hsl(var(--border))',
          200: 'hsl(var(--border))',
          300: 'hsl(var(--muted))',
          400: 'hsl(var(--muted-foreground))',
          500: 'hsl(var(--muted-foreground))',
          600: 'hsl(var(--muted-foreground))',
          700: 'hsl(var(--muted-foreground))',
          800: 'hsl(var(--foreground))',
          900: 'hsl(var(--foreground))',
        },
        priority: {
          critical: '#ef4444',
          criticalBg: 'rgba(239, 68, 68, 0.1)',
          criticalBorder: 'rgba(239, 68, 68, 0.2)',
          high: '#f97316',
          highBg: 'rgba(249, 115, 22, 0.1)',
          highBorder: 'rgba(249, 115, 22, 0.2)',
          medium: '#f59e0b',
          mediumBg: 'rgba(245, 158, 11, 0.1)',
          mediumBorder: 'rgba(245, 158, 11, 0.2)',
          low: '#22c55e',
          lowBg: 'rgba(34, 197, 94, 0.1)',
          lowBorder: 'rgba(34, 197, 94, 0.2)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0,0,0,0.3), 0 1px 3px -1px rgba(0,0,0,0.2)',
        'card': '0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -1px rgba(0,0,0,0.2)',
        'elevated': '0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};
