export class MobileApiNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MobileApiNetworkError';
  }
}

export class MobileApiRequestError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, code: string | null, status: number) {
    super(message);
    this.name = 'MobileApiRequestError';
    this.code = code;
    this.status = status;
  }
}

export function isTransientMobileApiError(error: unknown): boolean {
  if (error instanceof MobileApiNetworkError) return true;
  if (!(error instanceof MobileApiRequestError)) return false;

  return error.status === 408
    || error.status === 425
    || (error.status >= 500 && error.status <= 599);
}
