import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import type { AuditEventType } from "lien-sdk";
import { AssetEntity } from "./asset.entity";

@Entity("audit_events")
export class AuditEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", length: 64 })
  type!: AuditEventType;

  @Index()
  @Column({ type: "varchar", length: 66, nullable: true })
  fingerprint!: string | null;

  @Column({ type: "uuid", nullable: true })
  assetId!: string | null;

  @ManyToOne(() => AssetEntity, (asset) => asset.auditEvents, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "assetId" })
  asset!: AssetEntity | null;

  @Column({ type: "simple-json", default: "{}" })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;
}
