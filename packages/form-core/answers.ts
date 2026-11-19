import { z } from "zod";
import {
  allFields,
  compareDecimal,
  decimalSchema,
  type Answers,
  type AnswerValue,
  type ConditionNode,
  type FieldIssue,
  type FormDefinition,
  type FormField,
} from "./definition";

export function isAnswered(value: AnswerValue | undefined): boolean {
  return typeof value === "string"
    ? value.trim().length > 0
    : Array.isArray(value)
      ? value.length > 0
      : typeof value === "boolean";
}
export function matches(
  condition: ConditionNode,
  answers: Answers,
  definition: FormDefinition,
): boolean {
  if ("all" in condition)
    return condition.all.every((child) => matches(child, answers, definition));
  if ("any" in condition) return condition.any.some((child) => matches(child, answers, definition));
  if ("not" in condition) return !matches(condition.not, answers, definition);
  const value = answers[condition.fieldKey];
  if (condition.operator === "is_answered") return isAnswered(value);
  if (value === undefined) return false;
  if (condition.operator === "contains")
    return typeof value === "string" && typeof condition.value === "string"
      ? value.includes(condition.value)
      : Array.isArray(value) &&
          typeof condition.value === "string" &&
          value.includes(condition.value);
  const field = allFields(definition).find((field) => field.key === condition.fieldKey);
  const numeric =
    field &&
    ["NUMBER", "RATING"].includes(field.type) &&
    typeof value === "string" &&
    typeof condition.value === "string" &&
    decimalSchema.safeParse(value).success &&
    decimalSchema.safeParse(condition.value).success;
  if (condition.operator === "greater_than")
    return Boolean(numeric && compareDecimal(value as string, condition.value as string) > 0);
  if (condition.operator === "less_than")
    return Boolean(numeric && compareDecimal(value as string, condition.value as string) < 0);
  const equal = numeric
    ? compareDecimal(value as string, condition.value as string) === 0
    : Array.isArray(value)
      ? typeof condition.value === "string" && value.includes(condition.value)
      : value === condition.value;
  return condition.operator === "not_equals" ? !equal : equal;
}
/** Forward-only routing and earlier-question visibility are validated at publication. */
export function formPath(
  definition: FormDefinition,
  answers: Answers,
): { stepKeys: string[]; fields: FormField[]; answers: Answers } {
  const stepKeys: string[] = [],
    fields: FormField[] = [];
  const visibleAnswers: Answers = {};
  let index = 0;
  while (index < definition.steps.length) {
    const step = definition.steps[index]!;
    stepKeys.push(step.key);
    let next = index + 1;
    for (const field of step.fields) {
      const rules = definition.rules.filter((rule) => rule.targetFieldKey === field.key);
      let visible = !rules.some((rule) => rule.actionKind === "SHOW_FIELD");
      for (const rule of rules)
        if (matches(rule.condition, visibleAnswers, definition))
          visible = rule.actionKind === "SHOW_FIELD";
      if (visible) {
        fields.push(field);
        if (answers[field.key] !== undefined) visibleAnswers[field.key] = answers[field.key]!;
        const route = definition.rules.find(
          (rule) =>
            rule.sourceFieldKey === field.key &&
            ["GO_TO_STEP", "END_FORM"].includes(rule.actionKind) &&
            matches(rule.condition, visibleAnswers, definition),
        );
        if (route) {
          next =
            route.actionKind === "END_FORM"
              ? definition.steps.length
              : definition.steps.findIndex((step) => step.key === route.targetStepKey);
          break;
        }
      }
    }
    if (next <= index) break;
    index = next;
  }
  return { stepKeys, fields, answers: visibleAnswers };
}
function boundedJson(value: unknown): boolean {
  const queue = [{ value, depth: 0 }];
  let count = 0;
  while (queue.length) {
    const item = queue.pop()!;
    if (++count > 1000 || item.depth > 20) return false;
    if (item.value && typeof item.value === "object")
      for (const child of Object.values(item.value))
        queue.push({ value: child, depth: item.depth + 1 });
  }
  return true;
}
export function validateAnswers(definition: FormDefinition, answers: Answers): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const known = new Set(allFields(definition).map((field) => field.key));
  for (const key of Object.keys(answers))
    if (!known.has(key))
      issues.push({ fieldKey: key, message: "This question does not belong to the form." });
  for (const field of formPath(definition, answers).fields) {
    const value = answers[field.key];
    const config = field.configuration;
    const add = (message: string) => issues.push({ fieldKey: field.key, message });
    if (!isAnswered(value)) {
      if (field.required) add("Please answer this question.");
      continue;
    }
    if (field.type === "CHECKBOX") {
      if (typeof value !== "boolean") add("Choose a valid checkbox value.");
      else if (field.required && !value) add("Please select this checkbox.");
      continue;
    }
    if (["MULTI_SELECT", "FILE"].includes(field.type)) {
      if (!Array.isArray(value) || new Set(value).size !== value.length) {
        add("Choose each answer only once.");
        continue;
      }
      if (field.type === "FILE") {
        if (
          value.length > (config.maxFiles ?? 1) ||
          value.some((id) => !z.uuid().safeParse(id).success)
        )
          add("Choose valid uploaded files within the file limit.");
      } else if (
        value.some((key) => !field.options.some((option) => option.key === key)) ||
        value.length < Math.max(field.required ? 1 : 0, config.minSelections ?? 0) ||
        value.length > (config.maxSelections ?? field.options.length)
      )
        add("Choose answers within the selection limits.");
      continue;
    }
    if (typeof value !== "string") {
      add("Enter a valid answer for this question.");
      continue;
    }
    switch (field.type) {
      case "SHORT_TEXT":
      case "LONG_TEXT":
        if (
          value.length < (config.minLength ?? 0) ||
          value.length > (config.maxLength ?? (field.type === "SHORT_TEXT" ? 500 : 20000))
        )
          add("Check the allowed answer length.");
        break;
      case "EMAIL":
        if (!z.email().max(254).safeParse(value.trim()).success)
          add("Enter a valid email address.");
        break;
      case "NUMBER":
      case "RATING":
        if (!decimalSchema.safeParse(value).success) add("Enter a decimal number.");
        else if (
          field.type === "RATING" &&
          (!/^\d+$/.test(value) ||
            compareDecimal(value, "1") < 0 ||
            compareDecimal(value, String(config.ratingMax ?? 5)) > 0)
        )
          add("Choose a rating in the displayed range.");
        else if (
          (config.min !== undefined && compareDecimal(value, config.min) < 0) ||
          (config.max !== undefined && compareDecimal(value, config.max) > 0)
        )
          add("Enter a number within the allowed range.");
        break;
      case "SINGLE_SELECT":
      case "DROPDOWN":
        if (!field.options.some((option) => option.key === value))
          add("Choose one of the listed answers.");
        break;
      case "DATE":
        if (!z.iso.date().safeParse(value).success || value.startsWith("0000"))
          add("Enter a valid date.");
        break;
      case "DATETIME":
        if (!z.iso.datetime({ offset: true }).safeParse(value).success || value.startsWith("0000"))
          add("Enter a date and time with a timezone.");
        break;
      case "STRUCTURED":
        try {
          const parsed: unknown = JSON.parse(value);
          if (parsed === null || !boundedJson(parsed))
            add("Enter non-null JSON with at most 20 levels and 1,000 values.");
        } catch {
          add("Enter valid JSON.");
        }
        break;
    }
  }
  return issues;
}
export function answerText(field: FormField, value: AnswerValue | undefined): string {
  if (value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value))
    return value
      .map((key) => field.options.find((option) => option.key === key)?.label ?? key)
      .join(", ");
  return field.options.find((option) => option.key === value)?.label ?? value;
}
