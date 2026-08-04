import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import {
  ApiBadGatewayResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CleanverseService } from "./cleanverse.service";
import { CleanverseApiError, CleanverseConfigError } from "./cleanverse.errors";
import { QueryApassDto } from "./dto/query-apass.dto";
import { VerifyApassDto } from "./dto/verify-apass.dto";
import { QueryAtokenListDto } from "./dto/query-atoken-list.dto";

@ApiTags("cleanverse")
@Controller("cleanverse")
export class CleanverseController {
  constructor(private readonly cleanverse: CleanverseService) {}

  @Get("status")
  @ApiOperation({ summary: "Cleanverse client configuration status" })
  @ApiOkResponse({
    description: "Whether sandbox credentials are loaded (no secrets returned)",
    schema: {
      type: "object",
      properties: {
        configured: { type: "boolean" },
        baseUrl: { type: "string" },
        apiIdPresent: { type: "boolean" },
        apiKeyPresent: { type: "boolean" },
        docsUrl: { type: "string" },
      },
    },
  })
  status() {
    return this.cleanverse.getStatus();
  }

  @Post("apass/query")
  @ApiOperation({
    summary: "Query A-Pass (CVI) by wallet",
    description: "Proxies Cleanverse POST /query_apass",
  })
  @ApiOkResponse({ description: "Cleanverse envelope for A-Pass lookup" })
  @ApiServiceUnavailableResponse({ description: "Missing Cleanverse env" })
  @ApiBadGatewayResponse({ description: "Cleanverse API error" })
  async queryApass(@Body() body: QueryApassDto) {
    return this.handle(() => this.cleanverse.queryApass(body));
  }

  @Post("apass/verify")
  @ApiOperation({
    summary: "Verify A-Pass against an A-Token (CVA)",
    description:
      "Proxies Cleanverse POST /verify_apass. data.code: 1=not found, 2=no A-Pass, 3=blocked, 4=ok",
  })
  @ApiOkResponse({ description: "Verification result" })
  @ApiServiceUnavailableResponse({ description: "Missing Cleanverse env" })
  @ApiBadGatewayResponse({ description: "Cleanverse API error" })
  async verifyApass(@Body() body: VerifyApassDto) {
    return this.handle(() => this.cleanverse.verifyApass(body));
  }

  @Post("atoken/list")
  @ApiOperation({
    summary: "List supported A-Tokens on a chain",
    description: "Proxies Cleanverse POST /query_deposit_atoken_list",
  })
  @ApiOkResponse({ description: "Token list for the chain" })
  @ApiServiceUnavailableResponse({ description: "Missing Cleanverse env" })
  @ApiBadGatewayResponse({ description: "Cleanverse API error" })
  async listAtokens(@Body() body: QueryAtokenListDto) {
    return this.handle(() => this.cleanverse.queryDepositAtokenList(body));
  }

  @Get("atoken/apply-status/:requestId")
  @ApiOperation({
    summary: "Query A-Token apply status",
    description: "Proxies Cleanverse GET /atoken/query_apply_status/{requestId}",
  })
  @ApiParam({
    name: "requestId",
    example: "IA2026061617201896726",
    description: "requestId returned by launch/register",
  })
  @ApiOkResponse({ description: "Apply status envelope" })
  @ApiServiceUnavailableResponse({ description: "Missing Cleanverse env" })
  @ApiBadGatewayResponse({ description: "Cleanverse API error" })
  async applyStatus(@Param("requestId") requestId: string) {
    return this.handle(() => this.cleanverse.queryApplyStatus(requestId));
  }

  private async handle<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof CleanverseConfigError) {
        throw new HttpException(
          { message: error.message },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      if (error instanceof CleanverseApiError) {
        const status =
          error.httpStatus >= 400 && error.httpStatus < 600
            ? error.httpStatus
            : HttpStatus.BAD_GATEWAY;
        throw new HttpException(
          {
            message: error.message,
            code: error.code,
            cleanverse: error.raw,
          },
          status === 0 ? HttpStatus.BAD_GATEWAY : status,
        );
      }
      throw error;
    }
  }
}
