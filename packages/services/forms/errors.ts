export class FormError extends Error {
  constructor(
    public readonly reason: "NOT_FOUND" | "CONFLICT" | "INVALID" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "FormError";
  }
}
export function missingForm(): never {
  throw new FormError("NOT_FOUND", "This form is unavailable.");
}
