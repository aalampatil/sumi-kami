import assert from "node:assert/strict";
import { test as runTest } from "node:test";
import { randomUUID } from "node:crypto";
import { newField } from "@repo/form-core/definition";
import { getFixture } from "../../workspaces/integration/fixture";
import type { FormService } from "../index";
import type { PublicFormService } from "../public";
import type { ResponseService } from "../responses";
import { FormError } from "../errors";
import { WorkspaceAccessError } from "../../workspaces/errors";
import type { PrivateFileStore } from "../files";
import { responsePageSchema } from "../model";
let forms: FormService, publicForms: PublicFormService, responses: ResponseService;
function test(name: string, operation: () => Promise<void>) {
  runTest(name, async () => {
    if (!forms) {
      const database = () => getFixture().database;
      getFixture();
      forms = new (await import("../index")).FormService(database);
      publicForms = new (await import("../public")).PublicFormService(database);
      responses = new (await import("../responses")).ResponseService(database);
    }
    await operation();
  });
}
async function create() {
  const f = getFixture();
  return forms.create(f.users.owner, { workspaceId: f.workspace.id, title: "Customer feedback" });
}
async function rejects(operation: () => Promise<unknown>, reason: FormError["reason"]) {
  await assert.rejects(operation, (error) => error instanceof FormError && error.reason === reason);
}
test("unpublished drafts are private and viewer permissions are enforced", async () => {
  const f = getFixture(),
    form = await create();
  await rejects(() => publicForms.get(form.slug), "NOT_FOUND");
  assert.equal(
    (await forms.get(f.users.viewer, { workspaceId: f.workspace.id, formId: form.id })).canEdit,
    false,
  );
  await assert.rejects(
    () => forms.create(f.users.viewer, { workspaceId: f.workspace.id, title: "Forbidden" }),
    (error) => error instanceof WorkspaceAccessError && error.reason === "FORBIDDEN",
  );
  await assert.rejects(
    () => forms.get(f.users.stranger, { workspaceId: f.workspace.id, formId: form.id }),
    (error) => error instanceof WorkspaceAccessError && error.reason === "NOT_FOUND",
  );
});
test("competing draft saves detect stale revisions", async () => {
  const f = getFixture(),
    form = await create();
  const results = await Promise.allSettled([
    forms.save(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
      definition: { ...form.definition, title: "Editor A" },
    }),
    forms.save(f.users.editor, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
      definition: { ...form.definition, title: "Editor B" },
    }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const failed = results.find((result) => result.status === "rejected");
  assert.ok(
    failed &&
      failed.status === "rejected" &&
      failed.reason instanceof FormError &&
      failed.reason.reason === "CONFLICT",
  );
});
test("empty drafts can be saved but cannot be published", async () => {
  const f = getFixture(),
    form = await create();
  form.definition.steps[0]!.fields = [];
  const saved = await forms.save(f.users.owner, {
    workspaceId: f.workspace.id,
    formId: form.id,
    expectedRevision: form.revision,
    definition: form.definition,
  });
  await rejects(
    () =>
      forms.publish(f.users.owner, {
        workspaceId: f.workspace.id,
        formId: form.id,
        expectedRevision: saved.revision,
      }),
    "INVALID",
  );
});
test("publication exposes one immutable definition and a valid submission is readable", async () => {
  const f = getFixture(),
    form = await create(),
    published = await forms.publish(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
    });
  const publicForm = await publicForms.get(form.slug);
  assert.equal(publicForm.versionId, published.versionId);
  const receipt = await publicForms.submit({
    slug: form.slug,
    versionId: published.versionId,
    idempotencyKey: randomUUID(),
    answers: [
      { fieldKey: form.definition.steps[0]!.fields[0]!.key, value: "A thoughtful product" },
    ],
  });
  assert.ok(receipt.id);
  const page = await responses.list(f.users.viewer, {
    workspaceId: f.workspace.id,
    formId: form.id,
    limit: 20,
  });
  responsePageSchema.parse(page);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0]!.answers[0]!.text, "A thoughtful product");
});
test("invalid required answers roll back the complete submission", async () => {
  const f = getFixture(),
    form = await create();
  form.definition.steps[0]!.fields[0]!.required = true;
  const saved = await forms.save(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
      definition: form.definition,
    }),
    published = await forms.publish(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: saved.revision,
    });
  await rejects(
    () =>
      publicForms.submit({
        slug: form.slug,
        versionId: published.versionId,
        idempotencyKey: randomUUID(),
        answers: [],
      }),
    "INVALID",
  );
  assert.equal(
    (
      await f.pool.query("SELECT count(*) FROM builder.form_submissions WHERE form_id=$1", [
        form.id,
      ])
    ).rows[0].count,
    "0",
  );
});
test("concurrent retries produce one receipt and conflicting retries are rejected", async () => {
  const f = getFixture(),
    form = await create(),
    published = await forms.publish(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
    });
  const input = {
    slug: form.slug,
    versionId: published.versionId,
    idempotencyKey: randomUUID(),
    answers: [{ fieldKey: form.definition.steps[0]!.fields[0]!.key, value: "Once" }],
  };
  const results = await Promise.all(Array.from({ length: 5 }, () => publicForms.submit(input)));
  assert.equal(new Set(results.map((result) => result.id)).size, 1);
  assert.equal(
    (
      await f.pool.query("SELECT count(*) FROM builder.form_submissions WHERE form_id=$1", [
        form.id,
      ])
    ).rows[0].count,
    "1",
  );
  await rejects(
    () => publicForms.submit({ ...input, answers: [{ ...input.answers[0]!, value: "Different" }] }),
    "CONFLICT",
  );
});
test("new drafts and republishing preserve original question labels and receipts", async () => {
  const f = getFixture(),
    form = await create(),
    first = await forms.publish(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
    });
  const input = {
    slug: form.slug,
    versionId: first.versionId,
    idempotencyKey: randomUUID(),
    answers: [{ fieldKey: form.definition.steps[0]!.fields[0]!.key, value: "Original answer" }],
  };
  const receipt = await publicForms.submit(input);
  const draft = await forms.edit(f.users.editor, { workspaceId: f.workspace.id, formId: form.id });
  assert.notEqual(draft.versionId, first.versionId);
  draft.definition.steps[0]!.fields[0]!.label = "A revised question";
  const saved = await forms.save(f.users.editor, {
    workspaceId: f.workspace.id,
    formId: form.id,
    expectedRevision: draft.revision,
    definition: draft.definition,
  });
  assert.equal(
    (await publicForms.get(form.slug)).definition.steps[0]!.fields[0]!.label,
    form.definition.steps[0]!.fields[0]!.label,
  );
  await forms.publish(f.users.editor, {
    workspaceId: f.workspace.id,
    formId: form.id,
    expectedRevision: saved.revision,
  });
  const original = (
    await responses.list(f.users.owner, { workspaceId: f.workspace.id, formId: form.id, limit: 20 })
  ).items[0]!;
  assert.equal(original.versionNumber, 1);
  assert.equal(original.answers[0]!.label, form.definition.steps[0]!.fields[0]!.label);
  assert.equal((await publicForms.submit(input)).id, receipt.id);
  await rejects(() => publicForms.submit({ ...input, idempotencyKey: randomUUID() }), "CONFLICT");
});
test("typed answers preserve exact decimals, selections, false, dates and JSON", async () => {
  const f = getFixture(),
    form = await create(),
    number = newField("NUMBER"),
    choice = newField("MULTI_SELECT"),
    checkbox = newField("CHECKBOX"),
    date = newField("DATE"),
    json = newField("STRUCTURED");
  form.definition.steps[0]!.fields = [number, choice, checkbox, date, json];
  const saved = await forms.save(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
      definition: form.definition,
    }),
    published = await forms.publish(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: saved.revision,
    });
  await publicForms.submit({
    slug: form.slug,
    versionId: published.versionId,
    idempotencyKey: randomUUID(),
    answers: [
      { fieldKey: number.key, value: "9007199254740993.123456" },
      { fieldKey: choice.key, value: [choice.options[1]!.key] },
      { fieldKey: checkbox.key, value: false },
      { fieldKey: date.key, value: "2026-11-19" },
      { fieldKey: json.key, value: '{"message":"hello"}' },
    ],
  });
  const answers = (
    await responses.list(f.users.owner, { workspaceId: f.workspace.id, formId: form.id, limit: 20 })
  ).items[0]!.answers;
  assert.equal(
    answers.find((answer) => answer.fieldKey === number.key)!.text,
    "9007199254740993.123456",
  );
  assert.equal(answers.find((answer) => answer.fieldKey === choice.key)!.text, "Second option");
  assert.equal(answers.find((answer) => answer.fieldKey === checkbox.key)!.text, "No");
  assert.equal(answers.find((answer) => answer.fieldKey === date.key)!.text, "2026-11-19");
  assert.equal(answers.find((answer) => answer.fieldKey === json.key)!.text, '{"message":"hello"}');
});
test("optional whitespace answers are omitted without losing zero, false, or meaningful text", async () => {
  const f = getFixture(),
    form = await create();
  const blank = [
    "SHORT_TEXT",
    "LONG_TEXT",
    "EMAIL",
    "NUMBER",
    "RATING",
    "SINGLE_SELECT",
    "DROPDOWN",
    "DATE",
    "DATETIME",
    "STRUCTURED",
  ].map((type) => newField(type as Parameters<typeof newField>[0]));
  const number = newField("NUMBER"),
    checkbox = newField("CHECKBOX"),
    text = newField();
  form.definition.steps[0]!.fields = [...blank, number, checkbox, text];
  const saved = await forms.save(f.users.owner, {
    workspaceId: f.workspace.id,
    formId: form.id,
    expectedRevision: form.revision,
    definition: form.definition,
  });
  const published = await forms.publish(f.users.owner, {
    workspaceId: f.workspace.id,
    formId: form.id,
    expectedRevision: saved.revision,
  });
  const input = {
    slug: form.slug,
    versionId: published.versionId,
    idempotencyKey: randomUUID(),
    answers: [
      ...blank.map((field) => ({ fieldKey: field.key, value: " \t\n " })),
      { fieldKey: number.key, value: "0" },
      { fieldKey: checkbox.key, value: false },
      { fieldKey: text.key, value: "  Keep these spaces  " },
    ],
  };
  const receipt = await publicForms.submit(input);
  assert.equal((await publicForms.submit(input)).id, receipt.id);
  const page = await responses.list(f.users.owner, {
    workspaceId: f.workspace.id,
    formId: form.id,
    limit: 20,
  });
  const answers = page.items[0]!.answers;
  assert.equal(answers.length, 3);
  assert.equal(answers.find((answer) => answer.fieldKey === number.key)!.text, "0");
  assert.equal(answers.find((answer) => answer.fieldKey === checkbox.key)!.text, "No");
  assert.equal(
    answers.find((answer) => answer.fieldKey === text.key)!.text,
    "  Keep these spaces  ",
  );
});
test("closed and archived forms reject new intake while existing receipts remain stable", async () => {
  const f = getFixture(),
    form = await create(),
    published = await forms.publish(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
    });
  const input = {
    slug: form.slug,
    versionId: published.versionId,
    idempotencyKey: randomUUID(),
    answers: [],
  };
  const receipt = await publicForms.submit(input);
  await forms.unpublish(f.users.owner, { workspaceId: f.workspace.id, formId: form.id });
  await rejects(() => publicForms.get(form.slug), "NOT_FOUND");
  assert.equal((await publicForms.submit(input)).id, receipt.id);
  await rejects(() => publicForms.submit({ ...input, idempotencyKey: randomUUID() }), "NOT_FOUND");
  await forms.archive(f.users.owner, {
    workspaceId: f.workspace.id,
    formId: form.id,
    archived: true,
  });
  await rejects(
    () => forms.edit(f.users.owner, { workspaceId: f.workspace.id, formId: form.id }),
    "CONFLICT",
  );
});
test("unknown answer keys and option keys cannot be stored", async () => {
  const f = getFixture(),
    form = await create(),
    choice = newField("SINGLE_SELECT");
  form.definition.steps[0]!.fields = [choice];
  const saved = await forms.save(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
      definition: form.definition,
    }),
    published = await forms.publish(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: saved.revision,
    });
  for (const answers of [
    [{ fieldKey: "unknown", value: "intruder" }],
    [{ fieldKey: choice.key, value: "foreign_option" }],
  ])
    await rejects(
      () =>
        publicForms.submit({
          slug: form.slug,
          versionId: published.versionId,
          idempotencyKey: randomUUID(),
          answers,
        }),
      "INVALID",
    );
});
test("a hidden required answer is neither required nor stored", async () => {
  const f = getFixture(),
    form = await create(),
    source = form.definition.steps[0]!.fields[0]!,
    target = newField();
  target.required = true;
  form.definition.steps[0]!.fields.push(target);
  form.definition.rules = [
    {
      sourceFieldKey: source.key,
      condition: { formatVersion: 1, fieldKey: source.key, operator: "equals", value: "show" },
      actionKind: "SHOW_FIELD",
      targetFieldKey: target.key,
    },
  ];
  const saved = await forms.save(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
      definition: form.definition,
    }),
    published = await forms.publish(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: saved.revision,
    });
  await publicForms.submit({
    slug: form.slug,
    versionId: published.versionId,
    idempotencyKey: randomUUID(),
    answers: [
      { fieldKey: source.key, value: "hide" },
      { fieldKey: target.key, value: "Hidden" },
    ],
  });
  assert.equal(
    (
      await responses.list(f.users.owner, {
        workspaceId: f.workspace.id,
        formId: form.id,
        limit: 20,
      })
    ).items[0]!.answers.length,
    1,
  );
});
test("duplication creates a separate unpublished definition", async () => {
  const f = getFixture(),
    form = await create(),
    copy = await forms.duplicate(f.users.editor, { workspaceId: f.workspace.id, formId: form.id });
  assert.notEqual(copy.id, form.id);
  assert.notEqual(copy.slug, form.slug);
  assert.notEqual(copy.versionId, form.versionId);
  assert.equal(copy.status, "DRAFT");
  assert.equal(copy.definition.steps[0]!.fields[0]!.key, form.definition.steps[0]!.fields[0]!.key);
});

