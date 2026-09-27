import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '1.25rem',
				sm: '1.5rem',
				lg: '2rem',
			},
			screens: {
				'2xl': '1280px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				// Brand lime — derived from the logo mark (#8CAE36), lifted for dark UI
				brand: {
					50:  '#f6fbe8',
					100: '#eaf5c8',
					200: '#d8ec98',
					300: '#c3e163',
					400: '#b0d43f',
					500: '#9cc02f',
					600: '#8cae36',
					700: '#6a8424',
					800: '#4d5f1c',
					900: '#2f3a12',
				},
				// Neutral surfaces for the dark UI (slightly warm, never pure grey-blue)
				ink: {
					950: '#0a0a0b',
					900: '#111113',
					850: '#161618',
					800: '#1c1c1f',
					700: '#2a2a2e',
					600: '#3a3a3f',
					500: '#5c5c63',
					400: '#8b8b93',
					300: '#b4b4ba',
					200: '#d6d6da',
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			fontFamily: {
				display: ['"Barlow Condensed"', 'Impact', 'sans-serif'],
				sans: ['Inter', 'system-ui', 'sans-serif'],
				// Legacy aliases still referenced across pages and dashboards
				heading: ['"Barlow Condensed"', 'Impact', 'sans-serif'],
				orbitron: ['"Barlow Condensed"', 'Impact', 'sans-serif'],
				body: ['Inter', 'system-ui', 'sans-serif'],
				rajdhani: ['Inter', 'system-ui', 'sans-serif'],
			},
			fontSize: {
				// Fluid display scale — used for page and section headings only
				'display-xl': ['clamp(3rem, 1.6rem + 6vw, 6.5rem)', { lineHeight: '0.9', letterSpacing: '-0.01em' }],
				'display-lg': ['clamp(2.5rem, 1.6rem + 3.6vw, 4.5rem)', { lineHeight: '0.95', letterSpacing: '-0.005em' }],
				'display-md': ['clamp(2rem, 1.5rem + 2vw, 3.25rem)', { lineHeight: '1', letterSpacing: '0' }],
				'display-sm': ['clamp(1.5rem, 1.25rem + 1vw, 2rem)', { lineHeight: '1.05', letterSpacing: '0' }],
			},
			spacing: {
				section: 'clamp(4.5rem, 3rem + 6vw, 8rem)',
			},
			transitionTimingFunction: {
				'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-up': {
					from: { opacity: '0', transform: 'translateY(16px)' },
					to: { opacity: '1', transform: 'translateY(0)' }
				},
				'fade-in': {
					from: { opacity: '0' },
					to: { opacity: '1' }
				},
				'scale-in': {
					from: { opacity: '0', transform: 'scale(0.97)' },
					to: { opacity: '1', transform: 'scale(1)' }
				},
				'image-in': {
					from: { opacity: '0', transform: 'scale(1.04)' },
					to: { opacity: '1', transform: 'scale(1)' }
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-up': 'fade-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
				'fade-in': 'fade-in 0.3s ease-out both',
				'scale-in': 'scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
				'image-in': 'image-in 1.1s cubic-bezier(0.16, 1, 0.3, 1) both',
			},
		}
	},
	plugins: [animate],
} satisfies Config;
