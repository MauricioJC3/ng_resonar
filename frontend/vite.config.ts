import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev` the API runs separately on :8000. In production the
// frontend is served by nginx which proxies /api to the backend container.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
