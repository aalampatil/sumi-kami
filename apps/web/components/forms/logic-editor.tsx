"use client";
import { Plus, Trash2 } from "lucide-react";
import { allFields, type FormDefinition, type FormRule } from "@repo/form-core/definition";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
const select = "min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm";
export function LogicEditor({
  definition,
  onChange,
  disabled,
}: {
  definition: FormDefinition;
  onChange: (definition: FormDefinition) => void;
  disabled: boolean;
}) {
  const fields = allFields(definition),
    patch = (index: number, value: Partial<FormRule>) =>
      onChange({
        ...definition,
        rules: definition.rules.map((rule, position) =>
          position === index ? { ...rule, ...value } : rule,
        ),
      });
  return (
    <fieldset disabled={disabled} className="space-y-4">
      <legend className="mb-3 text-sm font-semibold">Conditional logic</legend>
      <p className="text-xs leading-5 text-muted-foreground">
        Use earlier answers to show or hide later questions, skip ahead, or end the form.
      </p>
      {definition.rules.map((rule, index) => {
        const leaf = "fieldKey" in rule.condition ? rule.condition : null,
          source = fields.find((field) => field.key === rule.sourceFieldKey);
        return (
          <section
            key={index}
            className="space-y-3 rounded-lg border p-3"
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
            {leaf ? (
              <>
                <label className="block space-y-1 text-xs">
                  If this question
                  <select
                    className={select}
                    value={rule.sourceFieldKey}
                    onChange={(event) =>
                      patch(index, {
                        sourceFieldKey: event.target.value,
                        condition: {
                          formatVersion: 1,
                          fieldKey: event.target.value,
                          operator: "is_answered",
                        },
                      })
                    }
                  >
                    {fields.map((field) => (
                      <option value={field.key} key={field.key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1 text-xs">
                  Condition
                  <select
                    className={select}
                    value={leaf.operator}
                    onChange={(event) =>
                      patch(index, {
                        condition: {
                          formatVersion: 1,
                          fieldKey: rule.sourceFieldKey,
                          operator: event.target.value as typeof leaf.operator,
                          ...(event.target.value === "is_answered"
                            ? {}
                            : {
                                value:
                                  source?.type === "CHECKBOX"
                                    ? true
                                    : (source?.options[0]?.key ?? ""),
                              }),
                        },
                      })
                    }
                  >
                    <option value="is_answered">Is answered</option>
                    <option value="equals">Equals</option>
                    <option value="not_equals">Does not equal</option>
                    {["NUMBER", "RATING"].includes(source?.type ?? "") ? (
                      <>
                        <option value="greater_than">Is greater than</option>
                        <option value="less_than">Is less than</option>
                      </>
                    ) : null}
                    {["SHORT_TEXT", "LONG_TEXT", "EMAIL", "MULTI_SELECT"].includes(
                      source?.type ?? "",
                    ) ? (
                      <option value="contains">Contains</option>
                    ) : null}
                  </select>
                </label>
                {leaf.operator !== "is_answered" ? (
                  <label className="block space-y-1 text-xs">
                    Comparison
                    {source?.type === "CHECKBOX" ? (
                      <select
                        className={select}
                        value={leaf.value === true ? "true" : "false"}
                        onChange={(event) =>
                          patch(index, {
                            condition: {
                              ...leaf,
                              formatVersion: 1,
                              value: event.target.value === "true",
                            },
                          })
                        }
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : source?.options.length ? (
                      <select
                        className={select}
                        value={typeof leaf.value === "string" ? leaf.value : ""}
                        onChange={(event) =>
                          patch(index, {
                            condition: { ...leaf, formatVersion: 1, value: event.target.value },
                          })
                        }
                      >
                        {source.options.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={typeof leaf.value === "string" ? leaf.value : ""}
                        onChange={(event) =>
                          patch(index, {
                            condition: { ...leaf, formatVersion: 1, value: event.target.value },
                          })
                        }
                        className="min-h-11"
                      />
                    )}
                  </label>
                ) : null}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                This rule uses a compound expression. It remains preserved; remove it to replace it
                with a simpler rule.
              </p>
            )}
            <label className="block space-y-1 text-xs">
              Then
              <select
                className={select}
                value={rule.actionKind}
                onChange={(event) => {
                  const actionKind = event.target.value as FormRule["actionKind"];
                  const later = fields.slice(
                    fields.findIndex((field) => field.key === rule.sourceFieldKey) + 1,
                  )[0];
                  patch(index, {
                    actionKind,
                    targetFieldKey: ["SHOW_FIELD", "HIDE_FIELD"].includes(actionKind)
                      ? later?.key
                      : undefined,
                    targetStepKey:
                      actionKind === "GO_TO_STEP"
                        ? definition.steps.find((step) =>
                            step.fields.some((field) => field.key === rule.sourceFieldKey),
                          )?.key
                        : undefined,
                  });
                }}
              >
                <option value="SHOW_FIELD">Show question</option>
                <option value="HIDE_FIELD">Hide question</option>
                <option value="GO_TO_STEP">Go to step</option>
                <option value="END_FORM">End form</option>
              </select>
            </label>
            {["SHOW_FIELD", "HIDE_FIELD"].includes(rule.actionKind) ? (
              <label className="block space-y-1 text-xs">
                Target question
                <select
                  className={select}
                  value={rule.targetFieldKey ?? ""}
                  onChange={(event) => patch(index, { targetFieldKey: event.target.value })}
                >
                  <option value="">Choose a later question</option>
                  {fields
                    .slice(fields.findIndex((field) => field.key === rule.sourceFieldKey) + 1)
                    .map((field) => (
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
                  className={select}
                  value={rule.targetStepKey ?? ""}
                  onChange={(event) => patch(index, { targetStepKey: event.target.value })}
                >
                  <option value="">Choose a later step</option>
                  {definition.steps.map((step) => (
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
        disabled={fields.length < 1 || definition.rules.length >= 50}
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
