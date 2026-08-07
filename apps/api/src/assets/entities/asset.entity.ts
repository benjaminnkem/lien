import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AssetStatus } from '@repo/sdk';
import { LienEntity } from './lien.entity';
import { AuditEventEntity } from './audit-event.entity';
import type { PartyVerificationEvidence } from '../party-verification.types';

@Entity('assets')
export class AssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 66, unique: true })
  fingerprint!: string;

  @Column({ type: 'varchar', length: 256 })
  issuerCvi!: string;

  @Column({ type: 'varchar', length: 256 })
  debtorCvi!: string;

  @Column({ type: 'varchar', length: 128 })
  documentHash!: string;

  @Column({ type: 'varchar', length: 128 })
  invoiceNumber!: string;

  @Column({ type: 'varchar', length: 64 })
  amount!: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  @Column({ type: 'varchar', length: 32 })
  dueDate!: string;

  @Column({ type: 'varchar', length: 32, default: 'fingerprinted' })
  status!: AssetStatus;

  @Column({ type: 'varchar', length: 32, nullable: true })
  chain!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  issuerWallet!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  debtorWallet!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  atokenAddress!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  issuerVerification!: PartyVerificationEvidence | null;

  @Column({ type: 'datetime', nullable: true })
  issuerCviVerifiedAt!: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  cvaId!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  cvaRequestId!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  cvaApplyStatus!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  cvaAtokenAddress!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  cvaSymbol!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  cvaName!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  cvaTxHash!: string | null;

  @Column({ type: 'datetime', nullable: true })
  cvaIssuedAt!: Date | null;

  @OneToMany(() => LienEntity, (lien) => lien.asset)
  liens!: LienEntity[];

  @OneToMany(() => AuditEventEntity, (event) => event.asset)
  auditEvents!: AuditEventEntity[];

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}
