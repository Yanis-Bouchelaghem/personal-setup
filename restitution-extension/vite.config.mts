import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The webview is a small React app. In VS Code it loads dist/webview/main.js
// (fixed file names, so the extension can reference them); in a browser,
// `npm run webview:dev` serves it with fixtures.
export default defineConfig({
    root: "src/webview",
    base: "./",
    plugins: [react()],
    build: {
        outDir: "../../dist/webview",
        emptyOutDir: true,
        cssCodeSplit: false,
        modulePreload: false,
        rollupOptions: {
            output: {
                entryFileNames: "main.js",
                assetFileNames: "main[extname]",
            },
        },
    },
});
