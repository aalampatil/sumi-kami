"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  allFields,
  conditionReferences,
  conditionSchema,
  type ConditionNode,
  type FormDefinition,
  type FormRule,
} from "@repo/form-core/definition";
import { Button } from "~/components/ui/button";
import { ConditionEditor, logicSelect } from "./condition-editor";

function expression(condition: FormRule["condition"]): ConditionNode {
  if ("all" in condition) return { all: condition.all };
  if ("any" in condition) return { any: condition.any };
  if ("not" in condition) return { not: condition.not };
  return {
    fieldKey: condition.fieldKey,
    operator: condition.operator,
    ...(condition.value === undefined ? {} : { value: condition.value }),
  };
}

export function LogicEditor({
  definition,
  onChange,
  disabled,
}: {
  definition: FormDefinition;
  onChange: (definition: FormDefinition) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState("");
  const fields = allFields(definition);
  const patch = (index: number, value: Partial<FormRule>) => {
    setError("");
    onChange({
      ...definition,
      rules: definition.rules.map((rule, position) =>
        position === index ? { ...rule, ...value } : rule,
      ),
    });
  };
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <legend className="mb-3 text-sm font-semibold">Conditional logic</legend>
      <p className="text-xs leading-5 text-muted-foreground">
        Combine earlier answers with AND, OR, and NOT to show or hide later questions, skip ahead,
        or end the form.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {definition.rules.map((rule, index) => {
        const sourceIndex = fields.findIndex((field) => field.key === rule.sourceFieldKey);
        const lastConditionIndex = fields.reduce(
          (latest, field, position) =>
            conditionReferences(rule.condition, field.key) ? position : latest,
          -1,
        );
        const sourceStep = definition.steps.findIndex((step) =>
          step.fields.some((field) => field.key === rule.sourceFieldKey),
        );
        const laterFields = fields.slice(sourceIndex + 1),
          laterSteps = definition.steps.slice(sourceStep + 1);
        return (
          <section
            key={index}
            className="min-w-0 space-y-3 rounded-lg border p-3"
            aria-label={"Rule " + (index + 1)}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium">Rule {index + 1}</h4>
              <Button
                type="button"
                variant="ghost"
                className="size-11"
                aria-label={"Remove rule " + (index + 1)}
                onClick={() =>
                  onChange({
                    ...definition,
                    rules: definition.rules.filter((_, position) => position !== index),
                  })
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <label className="block space-y-1 text-xs">
              When this question is reached
              <select
                className={logicSelect}
                value={rule.sourceFieldKey}
                onChange={(event) => {
                  const sourceFieldKey = event.target.value;
                  const later = fields.slice(
                    fields.findIndex((field) => field.key === sourceFieldKey) + 1,
                  );
                  const steps = definition.steps.slice(
                    definition.steps.findIndex((step) =>
                      step.fields.some((field) => field.key === sourceFieldKey),
                    ) + 1,
                  );
                  let actionKind = rule.actionKind;
                  if (
                    (["SHOW_FIELD", "HIDE_FIELD"].includes(actionKind) && !later.length) ||
                    (actionKind === "GO_TO_STEP" && !steps.length)
                  )
                    actionKind = "END_FORM";
                  patch(index, {
                    sourceFieldKey,
                    actionKind,
                    targetFieldKey: ["SHOW_FIELD", "HIDE_FIELD"].includes(actionKind)
                      ? (later.find((field) => field.key === rule.targetFieldKey)?.key ??
                        later[0]?.key)
                      : undefined,
                    targetStepKey:
                      actionKind === "GO_TO_STEP"
                        ? (steps.find((step) => step.key === rule.targetStepKey)?.key ??
                          steps[0]?.key)
                        : undefined,
                  });
                }}
              >
                {fields.map((field, position) => (
                  <option
                    key={field.key}
                    value={field.key}
                    disabled={position < lastConditionIndex}
                  >
                    {field.label}
                  </option>
                ))}
              </select>
            </label>
            <ConditionEditor
              condition={expression(rule.condition)}
              fields={fields.slice(0, sourceIndex + 1)}
              onChange={(node) => {
                const parsed = conditionSchema.safeParse({ formatVersion: 1, ...node });
                if (!parsed.success) {
                  setError(parsed.error.issues[0]?.message ?? "Check the condition expression.");
                  return;
                }
                patch(index, { condition: parsed.data });
              }}
            />
            <label className="block space-y-1 text-xs">
              Then
              <select
                className={logicSelect}
                value={rule.actionKind}
                onChange={(event) => {
                  const actionKind = event.target.value as FormRule["actionKind"];
                  patch(index, {
                    actionKind,
                    targetFieldKey: ["SHOW_FIELD", "HIDE_FIELD"].includes(actionKind)
                      ? laterFields[0]?.key
                      : undefined,
                    targetStepKey: actionKind === "GO_TO_STEP" ? laterSteps[0]?.key : undefined,
                  });
                }}
              >
                <option value="SHOW_FIELD" disabled={!laterFields.length}>
                  Show question
                </option>
                <option value="HIDE_FIELD" disabled={!laterFields.length}>
                  Hide question
                </option>
                <option value="GO_TO_STEP" disabled={!laterSteps.length}>
                  Go to step
                </option>
                <option value="END_FORM">End form</option>
              </select>
            </label>
            {["SHOW_FIELD", "HIDE_FIELD"].includes(rule.actionKind) ? (
              <label className="block space-y-1 text-xs">
                Target question
                <select
                  className={logicSelect}
                  value={rule.targetFieldKey ?? ""}
                  onChange={(event) => patch(index, { targetFieldKey: event.target.value })}
                >
                  <option value="">Choose a later question</option>
                  {laterFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : rule.actionKind === "GO_TO_STEP" ? (
              <label className="block space-y-1 text-xs">
                Target step
                <select
                  className={logicSelect}
                  value={rule.targetStepKey ?? ""}
                  onChange={(event) => patch(index, { targetStepKey: event.target.value })}
                >
                  <option value="">Choose a later step</option>
                  {laterSteps.map((step) => (
                    <option key={step.key} value={step.key}>
                      {step.title || step.key}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </section>
        );
      })}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full"
        disabled={!fields.length || definition.rules.length >= 50}
        onClick={() => {
          const source = fields[0]!;
          onChange({
            ...definition,
            rules: [
              ...definition.rules,
              {
                sourceFieldKey: source.key,
                condition: { formatVersion: 1, fieldKey: source.key, operator: "is_answered" },
                actionKind: fields[1] ? "SHOW_FIELD" : "END_FORM",
                ...(fields[1] ? { targetFieldKey: fields[1].key } : {}),
              },
            ],
          });
        }}
      >
        <Plus aria-hidden="true" />
        Add logic rule
      </Button>
    </fieldset>
  );
}
