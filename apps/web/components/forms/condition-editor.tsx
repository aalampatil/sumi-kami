"use client";
import { Plus, Trash2 } from "lucide-react";
import type { ConditionNode, FormField } from "@repo/form-core/definition";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export const logicSelect =
  "min-h-11 min-w-0 w-full rounded-md border border-input bg-card px-3 text-sm";
type Comparison = Extract<ConditionNode, { fieldKey: string }>;
function firstComparison(node: ConditionNode): Comparison {
  if ("all" in node) return firstComparison(node.all[0]!);
  if ("any" in node) return firstComparison(node.any[0]!);
  if ("not" in node) return firstComparison(node.not);
  return node;
}

export function ConditionEditor({
  condition,
  fields,
  onChange,
  depth = 0,
}: {
  condition: ConditionNode;
  fields: FormField[];
  onChange: (condition: ConditionNode) => void;
  depth?: number;
}) {
  const kind =
    "all" in condition
      ? "all"
      : "any" in condition
        ? "any"
        : "not" in condition
          ? "not"
          : "comparison";
  const children = "all" in condition ? condition.all : "any" in condition ? condition.any : null;
  const leaf = "fieldKey" in condition ? condition : null;
  const field = fields.find((field) => field.key === leaf?.fieldKey);
  const group = (items: ConditionNode[]): ConditionNode =>
    kind === "all" ? { all: items } : { any: items };
  return (
    <div
      className="min-w-0 space-y-3 rounded-md border p-2"
      role="group"
      aria-label="Condition expression"
    >
      <label className="block space-y-1 text-xs">
        Match
        <select
          className={logicSelect}
          value={kind}
          onChange={(event) => {
            const next = event.target.value;
            if (next === "comparison") onChange(firstComparison(condition));
            else if (next === "not") onChange({ not: condition });
            else {
              const items = children ?? [condition];
              onChange(next === "all" ? { all: items } : { any: items });
            }
          }}
        >
          <option value="comparison">One comparison</option>
          <option value="all" disabled={depth >= 12 && !children}>
            All conditions (AND)
          </option>
          <option value="any" disabled={depth >= 12 && !children}>
            Any condition (OR)
          </option>
          <option value="not" disabled={depth >= 12}>
            Negate condition (NOT)
          </option>
        </select>
      </label>
      {children ? (
        <>
          {children.map((child, index) => (
            <div key={index} className="min-w-0 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Condition {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11"
                  aria-label={"Remove condition " + (index + 1)}
                  disabled={children.length === 1}
                  onClick={() =>
                    onChange(group(children.filter((_, position) => position !== index)))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
              <ConditionEditor
                condition={child}
                fields={fields}
                depth={depth + 1}
                onChange={(next) =>
                  onChange(
                    group(children.map((item, position) => (position === index ? next : item))),
                  )
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={children.length >= 20 || !fields.length}
            onClick={() =>
              onChange(
                group([
                  ...children,
                  { fieldKey: fields[fields.length - 1]!.key, operator: "is_answered" },
                ]),
              )
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add condition
          </Button>
        </>
      ) : "not" in condition ? (
        <ConditionEditor
          condition={condition.not}
          fields={fields}
          depth={depth + 1}
          onChange={(not) => onChange({ not })}
        />
      ) : leaf ? (
        <>
          <label className="block space-y-1 text-xs">
            Question to compare
            <select
              className={logicSelect}
              value={leaf.fieldKey}
              onChange={(event) =>
                onChange({ fieldKey: event.target.value, operator: "is_answered" })
              }
            >
              {!field ? <option value={leaf.fieldKey}>Choose an available question</option> : null}
              {fields.map((field) => (
                <option key={field.key} value={field.key}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs">
            Condition
            <select
              className={logicSelect}
              value={leaf.operator}
              onChange={(event) => {
                const operator = event.target.value as Comparison["operator"];
                onChange({
                  fieldKey: leaf.fieldKey,
                  operator,
                  ...(operator === "is_answered"
                    ? {}
                    : {
                        value: field?.type === "CHECKBOX" ? true : (field?.options[0]?.key ?? ""),
                      }),
                });
              }}
            >
              <option value="is_answered">Is answered</option>
              <option value="equals">Equals</option>
              <option value="not_equals">Does not equal</option>
              {["NUMBER", "RATING"].includes(field?.type ?? "") ? (
                <>
                  <option value="greater_than">Is greater than</option>
                  <option value="less_than">Is less than</option>
                </>
              ) : null}
              {["SHORT_TEXT", "LONG_TEXT", "EMAIL", "MULTI_SELECT"].includes(field?.type ?? "") ? (
                <option value="contains">Contains</option>
              ) : null}
            </select>
          </label>
          {leaf.operator !== "is_answered" ? (
            <label className="block space-y-1 text-xs">
              Comparison value
              {field?.type === "CHECKBOX" ? (
                <select
                  className={logicSelect}
                  value={leaf.value === true ? "true" : "false"}
                  onChange={(event) => onChange({ ...leaf, value: event.target.value === "true" })}
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : field?.options.length ? (
                <select
                  className={logicSelect}
                  value={typeof leaf.value === "string" ? leaf.value : ""}
                  onChange={(event) => onChange({ ...leaf, value: event.target.value })}
                >
                  {field.options.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  className="min-h-11"
                  value={typeof leaf.value === "string" ? leaf.value : ""}
                  onChange={(event) => onChange({ ...leaf, value: event.target.value })}
                />
              )}
            </label>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
