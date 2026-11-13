import { context, build } from "esbuild";

const options = {
    entryPoints: { extension: "src/extension/extension.ts" },
    outdir: "dist",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    external: ["vscode"],
    sourcemap: true,
    logLevel: "info",
};

if (process.argv.includes("--watch")) {
    const ctx = await context(options);
    await ctx.watch();
} else {
    await build(options);
}
