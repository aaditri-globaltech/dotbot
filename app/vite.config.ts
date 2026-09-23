import tailwindcss from "@tailwindcss/vite";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [solid(), tailwindcss()],
  test: {
    // Node stays the default because most suites are pure logic; DOM tests opt in
    // per file with `// @vitest-environment jsdom` (Vitest 4 removed
    // environmentMatchGlobs). vite-plugin-solid adds the `solid`, `browser` and
    // `development` resolve conditions itself, so do not set resolve.conditions here.
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    reporters: ["verbose"],
  },
});
