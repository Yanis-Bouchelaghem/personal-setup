import { describe, expect, it } from "vitest";

import { GUIDE } from "./guide";
import { parseRestitution } from "./restitution";

describe("GUIDE", () => {
    it("ends with an example the agent could submit as is", () => {
        const example = GUIDE.slice(
            GUIDE.indexOf("{", GUIDE.indexOf("## Example\n")),
        );
        const result = parseRestitution(
            JSON.stringify({ version: 1, ...JSON.parse(example) }),
        );
        expect(result).toMatchObject({ ok: true });
    });
});
