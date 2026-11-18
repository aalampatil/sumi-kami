import assert from "node:assert/strict";
import test from "node:test";
import { suggestWorkspaceSlug } from "../../../../apps/web/lib/workspace-slug";

test("convert human titles to readable addresses", () => {
  assert.equal(suggestWorkspaceSlug("My Design Studio"), "my-design-studio");
});
