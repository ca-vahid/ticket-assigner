import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddAgentLeaveTracking1234567890123 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create agent_leaves table
    await queryRunner.createTable(
      new Table({
        name: 'agent_leaves',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'vacation_tracker_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'agent_id',
            type: 'uuid',
          },
          {
            name: 'leave_type',
            type: 'enum',
            enum: [
              'WFH',
              'Site Visit',
              'Training & Conferences',
              'Training & Conferences (Hourly)',
              'Sick Day',
              'Sick Day (Hourly)',
              'Vacation',
              'Personal Time Off (PTO)',
              'Personal Time Off (PTO) (Hourly)',
            ],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'approved', 'rejected', 'cancelled'],
            default: "'approved'",
          },
          {
            name: 'start_date',
            type: 'timestamp',
          },
          {
            name: 'end_date',
            type: 'timestamp',
          },
          {
            name: 'is_all_day',
            type: 'boolean',
            default: false,
          },
          {
            name: 'duration',
            type: 'float',
            isNullable: true,
          },
          {
            name: 'reason',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_available_for_work',
            type: 'boolean',
            default: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create foreign key for agent
    await queryRunner.createForeignKey(
      'agent_leaves',
      new TableForeignKey({
        columnNames: ['agent_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'agents',
        onDelete: 'CASCADE',
      })
    );

    // Create indexes
    await queryRunner.createIndex(
      'agent_leaves',
      new TableIndex({
        name: 'IDX_agent_leaves_dates',
        columnNames: ['agent_id', 'start_date', 'end_date'],
      })
    );

    await queryRunner.createIndex(
      'agent_leaves',
      new TableIndex({
        name: 'IDX_agent_leaves_type_status',
        columnNames: ['leave_type', 'status'],
      })
    );

    // Add columns to agents table
    await queryRunner.addColumn(
      'agents',
      new TableColumn({
        name: 'is_pto',
        type: 'boolean',
        default: false,
      })
    );

    await queryRunner.addColumn(
      'agents',
      new TableColumn({
        name: 'current_leave_type',
        type: 'varchar',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'agents',
      new TableColumn({
        name: 'pto_start_date',
        type: 'timestamp',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'agents',
      new TableColumn({
        name: 'pto_end_date',
        type: 'timestamp',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'agents',
      new TableColumn({
        name: 'last_vacation_tracker_sync',
        type: 'timestamp',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns from agents table
    await queryRunner.dropColumn('agents', 'last_vacation_tracker_sync');
    await queryRunner.dropColumn('agents', 'pto_end_date');
    await queryRunner.dropColumn('agents', 'pto_start_date');
    await queryRunner.dropColumn('agents', 'current_leave_type');
    await queryRunner.dropColumn('agents', 'is_pto');

    // Drop indexes
    await queryRunner.dropIndex('agent_leaves', 'IDX_agent_leaves_type_status');
    await queryRunner.dropIndex('agent_leaves', 'IDX_agent_leaves_dates');

    // Drop table
    await queryRunner.dropTable('agent_leaves');
  }
}