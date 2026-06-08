/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Premium NBA palette
        court: {
          DEFAULT: '#B86A2C',   // hardwood
          dark: '#7A3F18',
          line: '#FFFFFF',
        },
        hoop: {
          DEFAULT: '#FF4D1F',
          glow: '#FF6B2C',
          rim: '#FF7A2E',
        },
        accent: {
          orange: '#FF6B2C',    // NBA orange
          red: '#E63946',       // NBA logo red
          gold: '#FFB627',      // championship gold
          champagne: '#F2C94C',
          ice: '#5BC0EB',       // cool court accent
        },
        neon: {
          orange: '#FF6B2C',
          yellow: '#FFB627',
          blue: '#5BC0EB',
          green: '#22C55E',
          purple: '#9B59B6',
        },
        midnight: {
          950: '#070912',       // deepest
          900: '#0B0F1E',       // primary bg
          850: '#10172A',
          800: '#161F35',
          700: '#1F2A45',
          600: '#2C3A5C',
          500: '#3D4E76',
        },
        dark: {                  // keep legacy keys for compatibility
          900: '#0B0F1E',
          800: '#161F35',
          700: '#1F2A45',
          600: '#2C3A5C',
        }
      },
      fontFamily: {
        game: ['"Press Start 2P"', 'monospace'],
        display: ['"Bebas Neue"', '"Oswald"', '"Noto Sans KR"', 'sans-serif'],
        korean: ['"Noto Sans KR"', 'sans-serif'],
      },
      backgroundImage: {
        'court-grain': "linear-gradient(135deg, #B86A2C 0%, #8E4D1C 50%, #B86A2C 100%)",
        'champion-gold': "linear-gradient(135deg, #FFB627 0%, #FFD86B 50%, #FF8A1F 100%)",
        'arena-floor': "radial-gradient(ellipse at center top, #1F2A45 0%, #0B0F1E 70%)",
        'hoop-gradient': "linear-gradient(135deg, #FF4D1F 0%, #FF6B2C 50%, #E63946 100%)",
      },
      boxShadow: {
        'glow-orange': '0 0 24px rgba(255,107,44,0.45), 0 0 48px rgba(255,107,44,0.2)',
        'glow-gold':   '0 0 24px rgba(255,182,39,0.45), 0 0 48px rgba(255,182,39,0.2)',
        'glow-red':    '0 0 24px rgba(230,57,70,0.45), 0 0 48px rgba(230,57,70,0.2)',
        'card-premium':'0 10px 40px -10px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset',
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-fast': 'pulse 0.5s infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2.4s ease-in-out infinite',
        'spin-slow': 'spin 6s linear infinite',
        'sweep': 'sweep 2.4s linear infinite',
        'ticker': 'ticker 18s linear infinite',
        'pop-in': 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards',
        'slide-down-fade': 'slideDownFade 0.4s ease forwards',
        'shimmer': 'shimmer 2.4s linear infinite',
        'rim-flash': 'rimFlash 0.6s ease-out',
        'court-light': 'courtLight 4s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(255,107,44,0.4), 0 0 24px rgba(255,107,44,0.15)' },
          '50%':      { boxShadow: '0 0 32px rgba(255,107,44,0.7), 0 0 64px rgba(255,107,44,0.35)' },
        },
        sweep: {
          '0%':   { transform: 'translateX(-100%) skewX(-20deg)', opacity: '0' },
          '50%':  { opacity: '0.6' },
          '100%': { transform: 'translateX(200%) skewX(-20deg)', opacity: '0' },
        },
        ticker: {
          '0%':   { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.6) translateY(20px)' },
          '70%':  { opacity: '1', transform: 'scale(1.05) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDownFade: {
          '0%':   { opacity: '0', transform: 'translateY(-12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        rimFlash: {
          '0%':   { transform: 'scale(1)', filter: 'brightness(1)' },
          '40%':  { transform: 'scale(1.18)', filter: 'brightness(2.2)' },
          '100%': { transform: 'scale(1)', filter: 'brightness(1)' },
        },
        courtLight: {
          '0%, 100%': { opacity: '0.55' },
          '50%':      { opacity: '1' },
        },
      }
    }
  },
  plugins: []
}
