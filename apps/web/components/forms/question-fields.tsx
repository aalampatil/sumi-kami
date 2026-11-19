"use client";
import type { Answers, AnswerValue, FieldIssue, FormField } from "@repo/form-core/definition";

const control =
  "form-control min-h-12 w-full rounded-lg border border-[var(--form-border)] bg-[var(--form-surface)] px-4 py-3 text-[var(--form-text)] outline-offset-4 focus-visible:outline-[var(--form-accent)] disabled:opacity-60";
type Props = {
  fields: FormField[];
  values: Answers;
  onChange: (key: string, value: AnswerValue) => void;
  issues?: FieldIssue[];
  prefix: string;
  files?: Record<string, File[]>;
  onFiles?: (key: string, files: File[]) => void;
  disabled?: boolean;
};
export function QuestionFields({
  fields,
  values,
  onChange,
  issues = [],
  prefix,
  files = {},
  onFiles,
  disabled = false,
}: Props) {
  return (
    <div className="question-list space-y-8">
      {fields.map((field, index) => {
        const id = prefix + "_" + field.key,
          error = issues.find((issue) => issue.fieldKey === field.key)?.message;
        const described =
          [field.helpText ? id + "_help" : null, error ? id + "_error" : null]
            .filter(Boolean)
            .join(" ") || undefined;
        const common = {
          id,
          name: field.key,
          disabled,
          "aria-invalid": Boolean(error),
          "aria-required": field.required,
          "aria-describedby": described,
        };
        const value = values[field.key];
        const text = typeof value === "string" ? value : "";
        const label = (
          <>
            <span
              aria-hidden="true"
              className="question-number mr-3 font-mono text-xs text-[var(--form-muted)]"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            {field.label}
            {field.required ? (
              <span className="ml-1 text-[var(--form-accent)]" aria-label="required">
                *
              </span>
            ) : null}
          </>
        );
        const choices = ["SINGLE_SELECT", "MULTI_SELECT", "RATING"].includes(field.type);
        let input;
        if (field.type === "LONG_TEXT" || field.type === "STRUCTURED")
          input = (
            <textarea
              {...common}
              className={control + " min-h-32 resize-y"}
              rows={field.type === "STRUCTURED" ? 5 : 4}
              value={text}
              placeholder={
                field.configuration.placeholder ??
                (field.type === "STRUCTURED" ? 'e.g. {"message": "Hello"}' : "")
              }
              maxLength={field.configuration.maxLength ?? 20000}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          );
        else if (field.type === "CHECKBOX")
          input = (
            <label className="choice-card flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-[var(--form-border)] p-4">
              <input
                {...common}
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-[var(--form-accent)]"
                checked={value === true}
                onChange={(event) => onChange(field.key, event.target.checked)}
              />
              <span>Yes</span>
            </label>
          );
        else if (field.type === "SINGLE_SELECT" || field.type === "MULTI_SELECT")
          input = (
            <div className="space-y-2">
              {field.options.map((option) => {
                const selected = Array.isArray(value)
                  ? value.includes(option.key)
                  : value === option.key;
                return (
                  <label
                    key={option.key}
                    className="choice-card flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[var(--form-border)] bg-[var(--form-surface)] px-4 py-3"
                  >
                    <input
                      type={field.type === "MULTI_SELECT" ? "checkbox" : "radio"}
                      name={field.key}
                      value={option.key}
                      checked={selected}
                      disabled={disabled}
                      aria-describedby={described}
                      aria-invalid={Boolean(error)}
                      className="size-5 shrink-0 accent-[var(--form-accent)]"
                      onChange={() =>
                        onChange(
                          field.key,
                          field.type === "MULTI_SELECT"
                            ? selected
                              ? (Array.isArray(value) ? value : []).filter(
                                  (key) => key !== option.key,
                                )
                              : [...(Array.isArray(value) ? value : []), option.key]
                            : option.key,
                        )
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          );
        else if (field.type === "DROPDOWN")
          input = (
            <select
              {...common}
              className={control}
              value={text}
              onChange={(event) => onChange(field.key, event.target.value)}
            >
              <option value="">Choose an answer</option>
              {field.options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          );
        else if (field.type === "RATING")
          input = (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: field.configuration.ratingMax ?? 5 }, (_, index) =>
                String(index + 1),
              ).map((rating) => (
                <label
                  key={rating}
                  className="rating-option relative flex size-12 cursor-pointer items-center justify-center rounded-lg border border-[var(--form-border)] has-checked:bg-[var(--form-accent)] has-checked:text-[var(--form-on-accent)]"
                >
                  <input
                    type="radio"
                    name={field.key}
                    value={rating}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    checked={text === rating}
                    disabled={disabled}
                    aria-label={rating + " of " + (field.configuration.ratingMax ?? 5)}
                    aria-required={field.required}
                    aria-invalid={Boolean(error)}
                    aria-describedby={described}
                    onChange={() => onChange(field.key, rating)}
                  />
                  <span aria-hidden="true">{rating}</span>
                </label>
              ))}
            </div>
          );
        else if (field.type === "FILE")
          input = (
            <div className="space-y-2">
              <input
                {...common}
                type="file"
                className={
                  control +
                  " file:mr-3 file:rounded file:border-0 file:bg-[var(--form-accent)] file:px-3 file:py-1 file:text-[var(--form-on-accent)]"
                }
                multiple={(field.configuration.maxFiles ?? 1) > 1}
                accept={(
                  field.configuration.accept ?? [
                    "image/png",
                    "image/jpeg",
                    "image/webp",
                    "application/pdf",
                    "text/plain",
                  ]
                ).join(",")}
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  onFiles?.(field.key, selected);
                  onChange(
                    field.key,
                    selected.map(() => crypto.randomUUID()),
                  );
                }}
              />
              <p className="text-xs text-[var(--form-muted)]">
                Up to {field.configuration.maxFiles ?? 1} file(s),{" "}
                {Math.floor((field.configuration.maxBytes ?? 5242880) / 1048576)} MB each.
              </p>
              {files[field.key]?.length ? (
                <p className="break-words text-sm">
                  {files[field.key]!.map((file) => file.name).join(", ")}
                </p>
              ) : null}
            </div>
          );
        else
          input = (
            <input
              {...common}
              className={control}
              type={
                field.type === "EMAIL"
                  ? "email"
                  : field.type === "DATE"
                    ? "date"
                    : field.type === "DATETIME"
                      ? "datetime-local"
                      : "text"
              }
              inputMode={field.type === "NUMBER" ? "decimal" : undefined}
              autoComplete={field.type === "EMAIL" ? "email" : "off"}
              placeholder={field.configuration.placeholder ?? ""}
              value={
                field.type === "DATETIME" && text
                  ? new Date(text).toLocaleString("sv-SE").replace(" ", "T").slice(0, 16)
                  : text
              }
              maxLength={
                field.configuration.maxLength ?? (field.type === "SHORT_TEXT" ? 500 : 20000)
              }
              onChange={(event) =>
                onChange(
                  field.key,
                  field.type === "DATETIME" && event.target.value
                    ? new Date(event.target.value).toISOString()
                    : event.target.value,
                )
              }
            />
          );
        const help = (
          <>
            {field.helpText ? (
              <p id={id + "_help"} className="text-sm leading-6 text-[var(--form-muted)]">
                {field.helpText}
              </p>
            ) : null}
            {input}
            {error ? (
              <p
                id={id + "_error"}
                role="alert"
                className="text-sm font-medium text-[var(--form-text)]"
              >
                {error}
              </p>
            ) : null}
          </>
        );
        return choices ? (
          <fieldset key={field.key} className="form-question min-w-0 space-y-3" disabled={disabled}>
            <legend className="question-label mb-3 text-base font-medium leading-7">{label}</legend>
            {help}
          </fieldset>
        ) : (
          <div key={field.key} className="form-question space-y-3">
            <label htmlFor={id} className="question-label block text-base font-medium leading-7">
              {label}
            </label>
            {help}
          </div>
        );
      })}
    </div>
  );
}
