import { randomUUID } from "node:crypto";
import { and, asc, eq, type WorkspaceTransaction } from "@repo/database";
import {
  fieldOptionsTable,
  formFieldsTable,
  formLogicRulesTable,
  formStepsTable,
  formVersionsTable,
} from "@repo/database/schema";
import { definitionSchema, type FormDefinition } from "@repo/form-core/definition";
import { FormError, missingForm } from "./errors";

export async function readDefinition(
  transaction: WorkspaceTransaction,
  workspaceId: string,
  versionId: string,
): Promise<FormDefinition> {
  const [version] = await transaction
    .select()
    .from(formVersionsTable)
    .where(
      and(eq(formVersionsTable.workspaceId, workspaceId), eq(formVersionsTable.id, versionId)),
    );
  if (!version) missingForm();
  const [steps, fields, options, rules] = await Promise.all([
    transaction
      .select()
      .from(formStepsTable)
      .where(
        and(eq(formStepsTable.workspaceId, workspaceId), eq(formStepsTable.versionId, versionId)),
      )
      .orderBy(asc(formStepsTable.position)),
    transaction
      .select()
      .from(formFieldsTable)
      .where(
        and(eq(formFieldsTable.workspaceId, workspaceId), eq(formFieldsTable.versionId, versionId)),
      )
      .orderBy(asc(formFieldsTable.position)),
    transaction
      .select()
      .from(fieldOptionsTable)
      .where(
        and(
          eq(fieldOptionsTable.workspaceId, workspaceId),
          eq(fieldOptionsTable.versionId, versionId),
        ),
      )
      .orderBy(asc(fieldOptionsTable.position)),
    transaction
      .select()
      .from(formLogicRulesTable)
      .where(
        and(
          eq(formLogicRulesTable.workspaceId, workspaceId),
          eq(formLogicRulesTable.versionId, versionId),
        ),
      )
      .orderBy(asc(formLogicRulesTable.priority)),
  ]);
  if (fields.some((field) => Object.keys(field.validation).length > 0))
    throw new FormError(
      "INVALID",
      "This imported definition needs a validation review before editing.",
    );
  const fieldKey = (id: string | null) => fields.find((field) => field.id === id)?.key;
  const parsed = definitionSchema.safeParse({
    title: version.title,
    description: version.description ?? "",
    settings: version.settings,
    steps: steps.map((step) => ({
      key: step.key,
      title: step.title ?? "",
      fields: fields
        .filter((field) => field.stepId === step.id)
        .map((field) => ({
          key: field.key,
          type: field.typeCode,
          label: field.label,
          helpText: field.helpText ?? "",
          required: field.required,
          configuration: field.configuration,
          options: options
            .filter((option) => option.fieldId === field.id)
            .map((option) => ({ key: option.key, label: option.label })),
        })),
    })),
    rules: rules.map((rule) => ({
      sourceFieldKey: fieldKey(rule.sourceFieldId),
      condition: rule.condition,
      actionKind: rule.actionKind,
      ...(rule.targetFieldId ? { targetFieldKey: fieldKey(rule.targetFieldId) } : {}),
      ...(rule.targetStepId
        ? { targetStepKey: steps.find((step) => step.id === rule.targetStepId)?.key }
        : {}),
    })),
  });
  if (!parsed.success)
    throw new FormError(
      "INVALID",
      "This definition contains settings that need review before editing or publishing.",
    );
  return parsed.data;
}
export async function writeDefinitionChildren(
  transaction: WorkspaceTransaction,
  workspaceId: string,
  versionId: string,
  definition: FormDefinition,
  replace = false,
): Promise<void> {
  if (replace) {
    await transaction
      .delete(formLogicRulesTable)
      .where(
        and(
          eq(formLogicRulesTable.workspaceId, workspaceId),
          eq(formLogicRulesTable.versionId, versionId),
        ),
      );
    await transaction
      .delete(formStepsTable)
      .where(
        and(eq(formStepsTable.workspaceId, workspaceId), eq(formStepsTable.versionId, versionId)),
      );
  }
  const stepIds = new Map(definition.steps.map((step) => [step.key, randomUUID()]));
  const fieldIds = new Map(
    definition.steps.flatMap((step) =>
      step.fields.map((field) => [field.key, randomUUID()] as const),
    ),
  );
  await transaction.insert(formStepsTable).values(
    definition.steps.map((step, position) => ({
      id: stepIds.get(step.key)!,
      workspaceId,
      versionId,
      key: step.key,
      title: step.title || null,
      position,
    })),
  );
  const fields = definition.steps.flatMap((step) =>
    step.fields.map((field, position) => ({
      id: fieldIds.get(field.key)!,
      workspaceId,
      versionId,
      stepId: stepIds.get(step.key)!,
      key: field.key,
      typeCode: field.type,
      label: field.label,
      helpText: field.helpText || null,
      required: field.required,
      configuration: { ...field.configuration },
      validation: {},
      position,
    })),
  );
  if (fields.length) await transaction.insert(formFieldsTable).values(fields);
  const options = definition.steps.flatMap((step) =>
    step.fields.flatMap((field) =>
      field.options.map((option, position) => ({
        id: randomUUID(),
        workspaceId,
        versionId,
        fieldId: fieldIds.get(field.key)!,
        key: option.key,
        label: option.label,
        position,
      })),
    ),
  );
  if (options.length) await transaction.insert(fieldOptionsTable).values(options);
  if (definition.rules.length)
    await transaction.insert(formLogicRulesTable).values(
      definition.rules.map((rule, priority) => ({
        workspaceId,
        versionId,
        sourceFieldId: fieldIds.get(rule.sourceFieldKey)!,
        priority,
        condition: { ...rule.condition },
        actionKind: rule.actionKind,
        targetFieldId: rule.targetFieldKey ? fieldIds.get(rule.targetFieldKey) : null,
        targetStepId: rule.targetStepKey ? stepIds.get(rule.targetStepKey) : null,
      })),
    );
}
