import type { Config } from "tailwindcss";

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
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				'heading': ['Poppins', 'system-ui', 'sans-serif'],
				'body': ['Inter', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					light: 'hsl(var(--primary-light))',
					glow: 'hsl(var(--primary-glow))'
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
					foreground: 'hsl(var(--accent-foreground))',
					light: 'hsl(var(--accent-light))',
					glow: 'hsl(var(--accent-glow))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
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
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'swoop-in-right': {
					'0%': {
						transform: 'translateX(100%) rotateY(30deg) scale(0.8)',
						opacity: '0'
					},
					'50%': {
						transform: 'translateX(50%) rotateY(15deg) scale(0.9)',
						opacity: '0.7'
					},
					'100%': {
						transform: 'translateX(0) rotateY(0deg) scale(1)',
						opacity: '1'
					}
				},
				'slide-out-right': {
					'0%': {
						transform: 'translateX(0) scale(1)',
						opacity: '1'
					},
					'100%': {
						transform: 'translateX(100%) scale(0.8)',
						opacity: '0'
					}
				},
				'smooth-reveal': {
					'0%': { 
						transform: 'translateX(100%) scale(0.7) rotateY(25deg)', 
						opacity: '0',
						filter: 'blur(8px)'
					},
					'25%': { 
						transform: 'translateX(75%) scale(0.8) rotateY(15deg)', 
						opacity: '0.3',
						filter: 'blur(4px)'
					},
					'50%': { 
						transform: 'translateX(50%) scale(0.9) rotateY(8deg)', 
						opacity: '0.6',
						filter: 'blur(2px)'
					},
					'75%': { 
						transform: 'translateX(25%) scale(0.95) rotateY(3deg)', 
						opacity: '0.8',
						filter: 'blur(1px)'
					},
					'100%': { 
						transform: 'translateX(0) scale(1) rotateY(0deg)', 
						opacity: '1',
						filter: 'blur(0)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'swoop-in-right': 'swoop-in-right 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
				'slide-out-right': 'slide-out-right 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
				'smooth-reveal': 'smooth-reveal 4s cubic-bezier(0.16, 1, 0.3, 1)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
