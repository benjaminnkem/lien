import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LienAuditEvent } from "./entities/lien-audit-event.entity";

@Injectable()
export class LienAuditService {
  constructor(
    @InjectRepository(LienAuditEvent)
    private readonly repo: Repository<LienAuditEvent>,
  ) {}

  async record(input: {
    obligationId?: string | null;
    eventType: string;
    outcome: string;
    reasonCode?: string | null;
    payload?: Record<string, unknown>;
  }) {
    const row = this.repo.create({
      obligationId: input.obligationId ?? null,
      eventType: input.eventType,
      outcome: input.outcome,
      reasonCode: input.reasonCode ?? null,
      payload: input.payload ?? {},
    });
    return this.repo.save(row);
  }

  async forObligation(obligationId: string, limit = 100) {
    return this.repo.find({
      where: { obligationId },
      order: { createdAt: "ASC" },
      take: limit,
    });
  }

  async recent(limit = 50) {
    return this.repo.find({
      order: { createdAt: "DESC" },
      take: limit,
    });
  }
}
