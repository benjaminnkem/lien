import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: "Lien API",
      description:
        "Pre-mint and pre-collateralization firewall for Real-World Assets",
      version: "0.0.1",
      docs: "/health",
    };
  }
}
