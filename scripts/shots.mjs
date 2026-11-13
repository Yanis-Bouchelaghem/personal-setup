// Screenshots of the webview dev harness: the visual-review artifact.
// Usage: npm run shots   (writes to .shots/)
import { mkdir } from "node:fs/promises";

import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const CHROME =
    process.env.CHROME ??
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 5199;

const shots = [
    { fixture: "many", theme: "dark" },
    { fixture: "many", theme: "light" },
    { fixture: "many", theme: "dark", scroll: 300, name: "many-scrolled-dark" },
    {
        fixture: "many",
        theme: "light",
        scroll: 300,
        name: "many-scrolled-light",
    },
    { fixture: "long", theme: "dark" },
    { fixture: "empty", theme: "dark" },
    { fixture: "error", theme: "light" },
];

await mkdir(".shots", { recursive: true });
const server = await createServer({
    configFile: "vite.config.mts",
    server: { port: PORT, strictPort: true },
    logLevel: "error",
});
await server.listen();
const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
});

try {
    const page = await browser.newPage();
    await page.setViewport({ width: 380, height: 760, deviceScaleFactor: 2 });
    for (const { fixture, theme, scroll, name } of shots) {
        await page.goto(
            `http://localhost:${PORT}/?fixture=${fixture}&theme=${theme}&bare=1`,
        );
        await page.waitForSelector("#root .app");
        await page.evaluate((y) => window.scrollTo(0, y ?? 0), scroll);
        await new Promise((resolve) => setTimeout(resolve, 150));
        const file = `.shots/${name ?? `${fixture}-${theme}`}.png`;
        await page.screenshot({ path: file, fullPage: scroll === undefined });
        console.log(file);
    }
} finally {
    await browser.close();
    await server.close();
}
