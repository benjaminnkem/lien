import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      service: "lien-api",
      timestamp: new Date().toISOString(),
    };
  }
}
