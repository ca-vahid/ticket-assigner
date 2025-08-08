import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWeightedTicketColumns1754692938973 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add weighted_ticket_count column
        await queryRunner.query(`
            ALTER TABLE "agents" 
            ADD COLUMN IF NOT EXISTS "weighted_ticket_count" DECIMAL(5,2) DEFAULT 0
        `);

        // Add ticket_workload_breakdown column
        await queryRunner.query(`
            ALTER TABLE "agents" 
            ADD COLUMN IF NOT EXISTS "ticket_workload_breakdown" JSONB
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN IF EXISTS "ticket_workload_breakdown"`);
        await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN IF EXISTS "weighted_ticket_count"`);
    }

}
