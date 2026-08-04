import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AssetEntity } from "./asset.entity";

export type LienStatus = "active" | "released";

@Entity("liens")
export class LienEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "varchar", length: 66 })
  fingerprint!: string;

  @Column({ type: "uuid" })
  assetId!: string;

  @ManyToOne(() => AssetEntity, (asset) => asset.liens, { onDelete: "CASCADE" })
  @JoinColumn({ name: "assetId" })
  asset!: AssetEntity;

  @Column({ type: "varchar", length: 256 })
  lenderCvi!: string;

  @Column({ type: "varchar", length: 128, nullable: true })
  lenderWallet!: string | null;

  @Column({ type: "int", default: 1 })
  priority!: number;

  @Column({ type: "varchar", length: 32, default: "active" })
  status!: LienStatus;

  @Column({ type: "varchar", length: 128, nullable: true })
  cvaId!: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  txHash!: string | null;

  @CreateDateColumn({ type: "datetime" })
  registeredAt!: Date;
}
