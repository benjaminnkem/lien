import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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

@Injectable()
export class CleanverseService {
  private readonly logger = new Logger(CleanverseService.name);

  constructor(private readonly config: ConfigService) {}

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

    let payload: string | undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      const outbound = encrypt ? encryptRequestBody(body, this.apiKey) : body;
      payload = JSON.stringify(outbound);
    }

    this.logger.debug(`${method} ${path} (encrypt=${encrypt})`);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: payload,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cleanverse network error";
      throw new CleanverseApiError("NETWORK_ERROR", message, 0, error);
    }

    const text = await response.text();
    let parsed: CleanverseEnvelope<T> | null = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as CleanverseEnvelope<T>;
      } catch {
        throw new CleanverseApiError(
          "INVALID_JSON",
          `Cleanverse returned non-JSON (HTTP ${response.status})`,
          response.status,
          text.slice(0, 500),
        );
      }
    }

    if (!response.ok) {
      throw new CleanverseApiError(
        parsed?.code ?? String(response.status),
        parsed?.message ?? `Cleanverse HTTP ${response.status}`,
        response.status,
        parsed ?? text,
      );
    }

    if (!parsed) {
      throw new CleanverseApiError(
        "EMPTY_RESPONSE",
        "Cleanverse returned an empty response body",
        response.status,
      );
    }

    if (parsed.code && parsed.code !== "0000") {
      throw new CleanverseApiError(
        parsed.code,
        parsed.message || "Cleanverse business error",
        response.status,
        parsed,
      );
    }

    return parsed;
  }
}
