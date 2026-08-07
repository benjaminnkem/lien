import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("lien_audit_events")
export class LienAuditEvent {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "varchar", length: 66, nullable: true })
  obligationId!: string | null;

  @Column({ type: "varchar", length: 64 })
  eventType!: string;

  @Column({ type: "varchar", length: 32 })
  outcome!: string;

  @Column({ type: "varchar", length: 64, nullable: true })
  reasonCode!: string | null;

  @Column({ type: "simple-json" })
  payload!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
