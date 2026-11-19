import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, open, readFile, rm, type FileHandle } from "node:fs/promises";
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

test("a failed partial write removes its new object and allows a complete retry", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "sumikami-private-partial-"));
  const previous = process.env.UPLOAD_DIRECTORY;
  process.env.UPLOAD_DIRECTORY = directory;
  const key = randomUUID(),
    bytes = Buffer.from("A complete private response");
  try {
    const probe = await open(join(directory, "probe"), "wx");
    const prototype = Object.getPrototypeOf(probe) as FileHandle;
    const write = probe.writeFile;
    await probe.close();
    context.mock.method(prototype, "writeFile", async function (this: FileHandle, value: Buffer) {
      await write.call(this, value.subarray(0, 3));
      assert.deepEqual(await readFile(join(directory, key)), bytes.subarray(0, 3));
      throw new Error("Simulated disk write failure");
    });
    const store = new LocalPrivateFileStore();
    await assert.rejects(() => store.put(key, bytes), /Simulated disk write failure/);
    await assert.rejects(() => store.read(key), { code: "ENOENT" });
    context.mock.restoreAll();
    await store.put(key, bytes);
    assert.deepEqual(await store.read(key), bytes);
  } finally {
    context.mock.restoreAll();
    if (previous === undefined) delete process.env.UPLOAD_DIRECTORY;
    else process.env.UPLOAD_DIRECTORY = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
