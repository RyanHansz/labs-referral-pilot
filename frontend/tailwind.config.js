/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx,scss}",
  ],
  theme: {
    extend: {
      colors: {
        // Override blue with Goodwill Blue for brand consistency
        blue: {
          50: "hsl(var(--goodwill-blue-50))",
          100: "hsl(var(--goodwill-blue-100))",
          200: "hsl(var(--goodwill-blue-200))",
          300: "hsl(var(--goodwill-blue-300))",
          400: "hsl(var(--goodwill-blue-400))",
          500: "hsl(var(--goodwill-blue-500))", // #0053A0 - Primary Goodwill Blue
          600: "hsl(var(--goodwill-blue-600))",
          700: "hsl(var(--goodwill-blue-700))",
          800: "hsl(var(--goodwill-blue-800))",
          900: "hsl(var(--goodwill-blue-900))",
          DEFAULT: "hsl(var(--goodwill-blue-500))", // Default blue = Goodwill Blue
        },
      },
    },
  },
  plugins: [],
};
