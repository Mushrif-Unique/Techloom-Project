export class AppError extends Error {
  constructor(code, message, status = 409) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export function requireValue(value, code, message, status = 404) {
  if (!value) throw new AppError(code, message, status);
  return value;
}