class MemoryFiles implements PrivateFileStore {
  readonly objects = new Map<string, Buffer>();
  async put(key: string, bytes: Buffer) {
    this.objects.set(key, bytes);
  }
  async read(key: string) {
    const bytes = this.objects.get(key);
    if (!bytes) throw new Error("Missing");
    return bytes;
  }
  async remove(key: string) {
    this.objects.delete(key);
  }
}
async function fileForm(maxFiles = 1) {
  const f = getFixture(),
    form = await create(),
    field = newField("FILE");
  field.required = true;
  field.configuration = { maxFiles, accept: ["text/plain"], maxBytes: 1024 };
  form.definition.steps[0]!.fields = [field];
  const saved = await forms.save(f.users.owner, {
    workspaceId: f.workspace.id,
    formId: form.id,
    expectedRevision: form.revision,
    definition: form.definition,
  });
  const published = await forms.publish(f.users.owner, {
    workspaceId: f.workspace.id,
    formId: form.id,
    expectedRevision: saved.revision,
  });
  return {
    form: published,
    field,
    input: {
      slug: form.slug,
      versionId: published.versionId,
      idempotencyKey: randomUUID(),
      answers: [],
    },
  };
}
test("attachments are private, bound to the response, and idempotent across retries", async () => {
  const f = getFixture(),
    store = new MemoryFiles(),
    publicService = new (await import("../public")).PublicFormService(() => f.database, store),
    responseService = new (await import("../responses")).ResponseService(() => f.database, store);
  const { form, field, input } = await fileForm(),
    uploads = [
      { fieldKey: field.key, name: "notes.txt", bytes: Buffer.from("Thoughtful questions") },
    ];
  const first = await publicService.submit(input, uploads),
    retry = await publicService.submit(input, uploads);
  assert.equal(first.id, retry.id);
  assert.equal(store.objects.size, 1);
  const answer = (
    await responseService.list(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      limit: 20,
    })
  ).items[0]!.answers[0]!;
  assert.equal(answer.text, "notes.txt");
  const downloaded = await responseService.download(f.users.viewer, {
    workspaceId: f.workspace.id,
    formId: form.id,
    fileId: answer.fileIds[0]!,
  });
  assert.equal(downloaded.bytes.toString(), "Thoughtful questions");
  await assert.rejects(
    () =>
      responseService.download(f.users.stranger, {
        workspaceId: f.workspace.id,
        formId: form.id,
        fileId: answer.fileIds[0]!,
      }),
    (error) => error instanceof WorkspaceAccessError,
  );
  await rejects(
    () => publicService.submit(input, [{ ...uploads[0]!, bytes: Buffer.from("Changed") }]),
    "CONFLICT",
  );
  const other = await create();
  await rejects(
    () =>
      responseService.download(f.users.owner, {
        workspaceId: f.workspace.id,
        formId: other.id,
        fileId: answer.fileIds[0]!,
      }),
    "NOT_FOUND",
  );
});
test("file IDs, invalid file types and oversized files cannot enter submissions", async () => {
  const f = getFixture(),
    store = new MemoryFiles(),
    service = new (await import("../public")).PublicFormService(() => f.database, store),
    { form, field, input } = await fileForm();
  await rejects(
    () => service.submit({ ...input, answers: [{ fieldKey: field.key, value: [randomUUID()] }] }),
    "INVALID",
  );
  await rejects(
    () =>
      service.submit(input, [
        { fieldKey: field.key, name: "large.txt", bytes: Buffer.alloc(1025, 65) },
      ]),
    "INVALID",
  );
  await rejects(
    () =>
      service.submit(input, [
        { fieldKey: field.key, name: "fake.txt", bytes: Buffer.from("%PDF-1.4 fake") },
      ]),
    "INVALID",
  );
  assert.equal(store.objects.size, 0);
  assert.equal(
    (
      await f.pool.query("SELECT count(*) FROM builder.form_submissions WHERE form_id=$1", [
        form.id,
      ])
    ).rows[0].count,
    "0",
  );
});
test("a file storage failure rolls back answer rows and removes newly written bytes", async () => {
  const f = getFixture(),
    store = new MemoryFiles(),
    put = store.put.bind(store);
  let calls = 0;
  store.put = async (key, bytes) => {
    if (++calls === 2) throw new Error("Storage failure");
    await put(key, bytes);
  };
  const service = new (await import("../public")).PublicFormService(() => f.database, store),
    { form, field, input } = await fileForm(2);
  await assert.rejects(
    () =>
      service.submit(input, [
        { fieldKey: field.key, name: "one.txt", bytes: Buffer.from("One") },
        { fieldKey: field.key, name: "two.txt", bytes: Buffer.from("Two") },
      ]),
    /Storage failure/,
  );
  assert.equal(store.objects.size, 0);
  assert.equal(
    (
      await f.pool.query("SELECT count(*) FROM builder.form_submissions WHERE form_id=$1", [
        form.id,
      ])
    ).rows[0].count,
    "0",
  );
});
test("exports require export permissions, escape spreadsheet formulas, and keep version context", async () => {
  const f = getFixture(),
    form = await create(),
    published = await forms.publish(f.users.owner, {
      workspaceId: f.workspace.id,
      formId: form.id,
      expectedRevision: form.revision,
    });
  await publicForms.submit({
    slug: form.slug,
    versionId: published.versionId,
    idempotencyKey: randomUUID(),
    answers: [
      {
        fieldKey: form.definition.steps[0]!.fields[0]!.key,
        value: '=HYPERLINK("https://example.invalid")',
      },
    ],
  });
  const input = { workspaceId: f.workspace.id, formId: form.id, limit: 20 };
  await assert.rejects(
    () => responses.exportPage(f.users.viewer, input),
    (error) => error instanceof WorkspaceAccessError && error.reason === "FORBIDDEN",
  );
  const exported = await responses.exportPage(f.users.editor, input);
  assert.match(exported.csv, /'=HYPERLINK/);
  assert.ok(exported.csv.includes(published.versionId));
  assert.ok(exported.csv.includes("Question key"));
  const reporting = new (await import("../reporting")).FormReportingService(() => f.database),
    summary = await reporting.summary(f.users.viewer, {
      workspaceId: input.workspaceId,
      formId: input.formId,
    });
  assert.equal(summary.total, 1);
  assert.equal(summary.recent, 1);
  assert.equal(
    summary.daily.reduce((sum, day) => sum + day.count, 0),
    1,
  );
  assert.equal(summary.versions[0]!.versionNumber, 1);
  await f.pool.query("UPDATE builder.form_submissions SET expires_at=started_at WHERE form_id=$1", [
    form.id,
  ]);
  assert.equal(
    (
      await reporting.summary(f.users.owner, {
        workspaceId: input.workspaceId,
        formId: input.formId,
      })
    ).total,
    0,
  );
  assert.equal((await responses.list(f.users.owner, input)).items.length, 0);
});
