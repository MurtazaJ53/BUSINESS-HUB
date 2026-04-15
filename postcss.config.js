// Business-hub uses @tailwindcss/vite (Tailwind v4 Vite plugin).
// Tailwind processing is handled by the Vite plugin — NOT PostCSS.
// This empty config prevents the parent's postcss.config.js (Tailwind v3)
// from being inherited and causing "@layer base" directive errors.
export default {
  plugins: {},
};
