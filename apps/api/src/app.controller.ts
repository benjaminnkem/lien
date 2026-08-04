import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AppService } from "./app.service";

@ApiTags("app")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: "API info" })
  @ApiOkResponse({
    description: "Service metadata",
    schema: {
      type: "object",
      properties: {
        name: { type: "string", example: "Lien API" },
        description: { type: "string" },
        version: { type: "string", example: "0.0.1" },
        docs: { type: "string", example: "/health" },
      },
    },
  })
  getRoot() {
    return this.appService.getInfo();
  }
}
