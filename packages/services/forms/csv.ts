import type { ResponseItem } from "./model";
import { FormError } from "./errors";
function cell(value: string) {
  // Spreadsheets can execute formulas even when the CSV value is quoted.
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function responseCsv(items: ResponseItem[]): string {
  const rows = [
      "Response ID,Received (UTC),Version ID,Version,Form title,Question key,Question,Type,Answer",
    ],
    limit = 5 * 1024 * 1024;
  let bytes = Buffer.byteLength(rows[0]!);
  for (const item of items) {
    const answers = item.answers.length
      ? item.answers
      : [{ fieldKey: "", label: "", type: "", text: "" }];
    for (const answer of answers) {
      const row = [
        item.id,
        item.completedAt,
        item.versionId,
        String(item.versionNumber),
        item.formTitle,
        answer.fieldKey,
        answer.label,
        answer.type,
        answer.text,
      ]
        .map(cell)
        .join(",");
      bytes += Buffer.byteLength(row) + 2;
      if (bytes > limit)
        throw new FormError(
          "INVALID",
          "This response page exceeds the 5 MB export limit. Export fewer responses using the API limit parameter.",
        );
      rows.push(row);
    }
  }
  return "\uFEFF" + rows.join("\r\n") + "\r\n";
}
