import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://buildwithai.gdg.com.bo",
  // Speaker, organizer and session images come from Firebase Storage; they are
  // downloaded and optimized at build time so visitors never hit Storage.
  image: {
    domains: ["firebasestorage.googleapis.com"],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
