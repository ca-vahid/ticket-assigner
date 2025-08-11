import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSkillDetectionColumns1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to agents table
    await queryRunner.query(`
      ALTER TABLE agents 
      ADD COLUMN IF NOT EXISTS category_skills text[],
      ADD COLUMN IF NOT EXISTS auto_detected_skills text[],
      ADD COLUMN IF NOT EXISTS skill_metadata jsonb,
      ADD COLUMN IF NOT EXISTS last_skill_detection_at timestamp,
      ADD COLUMN IF NOT EXISTS is_pto boolean DEFAULT false
    `);

    // Create skill_detection_config table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS skill_detection_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        method varchar NOT NULL,
        enabled boolean DEFAULT true,
        settings jsonb,
        last_run_at timestamp,
        last_run_status varchar,
        last_run_stats jsonb,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create detected_skills table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS detected_skills (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id uuid NOT NULL REFERENCES agents(id),
        skill_name varchar NOT NULL,
        skill_type varchar NOT NULL,
        detection_method varchar NOT NULL,
        confidence float,
        metadata jsonb,
        status varchar DEFAULT 'PENDING',
        reviewed_by varchar,
        reviewed_at timestamp,
        review_notes text,
        detected_at timestamp DEFAULT CURRENT_TIMESTAMP,
        is_active boolean DEFAULT false
      )
    `);

    // Create skill_audit_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS skill_audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id uuid REFERENCES agents(id),
        action varchar NOT NULL,
        skill_name varchar,
        previous_value jsonb,
        new_value jsonb,
        metadata jsonb,
        performed_by varchar,
        created_at timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_detected_skills_agent_id ON detected_skills(agent_id);
      CREATE INDEX IF NOT EXISTS idx_detected_skills_status ON detected_skills(status);
      CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_agent_id ON skill_audit_logs(agent_id);
      CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_created_at ON skill_audit_logs(created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_detected_skills_agent_id;
      DROP INDEX IF EXISTS idx_detected_skills_status;
      DROP INDEX IF EXISTS idx_skill_audit_logs_agent_id;
      DROP INDEX IF EXISTS idx_skill_audit_logs_created_at;
    `);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS skill_audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS detected_skills`);
    await queryRunner.query(`DROP TABLE IF EXISTS skill_detection_config`);

    // Remove columns from agents table
    await queryRunner.query(`
      ALTER TABLE agents 
      DROP COLUMN IF EXISTS category_skills,
      DROP COLUMN IF EXISTS auto_detected_skills,
      DROP COLUMN IF EXISTS skill_metadata,
      DROP COLUMN IF EXISTS last_skill_detection_at,
      DROP COLUMN IF EXISTS is_pto
    `);
  }
}