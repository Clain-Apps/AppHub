import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const publicPathPrefix = publicBasePath(process.env.PUBLIC_PATH_PREFIX);

export default defineConfig({
  base: publicPathPrefix,
  plugins: [react()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
      "/catalog-images": { target: "http://127.0.0.1:3001", changeOrigin: false },
      "/socket": { target: "ws://127.0.0.1:3001", ws: true, changeOrigin: false },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

function publicBasePath(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "/") return "/";
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${withLeadingSlash.replace(/\/+$/, "")}/`;
}
