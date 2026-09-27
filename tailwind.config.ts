import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Figtree", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      colors: {
        /* awork-Palette (DESIGN.md) */
        night: "#081934",
        asphalt: "#0f284d",
        midnight: "#1f3b66",
        slate2: "#335180",
        steel: "#5576aa",
        "light-steel": "#a1bbe5",
        dust: "#c8dcf4",
        fog: "#dbedff",
        sky: "#ebf5ff",
        ice: "#f2f9ff",
        smoke: "#f9fcff",
        line: "#dce0e7",
        body: "#68788d",
        ink: "#161c24",
        /* Aleksa AI Brand-Lila (#8b79f0, aus STYLEGUIDE Vertragsvorlage 26.08.2026) */
        indigo2: { 50: "#f6f4fe", 100: "#eceafd", 300: "#d6cffa", 500: "#beb3f8", 700: "#7a66ec", 900: "#8b79f0" },
        blue2: { 50: "#edf5ff", 100: "#dbebff", 300: "#b8d7ff", 500: "#94c2ff", 700: "#4d9aff", 900: "#006dfa" },
        green2: { 50: "#ecfcf5", 100: "#dafaec", 300: "#b5f5d9", 500: "#8fefc5", 700: "#45e59f", 900: "#16d982" },
        red2: { 50: "#ffe5f1", 100: "#ffdbec", 300: "#ffb2d5", 500: "#ff80b9", 700: "#ff4398", 900: "#ff1a82" },
        orange2: { 50: "#fff1f0", 100: "#ffe4e0", 300: "#ffc8c2", 500: "#ffada3", 700: "#ff7666", 900: "#ff4933" },
        yellow2: { 50: "#fffbf0", 100: "#fff6e0", 300: "#ffeec2", 500: "#ffe5a3", 700: "#ffd466", 900: "#ffba1a" },
        purple2: { 50: "#f6eefe", 100: "#ecddfd", 300: "#d9bcfb", 500: "#b982f8", 700: "#a157f6", 900: "#7d1ded" },
        cyan2: { 50: "#effcfe", 100: "#def9fc", 300: "#bef3f9", 500: "#9deef7", 700: "#5ce2f1", 900: "#0bd0e5" },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "liquid-float": {
          "0%, 100%": {
            transform: "translate3d(0, 0, 0) scale(1)",
          },
          "33%": {
            transform: "translate3d(-30px, -30px, 0) scale(1.1)",
          },
          "66%": {
            transform: "translate3d(30px, 20px, 0) scale(0.95)",
          }
        },
        "liquid-morph": {
          "0%, 100%": {
            borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
          },
          "50%": {
            borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%",
          }
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.3s ease-out",
        "accordion-up": "accordion-up 0.3s ease-out",
        "fade-in": "fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-up": "slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        "liquid-float": "liquid-float 20s ease-in-out infinite",
        "liquid-morph": "liquid-morph 15s ease-in-out infinite",
        "shimmer": "shimmer 8s linear infinite",
      },
      boxShadow: {
        'glass': '0 2px 6px rgba(15, 40, 77, 0.04), 0 1px 2px rgba(15, 40, 77, 0.03)',
        'liquid': '0 8px 24px rgba(15, 40, 77, 0.10)',
        'elegant': '0 4px 16px rgba(15, 40, 77, 0.05)',
        'float': '0 8px 24px rgba(15, 40, 77, 0.10)',
        'card': '0 2px 6px rgba(15, 40, 77, 0.04), 0 1px 2px rgba(15, 40, 77, 0.03)',
        'panel': '0 4px 16px rgba(15, 40, 77, 0.05)',
        'popover': '0 8px 24px rgba(15, 40, 77, 0.10)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
