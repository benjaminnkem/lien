import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: "Health check" })
  @ApiOkResponse({
    description: "Service is up",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        service: { type: "string", example: "lien-api" },
        timestamp: { type: "string", format: "date-time" },
        cleanverseConfigured: { type: "boolean", example: true },
        lien: { type: "object" },
      },
    },
  })
  check() {
    const cleanverseConfigured = Boolean(
      this.config.get<string>("cleanverse.apiId") &&
        this.config.get<string>("cleanverse.apiKey") &&
        this.config.get<string>("cleanverse.baseUrl"),
    );

    return {
      status: "ok",
      service: "lien-api",
      timestamp: new Date().toISOString(),
      cleanverseConfigured,
      lien: {
        enabled: (this.config.get<string>("lien.enabled") ?? "true") !== "false",
        chainId: this.config.get<number>("lien.chainId"),
        registry: this.config.get<string>("lien.registryAddress") || null,
        guard: this.config.get<string>("lien.guardAddress") || null,
        trustMode: this.config.get<string>("lien.trustMode") || null,
      },
    };
  }
}
