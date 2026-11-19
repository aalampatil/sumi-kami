import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { LocalPrivateFileStore } from "../files";

test("private storage preserves existing objects and rejects paths outside its directory", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sumikami-private-files-"));
  const previous = process.env.UPLOAD_DIRECTORY;
  process.env.UPLOAD_DIRECTORY = directory;
  try {
    const store = new LocalPrivateFileStore(),
      key = randomUUID(),
      bytes = Buffer.from("Private response");
    await store.put(key, bytes);
    await assert.rejects(() => store.put(key, Buffer.from("Overwrite")), { code: "EEXIST" });
    assert.deepEqual(await store.read(key), bytes);
    for (const invalid of ["../escape", "/absolute.txt", "..\\escape", "file.txt"])
      await assert.rejects(() => store.put(invalid, bytes), /Invalid private object key/);
    await store.remove(key);
    await store.remove(key);
    await assert.rejects(() => store.read(key), { code: "ENOENT" });
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_DIRECTORY;
    else process.env.UPLOAD_DIRECTORY = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test("production storage requires an absolute private directory", async () => {
  const previous = { directory: process.env.UPLOAD_DIRECTORY, environment: process.env.NODE_ENV };
  try {
    for (const environment of ["production", "prod"]) {
      process.env.NODE_ENV = environment;
      for (const directory of [undefined, ".data/uploads"]) {
        if (directory === undefined) delete process.env.UPLOAD_DIRECTORY;
        else process.env.UPLOAD_DIRECTORY = directory;
        await assert.rejects(
          () => new LocalPrivateFileStore().read(randomUUID()),
          /absolute UPLOAD_DIRECTORY/,
        );
      }
    }
  } finally {
    if (previous.directory === undefined) delete process.env.UPLOAD_DIRECTORY;
    else process.env.UPLOAD_DIRECTORY = previous.directory;
    if (previous.environment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.environment;
  }
});
