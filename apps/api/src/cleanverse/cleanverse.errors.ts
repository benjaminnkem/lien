export class CleanverseApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "CleanverseApiError";
  }
}

export class CleanverseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CleanverseConfigError";
  }
}
