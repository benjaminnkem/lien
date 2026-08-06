import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance, isAxiosError } from "axios";
import { randomUUID } from "node:crypto";
import { encryptRequestBody } from "./cleanverse.crypto";
import { CleanverseApiError, CleanverseConfigError } from "./cleanverse.errors";
import type {
  AddAtokenRuleRequest,
  CleanverseEnvelope,
  DepositAtokenListData,
  GenerateApassRequest,
  IsPausedData,
  IsPausedRequest,
  LaunchAtokenData,
  LaunchAtokenRequest,
  QueryApassData,
  QueryApassRequest,
  QueryApplyStatusData,
  QueryDepositAtokenListRequest,
  RegisterAtokenRequest,
  SetPausedRequest,
  UpdateStatusRequest,
  VerifyApassData,
  VerifyApassRequest,
  VerifyUserComplianceData,
  VerifyUserComplianceRequest,
} from "./cleanverse.types";

type RequestOptions = {
  method?: "GET" | "POST";
  path: string;
  body?: unknown;
  encrypt?: boolean;
  requestId?: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

@Injectable()
export class CleanverseService {
  private readonly logger = new Logger(CleanverseService.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({
      timeout: this.timeoutMs,
      headers: {
        Accept: "application/json",
      },
      validateStatus: () => true,
      transitional: {
        clarifyTimeoutError: true,
      },
    });
  }

  get isConfigured(): boolean {
    return Boolean(this.apiId && this.apiKey && this.baseUrl);
  }

  getStatus() {
    return {
      configured: this.isConfigured,
      baseUrl: this.baseUrl,
      apiIdPresent: Boolean(this.apiId),
      apiKeyPresent: Boolean(this.apiKey),
      docsUrl: this.config.get<string>("cleanverse.docsUrl"),
    };
  }

  private get baseUrl(): string {
    return (this.config.get<string>("cleanverse.baseUrl") ?? "").replace(
      /\/$/,
      "",
    );
  }

  private get apiId(): string {
    return this.config.get<string>("cleanverse.apiId") ?? "";
  }

  private get apiKey(): string {
    return this.config.get<string>("cleanverse.apiKey") ?? "";
  }

  private get timeoutMs(): number {
    const raw = this.config.get<string | number>("CLEANVERSE_TIMEOUT_MS");
    const parsed =
      typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
  }

  private get maxRetries(): number {
    const raw = this.config.get<string | number>("CLEANVERSE_MAX_RETRIES");
    const parsed =
      typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MAX_RETRIES;
  }

  private assertConfigured() {
    if (!this.baseUrl || !this.apiId || !this.apiKey) {
      throw new CleanverseConfigError(
        "Cleanverse is not configured. Set CLEANVERSE_BASE_URL, CLEANVERSE_API_ID, and CLEANVERSE_API_KEY.",
      );
    }
  }

  async generateApass(payload: GenerateApassRequest) {
    return this.request<unknown>({
      method: "POST",
      path: "/generate_apass",
      body: payload,
      encrypt: true,
    });
  }

  async updateStatus(payload: UpdateStatusRequest) {
    return this.request<unknown>({
      method: "POST",
      path: "/update_status",
      body: payload,
      encrypt: true,
    });
  }

  async queryApass(payload: QueryApassRequest) {
    return this.request<QueryApassData>({
      method: "POST",
      path: "/query_apass",
      body: payload,
    });
  }

  async verifyApass(payload: VerifyApassRequest) {
    return this.request<VerifyApassData>({
      method: "POST",
      path: "/verify_apass",
      body: payload,
    });
  }

  async launchAtoken(payload: LaunchAtokenRequest) {
    return this.request<LaunchAtokenData>({
      method: "POST",
      path: "/atoken/launch",
      body: payload,
      encrypt: true,
    });
  }

  async registerAtoken(payload: RegisterAtokenRequest) {
    return this.request<unknown>({
      method: "POST",
      path: "/atoken/register_atoken",
      body: payload,
      encrypt: true,
    });
  }

  async queryApplyStatus(requestId: string) {
    return this.request<QueryApplyStatusData>({
      method: "GET",
      path: `/atoken/query_apply_status/${encodeURIComponent(requestId)}`,
    });
  }

  async queryDepositAtokenList(payload: QueryDepositAtokenListRequest) {
    return this.request<DepositAtokenListData>({
      method: "POST",
      path: "/query_deposit_atoken_list",
      body: payload,
    });
  }

  async addAtokenRule(payload: AddAtokenRuleRequest) {
    return this.request<unknown>({
      method: "POST",
      path: "/atoken/add_rule",
      body: payload,
      encrypt: true,
    });
  }

  async isAtokenPaused(payload: IsPausedRequest) {
    return this.request<IsPausedData>({
      method: "POST",
      path: "/atoken/is_paused",
      body: payload,
    });
  }

  async setAtokenPaused(payload: SetPausedRequest) {
    return this.request<unknown>({
      method: "POST",
      path: "/atoken/set_paused",
      body: payload,
      encrypt: true,
    });
  }

  async verifyUserCompliance(payload: VerifyUserComplianceRequest) {
    return this.request<VerifyUserComplianceData>({
      method: "POST",
      path: "/validator/verify",
      body: payload,
    });
  }

  private async request<T>({
    method = "POST",
    path,
    body,
    encrypt = false,
    requestId = randomUUID(),
  }: RequestOptions): Promise<CleanverseEnvelope<T>> {
    this.assertConfigured();

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      "api-id": this.apiId,
      "X-Request-ID": requestId,
      Accept: "application/json",
    };

    let data: unknown;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      data = encrypt ? encryptRequestBody(body, this.apiKey) : body;
    }

    this.logger.debug(`${method} ${path} (encrypt=${encrypt})`);

    const response = await this.requestWithRetry({
      method,
      url,
      headers,
      data,
    });

    const status = response.status;
    const raw = response.data;
    let parsed: CleanverseEnvelope<T> | null = null;

    if (typeof raw === "string") {
      if (raw.length > 0) {
        try {
          parsed = JSON.parse(raw) as CleanverseEnvelope<T>;
        } catch {
          throw new CleanverseApiError(
            "INVALID_JSON",
            `Cleanverse returned non-JSON (HTTP ${status})`,
            status,
            raw.slice(0, 500),
          );
        }
      }
    } else if (raw && typeof raw === "object") {
      parsed = raw as CleanverseEnvelope<T>;
    }

    if (status < 200 || status >= 300) {
      throw new CleanverseApiError(
        parsed?.code ?? String(status),
        parsed?.message ?? `Cleanverse HTTP ${status}`,
        status,
        parsed ?? raw,
      );
    }

    if (!parsed) {
      throw new CleanverseApiError(
        "EMPTY_RESPONSE",
        "Cleanverse returned an empty response body",
        status,
      );
    }

    if (parsed.code && parsed.code !== "0000") {
      throw new CleanverseApiError(
        parsed.code,
        parsed.message || "Cleanverse business error",
        status,
        parsed,
      );
    }

    return parsed;
  }

  private async requestWithRetry(options: {
    method: string;
    url: string;
    headers: Record<string, string>;
    data?: unknown;
  }) {
    const attempts = this.maxRetries;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await this.http.request({
          method: options.method,
          url: options.url,
          headers: options.headers,
          data: options.data,
          timeout: this.timeoutMs,
          responseType: "json",
          transformResponse: [
            (body: string) => {
              if (body == null || body === "") return body;
              try {
                return JSON.parse(body);
              } catch {
                return body;
              }
            },
          ],
        });
      } catch (error) {
        lastError = error;
        const detail = this.formatNetworkError(error);
        const retryable = this.isRetryableNetworkError(error);
        this.logger.warn(
          `Cleanverse ${options.method} ${options.url} attempt ${attempt}/${attempts} failed: ${detail}`,
        );
        if (!retryable || attempt === attempts) break;
        await this.sleep(250 * 2 ** (attempt - 1));
      }
    }

    throw new CleanverseApiError(
      "NETWORK_ERROR",
      this.formatNetworkError(lastError),
      0,
      lastError,
    );
  }

  private isRetryableNetworkError(error: unknown): boolean {
    if (isAxiosError(error)) {
      if (!error.response) {
        const code = error.code ?? "";
        return (
          code === "ECONNABORTED" ||
          code === "ETIMEDOUT" ||
          code === "ECONNRESET" ||
          code === "ECONNREFUSED" ||
          code === "EAI_AGAIN" ||
          code === "ENOTFOUND" ||
          code === "ERR_NETWORK" ||
          /timeout|socket hang up|ECONNRESET|Network Error/i.test(
            error.message,
          )
        );
      }
      const status = error.response.status;
      return status === 502 || status === 503 || status === 504;
    }

    const message = error instanceof Error ? error.message : String(error ?? "");
    return /timeout|fetch failed|socket hang up|ECONNRESET/i.test(message);
  }

  private formatNetworkError(error: unknown): string {
    if (!error) return "Cleanverse network error";
    if (isAxiosError(error)) {
      const parts = [
        error.message,
        error.code,
        error.response ? `HTTP ${error.response.status}` : undefined,
      ].filter(Boolean);
      return parts.join(" — ");
    }
    if (error instanceof Error) {
      const cause =
        "cause" in error && error.cause instanceof Error
          ? error.cause.message
          : undefined;
      return [error.message, cause].filter(Boolean).join(" — ");
    }
    return String(error);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
