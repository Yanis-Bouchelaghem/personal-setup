// Write the panel's state for a repo to src/webview/public/state.json, so the
// browser harness can show it:  http://localhost:5173/?state=/state.json
// Usage: npm run dump:state -- <repo>
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { build } from "esbuild";

const repo = process.argv[2];
if (!repo) {
    throw new Error("usage: npm run dump:state -- <repo>");
}

// The state is computed by the extension's own code, bundled on the fly.
const work = await mkdtemp(join(tmpdir(), "restitution-dump-"));
try {
    const bundle = join(work, "viewState.mjs");
    await build({
        entryPoints: ["src/node/store/viewState.ts"],
        outfile: bundle,
        bundle: true,
        platform: "node",
        format: "esm",
        logLevel: "error",
    });
    const { readViewState } = await import(pathToFileURL(bundle).href);

    await mkdir("src/webview/public", { recursive: true });
    await writeFile(
        "src/webview/public/state.json",
        JSON.stringify(await readViewState(repo)),
    );
    console.log("src/webview/public/state.json");
} finally {
    await rm(work, { recursive: true, force: true });
}
