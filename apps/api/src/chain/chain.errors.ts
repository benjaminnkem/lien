export class ChainConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainConfigError";
  }
}

export class ChainWriteError extends Error {
  constructor(
    message: string,
    public readonly raw?: unknown,
  ) {
    super(message);
    this.name = "ChainWriteError";
  }
}

export class ChainAlreadyEncumberedError extends Error {
  constructor(
    public readonly fingerprint: string,
    public readonly existingLender: string,
  ) {
    super(
      `On-chain first-priority lien already active for ${fingerprint} (lender ${existingLender})`,
    );
    this.name = "ChainAlreadyEncumberedError";
  }
}
