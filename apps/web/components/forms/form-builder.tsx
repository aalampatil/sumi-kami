"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  FileText,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  allFields,
  conditionReferences,
  definitionSchema,
  fieldLabels,
  fieldTypes,
  newField,
  publicationIssues,
  type FieldType,
  type FormDefinition,
  type FormField,
} from "@repo/form-core/definition";
import type { FormEditor } from "@repo/trpc/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { trpc } from "~/trpc/client";
import { FormSettings } from "./form-settings";
import { LogicEditor } from "./logic-editor";
import { QuestionInspector } from "./question-inspector";
import { RespondentForm } from "./respondent-form";
import { useUnsavedChanges } from "~/lib/use-unsaved-changes";

export function FormBuilder({ initial }: { initial: FormEditor }) {
  const [current, setCurrent] = useState(initial),
    [definition, setDefinition] = useState(initial.definition),
    [dirty, setDirty] = useState(false),
    [selected, setSelected] = useState<string | null>(
      allFields(initial.definition)[0]?.key ?? null,
    );
  const [mobile, setMobile] = useState<"questions" | "preview" | "settings">("questions"),
    [addType, setAddType] = useState<FieldType>("SHORT_TEXT"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const utils = trpc.useUtils(),
    router = useRouter(),
    scope = { workspaceId: initial.workspaceId, formId: initial.id };
  const save = trpc.forms.save.useMutation(),
    publish = trpc.forms.publish.useMutation(),
    edit = trpc.forms.edit.useMutation(),
    close = trpc.forms.unpublish.useMutation(),
    archive = trpc.forms.archive.useMutation();
  const pending =
      save.isPending || publish.isPending || edit.isPending || close.isPending || archive.isPending,
    editable = current.canEdit && current.status === "DRAFT" && !current.archived;
  const field = allFields(definition).find((field) => field.key === selected);
  useUnsavedChanges(dirty);
  function change(next: FormDefinition) {
    setDefinition(next);
    setDirty(true);
    setNotice("");
    setError("");
  }
  function accept(next: FormEditor) {
    setCurrent(next);
    setDefinition(next.definition);
    setDirty(false);
    void utils.forms.list.invalidate();
  }
  function safeDefinition() {
    const parsed = definitionSchema.safeParse(definition);
    if (!parsed.success)
      throw new Error(parsed.error.issues[0]?.message ?? "Check the form settings.");
    const problems = publicationIssues(parsed.data, false);
    if (problems.length) throw new Error(problems.slice(0, 3).join(" "));
    return parsed.data;
  }
  async function saveDraft() {
    setError("");
    try {
      const next = await save.mutateAsync({
        ...scope,
        expectedRevision: current.revision,
        definition: safeDefinition(),
      });
      accept(next);
      setNotice("Saved");
      return next;
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn’t save the form.");
      return null;
    }
  }
  async function publishForm() {
    setError("");
    setNotice("");
    try {
      const parsed = safeDefinition(),
        problems = publicationIssues(parsed);
      if (problems.length) throw new Error(problems[0]);
      let next = current;
      if (dirty) {
        const saved = await saveDraft();
        if (!saved) return;
        next = saved;
      }
      const published = await publish.mutateAsync({ ...scope, expectedRevision: next.revision });
      accept(published);
      setNotice("Form published. Your share link is ready.");
      toast.success("Form published.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn’t publish the form.");
    }
  }
  async function newDraft() {
    setError("");
    try {
      accept(await edit.mutateAsync(scope));
      setNotice("Draft ready. The published version stays unchanged.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn’t create a draft.");
    }
  }
  async function closeForm() {
    if (
      !window.confirm(
        "Close the share link to new responses? Existing responses will remain available.",
      )
    )
      return;
    try {
      accept(await close.mutateAsync(scope));
      setNotice("The form is closed to new responses.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "We couldn’t close the form.");
    }
  }
  function updateField(next: FormField) {
    if (!field) return;
    const oldKey = field.key;
    change({
      ...definition,
      steps: definition.steps.map((step) => ({
        ...step,
        fields: step.fields.map((item) => (item.key === oldKey ? next : item)),
      })),
      rules:
        next.key === oldKey
          ? definition.rules
          : definition.rules.filter(
              (rule) =>
                rule.sourceFieldKey !== oldKey &&
                rule.targetFieldKey !== oldKey &&
                !conditionReferences(rule.condition, oldKey),
            ),
    });
    setSelected(next.key);
  }
  function removeField(key: string) {
    change({
      ...definition,
      steps: definition.steps.map((step) => ({
        ...step,
        fields: step.fields.filter((field) => field.key !== key),
      })),
      rules: definition.rules.filter(
        (rule) =>
          rule.sourceFieldKey !== key &&
          rule.targetFieldKey !== key &&
          !conditionReferences(rule.condition, key),
      ),
    });
    if (selected === key) setSelected(null);
  }
  function moveField(stepKey: string, key: string, direction: number) {
    change({
      ...definition,
      steps: definition.steps.map((step) => {
        if (step.key !== stepKey) return step;
        const fields = [...step.fields],
          index = fields.findIndex((field) => field.key === key),
          target = index + direction;
        if (target < 0 || target >= fields.length) return step;
        [fields[index], fields[target]] = [fields[target]!, fields[index]!];
        return { ...step, fields };
      }),
    });
  }
  function addQuestion(stepKey: string) {
    const field = newField(addType);
    change({
      ...definition,
      steps: definition.steps.map((step) =>
        step.key === stepKey ? { ...step, fields: [...step.fields, field] } : step,
      ),
    });
    setSelected(field.key);
    setMobile("settings");
  }
  function removeStep(key: string) {
    const removed = new Set(
      definition.steps.find((step) => step.key === key)?.fields.map((field) => field.key),
    );
    change({
      ...definition,
      steps: definition.steps.filter((step) => step.key !== key),
      rules: definition.rules.filter(
        (rule) =>
          rule.targetStepKey !== key &&
          !removed.has(rule.sourceFieldKey) &&
          !removed.has(rule.targetFieldKey ?? "") &&
          ![...removed].some((field) => conditionReferences(rule.condition, field)),
      ),
    });
    setSelected(null);
  }
  return (
    <div>
      <div className="sticky top-0 z-20 -mx-2 border-b bg-background px-2 pb-5 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link
              href={"/dashboard/workspaces/" + initial.workspaceId}
              className="text-xs text-muted-foreground underline underline-offset-4"
            >
              {initial.workspaceName} / Forms
            </Link>
            <label htmlFor="builder-title" className="sr-only">
              Form title
            </label>
            <Input
              id="builder-title"
              value={definition.title}
              maxLength={200}
              onChange={(event) => change({ ...definition, title: event.target.value })}
              disabled={!editable || pending}
              className="mt-2 h-auto min-h-11 border-transparent px-0 text-xl font-semibold shadow-none disabled:opacity-100 md:text-xl"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {current.archived ? "Archived" : current.status === "DRAFT" ? "Draft" : "Published"} ·
              Version {current.versionNumber} {dirty ? "· Unsaved changes" : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11">
              <Link
                href={
                  "/dashboard/workspaces/" +
                  initial.workspaceId +
                  "/forms/" +
                  initial.id +
                  "/responses"
                }
              >
                Responses
              </Link>
            </Button>
            {editable ? (
              <Button
                variant="outline"
                className="min-h-11"
                disabled={!dirty || pending}
                onClick={() => void saveDraft()}
              >
                {save.isPending ? "Saving…" : "Save draft"}
              </Button>
            ) : current.canEdit && !current.archived ? (
              <Button
                variant="outline"
                className="min-h-11"
                disabled={pending}
                onClick={() => void newDraft()}
              >
                Edit form
              </Button>
            ) : null}
            {current.canPublish && editable ? (
              <Button className="min-h-11" disabled={pending} onClick={() => void publishForm()}>
                {publish.isPending ? "Publishing…" : "Publish form"}
              </Button>
            ) : null}
            {current.archived && current.canEdit ? (
              <Button
                className="min-h-11"
                disabled={pending}
                onClick={() =>
                  archive.mutate(
                    { ...scope, archived: false },
                    { onSuccess: accept, onError: (error) => setError(error.message) },
                  )
                }
              >
                Restore form
              </Button>
            ) : null}
          </div>
        </div>
        {notice ? (
          <p role="status" className="mt-3 text-sm">
            {notice}
          </p>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive p-3 text-sm"
          >
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => {
                if (!dirty || window.confirm("Reload and discard unsaved changes?"))
                  router.refresh();
              }}
            >
              Reload form
            </Button>
          </div>
        ) : null}
        {current.publishedVersionId && !current.archived ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2">
            <p className="text-xs text-muted-foreground">
              {current.status === "DRAFT"
                ? "A published version is live. Publish this draft to update it."
                : "Your form is live and accepting responses."}
            </p>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(window.location.origin + "/f/" + current.slug)
                    .then(() => toast.success("Share link copied."))
                    .catch(() => setError("Open the form and copy its address to share it."))
                }
              >
                <Copy aria-hidden="true" />
                Copy share link
              </Button>
              <Button asChild variant="ghost" className="min-h-11">
                <Link href={"/f/" + current.slug} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  Open form
                </Link>
              </Button>
              {current.canPublish ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => void closeForm()}
                >
                  Close form
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <nav aria-label="Editor view" className="mt-5 flex gap-2 lg:hidden">
        {(
          [
            ["questions", "Questions"],
            ["preview", "Preview"],
            ["settings", "Settings"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant={mobile === key ? "default" : "outline"}
            className="min-h-11 flex-1"
            aria-pressed={mobile === key}
            onClick={() => setMobile(key)}
          >
            {label}
          </Button>
        ))}
      </nav>
      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[190px_minmax(0,1fr)_270px]">
        <aside
          aria-label="Form structure"
          className={
            (mobile === "questions" ? "block" : "hidden") +
            " min-w-0 space-y-4 lg:sticky lg:top-44 lg:block lg:max-h-[75vh] lg:self-start lg:overflow-y-auto"
          }
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Questions</h2>
            <Button
              type="button"
              variant="ghost"
              className="size-11"
              aria-label="Form settings"
              onClick={() => {
                setSelected(null);
                setMobile("settings");
              }}
            >
              <Settings2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
          {definition.steps.map((step, stepIndex) => (
            <section key={step.key} className="space-y-2 rounded-lg border bg-card p-2">
              <div className="flex items-center gap-1">
                <Input
                  aria-label={"Step " + (stepIndex + 1) + " title"}
                  value={step.title}
                  placeholder={"Step " + (stepIndex + 1)}
                  maxLength={200}
                  disabled={!editable || pending}
                  onChange={(event) =>
                    change({
                      ...definition,
                      steps: definition.steps.map((item) =>
                        item.key === step.key ? { ...item, title: event.target.value } : item,
                      ),
                    })
                  }
                  className="min-h-11 border-transparent px-1 text-xs"
                />
                {definition.steps.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="size-11 shrink-0"
                    aria-label={"Remove step " + (stepIndex + 1)}
                    disabled={!editable || pending}
                    onClick={() => {
                      if (
                        !step.fields.length ||
                        window.confirm("Remove this step and its questions?")
                      )
                        removeStep(step.key);
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
              {step.fields.map((question, index) => (
                <div
                  key={question.key}
                  className={
                    "rounded-md border " +
                    (selected === question.key
                      ? "border-primary bg-secondary"
                      : "border-transparent")
                  }
                >
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-start gap-2 px-2 py-3 text-left text-xs"
                    aria-pressed={selected === question.key}
                    onClick={() => {
                      setSelected(question.key);
                      setMobile("settings");
                    }}
                  >
                    <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">
                      {question.label || "Untitled question"}
                    </span>
                  </button>
                  {editable ? (
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-11"
                        disabled={pending || index === 0}
                        aria-label={"Move up " + question.label}
                        onClick={() => moveField(step.key, question.key, -1)}
                      >
                        <ArrowUp className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-11"
                        disabled={pending || index === step.fields.length - 1}
                        aria-label={"Move down " + question.label}
                        onClick={() => moveField(step.key, question.key, 1)}
                      >
                        <ArrowDown className="size-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="size-11"
                        disabled={pending}
                        aria-label={"Remove " + question.label}
                        onClick={() => removeField(question.key)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {editable ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full justify-start text-xs"
                  disabled={
                    pending || step.fields.length >= 100 || allFields(definition).length >= 200
                  }
                  onClick={() => addQuestion(step.key)}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add question
                </Button>
              ) : null}
            </section>
          ))}
          {editable ? (
            <>
              <label htmlFor="add-question-type" className="block text-xs font-medium">
                New question type
              </label>
              <select
                id="add-question-type"
                value={addType}
                className="min-h-11 w-full rounded-md border border-input bg-card px-2 text-xs"
                onChange={(event) => setAddType(event.target.value as FieldType)}
              >
                {fieldTypes.map((type) => (
                  <option key={type} value={type}>
                    {fieldLabels[type]}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                className="min-h-11 w-full"
                disabled={pending || definition.steps.length >= 20}
                onClick={() =>
                  change({
                    ...definition,
                    steps: [
                      ...definition.steps,
                      {
                        key: "s_" + crypto.randomUUID().replaceAll("-", ""),
                        title: "Step " + (definition.steps.length + 1),
                        fields: [],
                      },
                    ],
                  })
                }
              >
                <Plus aria-hidden="true" />
                Add step
              </Button>
            </>
          ) : null}
        </aside>
        <section
          aria-label="Form preview"
          className={(mobile === "preview" ? "block" : "hidden") + " min-w-0 lg:block"}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live preview</h2>
            <span className="text-xs text-muted-foreground">
              {allFields(definition).length} questions
            </span>
          </div>
          <RespondentForm definition={definition} preview />
        </section>
        <aside
          aria-label="Editor settings"
          className={
            (mobile === "settings" ? "block" : "hidden") +
            " min-w-0 space-y-6 rounded-xl border bg-card p-4 lg:sticky lg:top-44 lg:block lg:max-h-[75vh] lg:self-start lg:overflow-y-auto"
          }
        >
          <Button
            variant="outline"
            type="button"
            className="min-h-11 w-full"
            onClick={() => setSelected(field ? null : (allFields(definition)[0]?.key ?? null))}
          >
            {field ? "Form settings" : "Question settings"}
          </Button>
          {field ? (
            <QuestionInspector
              key={field.key}
              field={field}
              onChange={updateField}
              disabled={!editable || pending}
            />
          ) : (
            <>
              <FormSettings
                definition={definition}
                onChange={change}
                disabled={!editable || pending}
              />
              <div className="border-t pt-5">
                <LogicEditor
                  definition={definition}
                  onChange={change}
                  disabled={!editable || pending}
                />
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
