import { z } from "zod";
import { appearanceSchema, appearancePresets, contrast } from "./appearance";

export const fieldTypes = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "EMAIL",
  "NUMBER",
  "SINGLE_SELECT",
  "DROPDOWN",
  "MULTI_SELECT",
  "CHECKBOX",
  "RATING",
  "DATE",
  "DATETIME",
  "STRUCTURED",
  "FILE",
] as const;
export type FieldType = (typeof fieldTypes)[number];
export const fieldLabels: Record<FieldType, string> = {
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
  EMAIL: "Email",
  NUMBER: "Number",
  SINGLE_SELECT: "Single choice",
  DROPDOWN: "Dropdown",
  MULTI_SELECT: "Multiple choice",
  CHECKBOX: "Checkbox",
  RATING: "Rating",
  DATE: "Date",
  DATETIME: "Date and time",
  STRUCTURED: "Structured JSON",
  FILE: "File upload",
};
export const keySchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/);
export const decimalSchema = z
  .string()
  .regex(
    /^-?(?:0|[1-9]\d{0,29})(?:\.\d{1,12})?$/,
    "Enter a decimal number with up to 30 whole and 12 decimal digits.",
  );
export const optionSchema = z.strictObject({
  key: keySchema,
  label: z.string().trim().min(1).max(500),
});
export const configurationSchema = z.strictObject({
  placeholder: z.string().max(200).optional(),
  minLength: z.number().int().min(0).max(20000).optional(),
  maxLength: z.number().int().min(1).max(20000).optional(),
  min: decimalSchema.optional(),
  max: decimalSchema.optional(),
  minSelections: z.number().int().min(0).max(100).optional(),
  maxSelections: z.number().int().min(1).max(100).optional(),
  ratingMax: z.number().int().min(3).max(10).optional(),
  maxBytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024)
    .optional(),
  maxFiles: z.number().int().min(1).max(5).optional(),
  accept: z
    .array(z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain"]))
    .min(1)
    .max(5)
    .optional(),
});
export const fieldSchema = z.strictObject({
  key: keySchema,
  type: z.enum(fieldTypes),
  label: z.string().trim().min(1, "Give every question a label.").max(500),
  helpText: z.string().max(2000).default(""),
  required: z.boolean().default(false),
  configuration: configurationSchema.default({}),
  options: z.array(optionSchema).max(100).default([]),
});
export type FormField = z.infer<typeof fieldSchema>;
export const stepSchema = z.strictObject({
  key: keySchema,
  title: z.string().max(200).default(""),
  fields: z.array(fieldSchema).max(100),
});

export type ConditionValue = string | boolean | string[];
export type ConditionNode =
  | { all: ConditionNode[] }
  | { any: ConditionNode[] }
  | { not: ConditionNode }
  | {
      fieldKey: string;
      operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "is_answered";
      value?: ConditionValue;
    };
const conditionValueSchema = z.union([
  z.string().max(20000),
  z.boolean(),
  z.array(z.string().max(200)).max(100),
]);
const nodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    z.strictObject({ all: z.array(nodeSchema).min(1).max(20) }),
    z.strictObject({ any: z.array(nodeSchema).min(1).max(20) }),
    z.strictObject({ not: nodeSchema }),
    z.strictObject({
      fieldKey: keySchema,
      operator: z.enum([
        "equals",
        "not_equals",
        "greater_than",
        "less_than",
        "contains",
        "is_answered",
      ]),
      value: conditionValueSchema.optional(),
    }),
  ]),
);
function boundedCondition(value: unknown): boolean {
  const stack = [{ value, depth: 0 }];
  let count = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (++count > 100 || current.depth > 12) return false;
    if (current.value && typeof current.value === "object" && !Array.isArray(current.value)) {
      const node = current.value as Record<string, unknown>;
      for (const name of ["all", "any"])
        if (Array.isArray(node[name]))
          for (const child of node[name]) stack.push({ value: child, depth: current.depth + 1 });
      if (node.not) stack.push({ value: node.not, depth: current.depth + 1 });
    }
  }
  return true;
}
const conditionStructureSchema = z
  .object({ formatVersion: z.literal(1) })
  .catchall(z.unknown())
  .superRefine((value, context) => {
    const { formatVersion: _version, ...node } = value;
    if (!boundedCondition(node)) {
      context.addIssue({
        code: "custom",
        message: "Use at most 100 conditions and 12 levels of nesting.",
      });
      return;
    }
    const parsed = nodeSchema.safeParse(node);
    if (!parsed.success)
      context.addIssue({ code: "custom", message: "The condition expression is invalid." });
  });
