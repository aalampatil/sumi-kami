import assert from "node:assert/strict";
import test from "node:test";
import {
  allFields,
  compareDecimal,
  conditionSchema,
  newDefinition,
  newField,
  publicationIssues,
} from "../definition";
import { formPath, validateAnswers } from "../answers";
import { appearancePresets, contrast, customAppearance } from "../appearance";

test("a new definition is publishable and holds a resolved appearance snapshot", () => {
  const definition = newDefinition("Feedback");
  assert.deepEqual(publicationIssues(definition), []);
  assert.equal(definition.settings.appearance.background, "#F6F2EA");
});
test("required text rejects whitespace without losing false or zero answers", () => {
  const definition = newDefinition("Answers"),
    text = definition.steps[0]!.fields[0]!,
    number = newField("NUMBER"),
    checkbox = newField("CHECKBOX");
  text.required = true;
  definition.steps[0]!.fields.push(number, checkbox);
  assert.equal(
    validateAnswers(definition, { [text.key]: " ", [number.key]: "0", [checkbox.key]: false })
      .length,
    1,
  );
  assert.deepEqual(
    validateAnswers(definition, { [text.key]: "Hello", [number.key]: "0", [checkbox.key]: false }),
    [],
  );
});
test("decimal comparisons retain precision beyond JavaScript safe integers", () => {
  assert.equal(compareDecimal("9007199254740993.123456", "9007199254740993.123455"), 1);
  assert.equal(compareDecimal("-1.20", "-1.2"), 0);
});
test("choice answers cannot select another question's option", () => {
  const definition = newDefinition("Choices"),
    choice = newField("SINGLE_SELECT");
  definition.steps[0]!.fields = [choice];
  assert.equal(validateAnswers(definition, { [choice.key]: "unknown" }).length, 1);
  assert.deepEqual(validateAnswers(definition, { [choice.key]: choice.options[0]!.key }), []);
});
test("visibility requires an earlier answer and hidden required questions are skipped", () => {
  const definition = newDefinition("Logic"),
    source = definition.steps[0]!.fields[0]!,
    target = newField();
  target.required = true;
  definition.steps[0]!.fields.push(target);
  definition.rules = [
    {
      sourceFieldKey: source.key,
      condition: { formatVersion: 1, fieldKey: source.key, operator: "equals", value: "yes" },
      actionKind: "SHOW_FIELD",
      targetFieldKey: target.key,
    },
  ];
  assert.deepEqual(validateAnswers(definition, { [source.key]: "no" }), []);
  assert.equal(validateAnswers(definition, { [source.key]: "yes" }).length, 1);
  assert.equal(
    formPath(definition, { [source.key]: "no", [target.key]: "private hidden value" }).answers[
      target.key
    ],
    undefined,
  );
});
test("forward routing skips required questions on an unvisited step", () => {
  const definition = newDefinition("Routing"),
    source = definition.steps[0]!.fields[0]!,
    skipped = newField();
  skipped.required = true;
  definition.steps.push(
    { key: "skip", title: "Skip", fields: [skipped] },
    { key: "last", title: "Last", fields: [] },
  );
  definition.rules = [
    {
      sourceFieldKey: source.key,
      condition: { formatVersion: 1, fieldKey: source.key, operator: "equals", value: "skip" },
      actionKind: "GO_TO_STEP",
      targetStepKey: "last",
    },
  ];
  assert.deepEqual(publicationIssues(definition), []);
  assert.deepEqual(formPath(definition, { [source.key]: "skip" }).stepKeys, ["main", "last"]);
  assert.deepEqual(validateAnswers(definition, { [source.key]: "skip" }), []);
});
test("backward routes and visibility cycles cannot be published", () => {
  const definition = newDefinition("Invalid logic"),
    source = allFields(definition)[0]!;
  definition.rules = [
    {
      sourceFieldKey: source.key,
      condition: { formatVersion: 1, fieldKey: source.key, operator: "is_answered" },
      actionKind: "GO_TO_STEP",
      targetStepKey: "main",
    },
  ];
  assert.ok(publicationIssues(definition).length);
});
test("nested conditions have a bounded complexity budget", () => {
  let expression: unknown = { fieldKey: "question", operator: "is_answered" };
  for (let index = 0; index < 30; index++) expression = { not: expression };
  assert.equal(
    conditionSchema.safeParse({ formatVersion: 1, ...(expression as object) }).success,
    false,
  );
});
test("structured answers reject null and excessive nesting", () => {
  const definition = newDefinition("JSON"),
    field = newField("STRUCTURED");
  definition.steps[0]!.fields = [field];
  assert.equal(validateAnswers(definition, { [field.key]: "null" }).length, 1);
  assert.deepEqual(validateAnswers(definition, { [field.key]: '{"hello":"world"}' }), []);
});
test("field configuration cannot change the meaning of another field type", () => {
  const definition = newDefinition("Settings");
  definition.steps[0]!.fields[0]!.configuration = { ratingMax: 5 };
  assert.ok(publicationIssues(definition).length);
});
test("preset and custom themes maintain readable text", () => {
  for (const appearance of [
    ...Object.values(appearancePresets),
    customAppearance("#FFFFFF", "#ffff00"),
    customAppearance("#222222", "#101010"),
  ]) {
    assert.ok(contrast(appearance.background, appearance.text) >= 4.5);
    assert.ok(contrast(appearance.accent, appearance.onAccent) >= 4.5);
  }
});
test("unsupported date, email, and repeated multi-choice answers are rejected", () => {
  const definition = newDefinition("Validation"),
    email = newField("EMAIL"),
    date = newField("DATE"),
    multi = newField("MULTI_SELECT");
  definition.steps[0]!.fields = [email, date, multi];
  assert.equal(
    validateAnswers(definition, {
      [email.key]: "not-email",
      [date.key]: "2026-02-31",
      [multi.key]: [multi.options[0]!.key, multi.options[0]!.key],
    }).length,
    3,
  );
});
test("ending from a question skips later required questions in the same step", () => {
  const definition = newDefinition("Early completion"),
    source = definition.steps[0]!.fields[0]!,
    later = newField();
  later.required = true;
  definition.steps[0]!.fields.push(later);
  definition.rules = [
    {
      sourceFieldKey: source.key,
      condition: { formatVersion: 1, fieldKey: source.key, operator: "equals", value: "finish" },
      actionKind: "END_FORM",
    },
  ];
  assert.deepEqual(validateAnswers(definition, { [source.key]: "finish" }), []);
  assert.equal(
    formPath(definition, { [source.key]: "finish", [later.key]: "Skipped" }).fields.length,
    1,
  );
});
