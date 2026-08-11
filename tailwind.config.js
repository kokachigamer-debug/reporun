/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Design tokens (Section 19.1): single restrained blue accent,
        // neutral surfaces, hairline borders — GitHub + Apple fusion.
        rr: {
          canvas: "#ffffff",
          surface: "#f6f8fa",
          surfaceAlt: "#eef1f4",
          hairline: "#d0d7de",
          subtle: "#6e7781",
          text: "#1f2328",
          muted: "#57606a",
          accent: "#0969da",
          accentHover: "#0860c4",
          accentSoft: "#ddf4ff",
          ok: "#1a7f37",
          warn: "#9a6700",
          danger: "#cf222e",
          tier1: "#0969da",
          tier2: "#8250df",
          tier3: "#1a7f37",
          tier4: "#bc4c00",
        },
      },
      borderRadius: {
        card: "14px",
        panel: "16px",
        inline: "8px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "Liberation Mono",
          "monospace",
        ],
      },
      boxShadow: {
        none: "none",
        subtle: "0 1px 2px rgba(31,35,40,0.04)",
      },
    },
  },
  plugins: [],
};
