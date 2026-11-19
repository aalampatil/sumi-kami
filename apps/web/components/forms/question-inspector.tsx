"use client";
import { Plus, X } from "lucide-react";
import {
  fieldLabels,
  fieldTypes,
  newField,
  type FieldType,
  type FormField,
} from "@repo/form-core/definition";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export function QuestionInspector({
  field,
  onChange,
  disabled,
}: {
  field: FormField;
  onChange: (field: FormField) => void;
  disabled: boolean;
}) {
  const patch = (value: Partial<FormField>) => onChange({ ...field, ...value });
  const numeric = (
    key:
      | "minLength"
      | "maxLength"
      | "minSelections"
      | "maxSelections"
      | "ratingMax"
      | "maxFiles"
      | "maxBytes",
    label: string,
    min: number,
    max: number,
  ) => (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={"config-" + key}>
        {label}
      </label>
      <Input
        id={"config-" + key}
        type="number"
        min={min}
        max={max}
        value={field.configuration[key] ?? ""}
        onChange={(event) => {
          const configuration = { ...field.configuration };
          if (event.target.value === "") delete configuration[key];
          else configuration[key] = Number(event.target.value);
          patch({ configuration });
        }}
        className="min-h-11"
      />
    </div>
  );
  return (
    <fieldset className="space-y-5" disabled={disabled}>
      <legend className="mb-5 text-sm font-semibold">Question settings</legend>
      <div className="space-y-2">
        <label htmlFor="question-type" className="text-sm font-medium">
          Question type
        </label>
        <select
          id="question-type"
          value={field.type}
          onChange={(event) => {
            const next = newField(event.target.value as FieldType);
            onChange({
              ...next,
              label: field.label,
              helpText: field.helpText,
              required: field.required,
            });
          }}
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          {fieldTypes.map((type) => (
            <option key={type} value={type}>
              {fieldLabels[type]}
            </option>
          ))}
        </select>
        <p className="text-xs leading-5 text-muted-foreground">
          Earlier responses keep their original question type.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="question-label" className="text-sm font-medium">
          Question label
        </label>
        <Input
          id="question-label"
          value={field.label}
          maxLength={500}
          onChange={(event) => patch({ label: event.target.value })}
          className="min-h-11"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="question-help" className="text-sm font-medium">
          Help text
        </label>
        <textarea
          id="question-help"
          value={field.helpText}
          maxLength={2000}
          rows={3}
          onChange={(event) => patch({ helpText: event.target.value })}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event) => patch({ required: event.target.checked })}
          className="size-4 accent-primary"
        />
        Required question
      </label>
      {["SHORT_TEXT", "LONG_TEXT", "EMAIL", "NUMBER"].includes(field.type) ? (
        <div className="space-y-2">
          <label htmlFor="question-placeholder" className="text-sm font-medium">
            Placeholder
          </label>
          <Input
            id="question-placeholder"
            value={field.configuration.placeholder ?? ""}
            maxLength={200}
            onChange={(event) =>
              patch({ configuration: { ...field.configuration, placeholder: event.target.value } })
            }
            className="min-h-11"
          />
        </div>
      ) : null}
      {["SHORT_TEXT", "LONG_TEXT"].includes(field.type) ? (
        <div className="grid grid-cols-2 gap-3">
          {numeric("minLength", "Minimum length", 0, 20000)}
          {numeric("maxLength", "Maximum length", 1, 20000)}
        </div>
      ) : null}
      {field.type === "NUMBER" ? (
        <div className="grid grid-cols-2 gap-3">
          {(["min", "max"] as const).map((key) => (
            <div key={key} className="space-y-2">
              <label htmlFor={"number-" + key} className="text-sm font-medium">
                {key === "min" ? "Minimum" : "Maximum"}
              </label>
              <Input
                id={"number-" + key}
                inputMode="decimal"
                value={field.configuration[key] ?? ""}
                onChange={(event) => {
                  const configuration = { ...field.configuration };
                  if (event.target.value === "") delete configuration[key];
                  else configuration[key] = event.target.value;
                  patch({ configuration });
                }}
                className="min-h-11"
              />
            </div>
          ))}
        </div>
      ) : null}
      {["SINGLE_SELECT", "DROPDOWN", "MULTI_SELECT"].includes(field.type) ? (
        <section aria-labelledby="choices-heading" className="space-y-3">
          <h3 id="choices-heading" className="text-sm font-medium">
            Answer choices
          </h3>
          {field.options.map((option, index) => (
            <div key={option.key} className="flex gap-2">
              <Input
                aria-label={"Choice " + (index + 1)}
                value={option.label}
                maxLength={500}
                onChange={(event) =>
                  patch({
                    options: field.options.map((item) =>
                      item.key === option.key ? { ...item, label: event.target.value } : item,
                    ),
                  })
                }
                className="min-h-11"
              />
              <Button
                type="button"
                variant="ghost"
                className="size-11"
                aria-label={"Remove choice " + (index + 1)}
                onClick={() =>
                  patch({ options: field.options.filter((item) => item.key !== option.key) })
                }
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={field.options.length >= 100}
            onClick={() =>
              patch({
                options: [
                  ...field.options,
                  {
                    key: "o_" + crypto.randomUUID().replaceAll("-", ""),
                    label: "Option " + (field.options.length + 1),
                  },
                ],
              })
            }
          >
            <Plus aria-hidden="true" />
            Add choice
          </Button>
        </section>
      ) : null}
      {field.type === "MULTI_SELECT" ? (
        <div className="grid grid-cols-2 gap-3">
          {numeric("minSelections", "Minimum choices", 0, 100)}
          {numeric("maxSelections", "Maximum choices", 1, 100)}
        </div>
      ) : null}
      {field.type === "RATING" ? numeric("ratingMax", "Rating scale", 3, 10) : null}
      {field.type === "FILE" ? (
        <div className="space-y-4">
          {numeric("maxFiles", "Maximum files", 1, 5)}
          <div className="space-y-2">
            <label htmlFor="file-size" className="text-sm font-medium">
              Maximum file size (MB)
            </label>
            <Input
              id="file-size"
              type="number"
              min={1}
              max={10}
              value={(field.configuration.maxBytes ?? 5242880) / 1048576}
              onChange={(event) =>
                patch({
                  configuration: {
                    ...field.configuration,
                    maxBytes: Number(event.target.value) * 1048576,
                  },
                })
              }
              className="min-h-11"
            />
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Allowed file types</legend>
            {(
              [
                ["image/png", "PNG images"],
                ["image/jpeg", "JPEG images"],
                ["image/webp", "WebP images"],
                ["application/pdf", "PDF documents"],
                ["text/plain", "Text files"],
              ] as const
            ).map(([type, label]) => (
              <label key={type} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={(
                    field.configuration.accept ?? [
                      "image/png",
                      "image/jpeg",
                      "image/webp",
                      "application/pdf",
                      "text/plain",
                    ]
                  ).includes(type)}
                  onChange={(event) => {
                    const current =
                      field.configuration.accept ??
                      ([
                        "image/png",
                        "image/jpeg",
                        "image/webp",
                        "application/pdf",
                        "text/plain",
                      ] as const);
                    patch({
                      configuration: {
                        ...field.configuration,
                        accept: event.target.checked
                          ? [...current, type]
                          : current.filter((value) => value !== type),
                      },
                    });
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      ) : null}
    </fieldset>
  );
}
