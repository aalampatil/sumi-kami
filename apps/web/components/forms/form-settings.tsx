"use client";
import { appearancePresets, customAppearance } from "@repo/form-core/appearance";
import type { FormDefinition } from "@repo/form-core/definition";
import { Input } from "~/components/ui/input";
export function FormSettings({
  definition,
  onChange,
  disabled,
}: {
  definition: FormDefinition;
  onChange: (definition: FormDefinition) => void;
  disabled: boolean;
}) {
  const settings = definition.settings,
    patch = (value: Partial<FormDefinition["settings"]>) =>
      onChange({ ...definition, settings: { ...settings, ...value } });
  return (
    <fieldset className="space-y-5" disabled={disabled}>
      <legend className="mb-5 text-sm font-semibold">Form settings</legend>
      <div className="space-y-2">
        <label htmlFor="form-description" className="text-sm font-medium">
          Introduction
        </label>
        <textarea
          id="form-description"
          value={definition.description}
          rows={4}
          maxLength={5000}
          onChange={(event) => onChange({ ...definition, description: event.target.value })}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="form-preset" className="text-sm font-medium">
          Appearance
        </label>
        <select
          id="form-preset"
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
          value={settings.appearance.preset}
          onChange={(event) =>
            patch({
              appearance:
                event.target.value === "custom"
                  ? customAppearance(settings.appearance.background, settings.appearance.accent)
                  : { ...appearancePresets[event.target.value as keyof typeof appearancePresets] },
            })
          }
        >
          <option value="japanese-ink">Japanese Ink</option>
          <option value="minimal">Minimal</option>
          <option value="midnight">Midnight</option>
          <option value="custom">Custom colors</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ["background", "Background color"],
            ["accent", "Accent color"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-2">
            <label htmlFor={"color-" + key} className="text-xs font-medium">
              {label}
            </label>
            <input
              id={"color-" + key}
              type="color"
              value={settings.appearance[key]}
              className="h-11 w-full cursor-pointer rounded border border-input bg-card p-1"
              onChange={(event) =>
                patch({
                  appearance: {
                    ...customAppearance(
                      key === "background" ? event.target.value : settings.appearance.background,
                      key === "accent" ? event.target.value : settings.appearance.accent,
                    ),
                    font: settings.appearance.font,
                  },
                })
              }
            />
          </div>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        Text colors adapt for readability. Your dashboard mode does not change the published form.
      </p>
      <div className="space-y-2">
        <label htmlFor="form-font" className="text-sm font-medium">
          Heading style
        </label>
        <select
          id="form-font"
          value={settings.appearance.font}
          onChange={(event) =>
            patch({
              appearance: { ...settings.appearance, font: event.target.value as "serif" | "sans" },
            })
          }
          className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
        >
          <option value="serif">Editorial serif</option>
          <option value="sans">Clean sans serif</option>
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="submit-label" className="text-sm font-medium">
          Submit button
        </label>
        <Input
          id="submit-label"
          value={settings.submitLabel}
          maxLength={80}
          onChange={(event) => patch({ submitLabel: event.target.value })}
          className="min-h-11"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="completion-title" className="text-sm font-medium">
          Thank-you heading
        </label>
        <Input
          id="completion-title"
          value={settings.completionTitle}
          maxLength={200}
          onChange={(event) => patch({ completionTitle: event.target.value })}
          className="min-h-11"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="completion-message" className="text-sm font-medium">
          Thank-you message
        </label>
        <textarea
          id="completion-message"
          value={settings.completionMessage}
          rows={3}
          maxLength={2000}
          onChange={(event) => patch({ completionMessage: event.target.value })}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="form-retention" className="text-sm font-medium">
          Response retention (days)
        </label>
        <Input
          id="form-retention"
          type="number"
          min={1}
          max={99999}
          value={settings.retentionDays ?? ""}
          onChange={(event) => {
            const next = { ...settings };
            if (event.target.value === "") delete next.retentionDays;
            else next.retentionDays = Number(event.target.value);
            onChange({ ...definition, settings: next });
          }}
          className="min-h-11"
        />
        <p className="text-xs leading-5 text-muted-foreground">
          Leave empty to use the workspace default. Published versions keep their own retention
          settings.
        </p>
      </div>
    </fieldset>
  );
}