export const conditionSchema = conditionStructureSchema as unknown as z.ZodType<
  { formatVersion: 1 } & ConditionNode
>;
export const ruleSchema = z.strictObject({
  sourceFieldKey: keySchema,
  condition: conditionSchema,
  actionKind: z.enum(["SHOW_FIELD", "HIDE_FIELD", "GO_TO_STEP", "END_FORM"]),
  targetFieldKey: keySchema.optional(),
  targetStepKey: keySchema.optional(),
});
export type FormRule = z.infer<typeof ruleSchema>;
export const settingsSchema = z.strictObject({
  appearance: appearanceSchema.default(appearancePresets["japanese-ink"]),
  submitLabel: z.string().trim().min(1).max(80).default("Submit response"),
  completionTitle: z.string().trim().min(1).max(200).default("Thank you."),
  completionMessage: z.string().max(2000).default("Your response has been received."),
  retentionDays: z.number().int().min(1).max(99999).optional(),
  notifyOnResponse: z.boolean().default(true),
});
export const definitionSchema = z.strictObject({
  title: z.string().trim().min(1, "Give your form a title.").max(200),
  description: z.string().max(5000).default(""),
  settings: settingsSchema.default(() => settingsSchema.parse({})),
  steps: z.array(stepSchema).min(1).max(20),
  rules: z.array(ruleSchema).max(50).default([]),
});
export type FormDefinition = z.infer<typeof definitionSchema>;
export type AnswerValue = ConditionValue;
export type Answers = Record<string, AnswerValue>;
export type FieldIssue = { fieldKey: string; message: string };
export function allFields(definition: FormDefinition): FormField[] {
  return definition.steps.flatMap((step) => step.fields);
}
export function newField(type: FieldType = "SHORT_TEXT"): FormField {
  const key = "q_" + crypto.randomUUID().replaceAll("-", "");
  return {
    key,
    type,
    label: type === "SHORT_TEXT" ? "What would you like to share?" : fieldLabels[type],
    helpText: "",
    required: false,
    configuration: {},
    options: ["SINGLE_SELECT", "MULTI_SELECT", "DROPDOWN"].includes(type)
      ? [
          { key: "option_1", label: "First option" },
          { key: "option_2", label: "Second option" },
        ]
      : [],
  };
}
export function newDefinition(title: string): FormDefinition {
  return definitionSchema.parse({
    title,
    steps: [{ key: "main", title: "", fields: [newField()] }],
  });
}
export function compareDecimal(first: string, second: string): number {
  const parts = (value: string) => {
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
    return { value: BigInt(whole! + fraction) * (negative ? -1n : 1n), scale: fraction.length };
  };
  const a = parts(first),
    b = parts(second),
    scale = Math.max(a.scale, b.scale);
  const left = a.value * 10n ** BigInt(scale - a.scale),
    right = b.value * 10n ** BigInt(scale - b.scale);
  return left < right ? -1 : left > right ? 1 : 0;
}
export function publicationIssues(definition: FormDefinition, complete = true): string[] {
  const issues: string[] = [];
  const fields = allFields(definition);
  const fieldMap = new Map(fields.map((field) => [field.key, field]));
  const stepMap = new Map(definition.steps.map((step, index) => [step.key, index]));
  const fieldStep = new Map(
    definition.steps.flatMap((step, index) =>
      step.fields.map((field) => [field.key, index] as const),
    ),
  );
  if (!fields.length && complete) issues.push("Add at least one question before publishing.");
  if (fields.length > 200) issues.push("Use at most 200 questions per form.");
  if (fieldMap.size !== fields.length || stepMap.size !== definition.steps.length)
    issues.push("Question and step keys must be unique.");
  const allowed: Record<FieldType, string[]> = {
    SHORT_TEXT: ["placeholder", "minLength", "maxLength"],
    LONG_TEXT: ["placeholder", "minLength", "maxLength"],
    EMAIL: ["placeholder"],
    NUMBER: ["placeholder", "min", "max"],
    RATING: ["ratingMax"],
    SINGLE_SELECT: [],
    DROPDOWN: [],
    MULTI_SELECT: ["minSelections", "maxSelections"],
    CHECKBOX: [],
    DATE: [],
    DATETIME: [],
    STRUCTURED: [],
    FILE: ["maxBytes", "maxFiles", "accept"],
  };
  for (const field of fields) {
    if (Object.keys(field.configuration).some((key) => !allowed[field.type].includes(key)))
      issues.push(field.label + ": remove settings that don't apply to this question type.");
    const choice = ["SINGLE_SELECT", "DROPDOWN", "MULTI_SELECT"].includes(field.type);
    if (choice ? !field.options.length && complete : Boolean(field.options.length))
      issues.push(field.label + ": check its answer choices.");
    if (new Set(field.options.map((option) => option.key)).size !== field.options.length)
      issues.push(field.label + ": choice keys must be unique.");
    const config = field.configuration;
    if (
      (config.minLength ?? 0) > (config.maxLength ?? 20000) ||
      (config.minSelections ?? 0) > (config.maxSelections ?? field.options.length)
    )
      issues.push(field.label + ": minimum cannot exceed maximum.");
    if (field.type === "MULTI_SELECT" && (config.minSelections ?? 0) > field.options.length)
      issues.push(field.label + ": add enough choices for the minimum selection count.");
    if (
      config.min !== undefined &&
      config.max !== undefined &&
      compareDecimal(config.min, config.max) > 0
    )
      issues.push(field.label + ": minimum cannot exceed maximum.");
  }
  for (const rule of definition.rules) {
    const source = fieldMap.get(rule.sourceFieldKey);
    const sourceStep = fieldStep.get(rule.sourceFieldKey);
    if (!source || sourceStep === undefined) {
      issues.push("A logic rule refers to a missing source question.");
      continue;
    }
    const visibility = rule.actionKind === "SHOW_FIELD" || rule.actionKind === "HIDE_FIELD";
    if (
      visibility
        ? !rule.targetFieldKey || Boolean(rule.targetStepKey)
        : rule.actionKind === "GO_TO_STEP"
          ? !rule.targetStepKey || Boolean(rule.targetFieldKey)
          : Boolean(rule.targetFieldKey || rule.targetStepKey)
    )
      issues.push("Check the target of each logic rule.");
    if (
      visibility &&
      (!fieldMap.has(rule.targetFieldKey!) ||
        fields.findIndex((field) => field.key === rule.targetFieldKey) <=
          fields.findIndex((field) => field.key === source.key))
    )
      issues.push("Visibility rules must target a later question.");
    if (rule.actionKind === "GO_TO_STEP" && (stepMap.get(rule.targetStepKey!) ?? -1) <= sourceStep)
      issues.push("Routing rules must go to a later step.");
    const inspect = (condition: ConditionNode): void => {
      if ("all" in condition) return condition.all.forEach(inspect);
      if ("any" in condition) return condition.any.forEach(inspect);
      if ("not" in condition) return inspect(condition.not);
      const field = fieldMap.get(condition.fieldKey);
      if (
        !field ||
        fields.findIndex((item) => item.key === field.key) >
          fields.findIndex((item) => item.key === source.key)
      ) {
        issues.push("Conditions must refer to the source question or an earlier question.");
        return;
      }
      if (condition.operator !== "is_answered" && condition.value === undefined)
        issues.push("Provide a comparison value for each condition.");
      if (
        ["greater_than", "less_than"].includes(condition.operator) &&
        (!["NUMBER", "RATING"].includes(field.type) ||
          typeof condition.value !== "string" ||
          !decimalSchema.safeParse(condition.value).success)
      )
        issues.push("Numeric conditions require a numeric question and decimal value.");
      if (["equals", "not_equals", "contains"].includes(condition.operator)) {
        if (
          field.type === "CHECKBOX"
            ? typeof condition.value !== "boolean"
            : typeof condition.value !== "string"
        )
          issues.push("The condition value must match the source question type.");
        if (
          ["SINGLE_SELECT", "MULTI_SELECT", "DROPDOWN"].includes(field.type) &&
          !field.options.some((option) => option.key === condition.value)
        )
          issues.push("Choice conditions must refer to an existing choice.");
        if (
          condition.operator === "contains" &&
          !["SHORT_TEXT", "LONG_TEXT", "EMAIL", "MULTI_SELECT"].includes(field.type)
        )
          issues.push("Contains conditions require text or multiple choice.");
      }
    };
    inspect(rule.condition);
  }
  const appearance = definition.settings.appearance;
  if (
    contrast(appearance.background, appearance.text) < 4.5 ||
    contrast(appearance.surface, appearance.text) < 4.5 ||
    contrast(appearance.accent, appearance.onAccent) < 4.5 ||
    contrast(appearance.surface, appearance.muted) < 4.5 ||
    contrast(appearance.surface, appearance.border) < 3
  )
    issues.push("Choose appearance colors with readable text and control contrast.");
  return [...new Set(issues)];
}
