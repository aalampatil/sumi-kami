import assert from "node:assert/strict";
import test from "node:test";
import { suggestWorkspaceSlug } from "../../../../apps/web/lib/workspace-slug";

test("convert human titles to readable addresses", () => {
  assert.equal(suggestWorkspaceSlug("My Design Studio"), "my-design-studio");
});

test("normalize accented Latin names", () => {
  assert.equal(suggestWorkspaceSlug("Café Étude"), "cafe-etude");
});

test("remove unsafe path punctuation", () => {
  assert.equal(suggestWorkspaceSlug("../Design / Studio../"), "design-studio");
});

test("collapse repeated separator characters", () => {
  assert.equal(suggestWorkspaceSlug("Design  --  Studio"), "design-studio");
});

test("leave non-Latin names ready for an explicit address", () => {
  assert.equal(suggestWorkspaceSlug("墨と紙"), "");
});
