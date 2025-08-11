# PowerShell Script to Setup Skill Detection Database
# Run with: powershell -ExecutionPolicy Bypass -File setup-skills.ps1

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SKILL DETECTION SETUP SCRIPT" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Load environment variables
$envFile = ".env"
if (Test-Path $envFile) {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

# Database connection settings
$dbHost = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$dbName = if ($env:DB_NAME) { $env:DB_NAME } else { "ticket_assigner" }
$dbUser = if ($env:DB_USER) { $env:DB_USER } else { "user" }
$dbPassword = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "password" }

Write-Host "Database Configuration:" -ForegroundColor Green
Write-Host "  Host: $dbHost" -ForegroundColor White
Write-Host "  Port: $dbPort" -ForegroundColor White
Write-Host "  Database: $dbName" -ForegroundColor White
Write-Host "  User: $dbUser" -ForegroundColor White
Write-Host ""

# Install required npm package if not present
Write-Host "Checking for required packages..." -ForegroundColor Yellow
if (!(Test-Path "node_modules\pg")) {
    Write-Host "Installing pg package..." -ForegroundColor Yellow
    npm install pg --no-save
}

# Create Node.js script to run migration
$nodeScript = @'
const { Client } = require('pg');

async function runMigration() {
    const client = new Client({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'ticket_assigner',
        user: process.env.DB_USER || 'user',
        password: process.env.DB_PASSWORD || 'password'
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('✓ Connected to database');

        // Check if tables already exist
        const checkTablesQuery = `
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_name IN ('skill_detection_config', 'detected_skills', 'skill_audit_logs')
        `;
        
        const tablesCheck = await client.query(checkTablesQuery);
        const existingTables = parseInt(tablesCheck.rows[0].count);
        
        if (existingTables > 0) {
            console.log(`ℹ Some skill detection tables already exist (${existingTables}/3)`);
        }

        // Check if columns exist in agents table
        const checkColumnsQuery = `
            SELECT COUNT(*) as count
            FROM information_schema.columns 
            WHERE table_name = 'agents' 
            AND column_name IN ('category_skills', 'auto_detected_skills', 'skill_metadata', 'last_skill_detection_at')
        `;
        
        const columnsCheck = await client.query(checkColumnsQuery);
        const existingColumns = parseInt(columnsCheck.rows[0].count);
        
        if (existingColumns > 0) {
            console.log(`ℹ Some skill columns already exist in agents table (${existingColumns}/4)`);
        }

        console.log('\nApplying migration...\n');

        // Add columns to agents table
        console.log('Adding skill columns to agents table...');
        const alterTableQueries = [
            "ALTER TABLE agents ADD COLUMN IF NOT EXISTS category_skills text[]",
            "ALTER TABLE agents ADD COLUMN IF NOT EXISTS auto_detected_skills text[]",
            "ALTER TABLE agents ADD COLUMN IF NOT EXISTS skill_metadata jsonb",
            "ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_skill_detection_at timestamp"
        ];

        for (const query of alterTableQueries) {
            try {
                await client.query(query);
                console.log(`  ✓ ${query.match(/ADD COLUMN IF NOT EXISTS (\w+)/)[1]}`);
            } catch (err) {
                console.log(`  ⚠ ${err.message}`);
            }
        }

        // Create skill_detection_config table
        console.log('\nCreating skill_detection_config table...');
        await client.query(`
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
        console.log('  ✓ skill_detection_config table ready');

        // Create detected_skills table
        console.log('\nCreating detected_skills table...');
        await client.query(`
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
        console.log('  ✓ detected_skills table ready');

        // Create skill_audit_logs table
        console.log('\nCreating skill_audit_logs table...');
        await client.query(`
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
        console.log('  ✓ skill_audit_logs table ready');

        // Create indexes
        console.log('\nCreating indexes...');
        const indexQueries = [
            "CREATE INDEX IF NOT EXISTS idx_detected_skills_agent_id ON detected_skills(agent_id)",
            "CREATE INDEX IF NOT EXISTS idx_detected_skills_status ON detected_skills(status)",
            "CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_agent_id ON skill_audit_logs(agent_id)",
            "CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_created_at ON skill_audit_logs(created_at)"
        ];

        for (const query of indexQueries) {
            await client.query(query);
            console.log(`  ✓ ${query.match(/CREATE INDEX IF NOT EXISTS (\w+)/)[1]}`);
        }

        console.log('\n✅ Migration completed successfully!\n');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        if (error.code === 'ECONNREFUSED') {
            console.error('\n⚠️  Database connection failed. Please ensure:');
            console.error('   1. PostgreSQL is running');
            console.error('   2. Connection settings are correct');
            console.error('   3. Database "' + (process.env.DB_NAME || 'ticket_assigner') + '" exists');
        }
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
'@

# Save the Node.js script
$nodeScriptPath = "temp_migration.js"
Set-Content -Path $nodeScriptPath -Value $nodeScript

Write-Host "`nRunning database migration..." -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Gray

# Run the Node.js script
$result = node $nodeScriptPath 2>&1
$exitCode = $LASTEXITCODE

# Display the result
Write-Host $result

# Clean up temp file
Remove-Item $nodeScriptPath -ErrorAction SilentlyContinue

if ($exitCode -eq 0) {
    Write-Host "`n✅ Database setup complete!" -ForegroundColor Green
    
    # Now fix the entity file
    Write-Host "`nEnabling skill columns in Agent entity..." -ForegroundColor Yellow
    
    $entityFile = "src/database/entities/agent.entity.ts"
    if (Test-Path $entityFile) {
        $content = Get-Content $entityFile -Raw
        
        # Uncomment the column decorators
        $content = $content -replace '// @Column\(''text''.*?name: ''category_skills''.*?\)', '@Column(''text'', { array: true, nullable: true, name: ''category_skills'' })'
        $content = $content -replace '// @Column\(''text''.*?name: ''auto_detected_skills''.*?\)', '@Column(''text'', { array: true, nullable: true, name: ''auto_detected_skills'' })'
        $content = $content -replace '// @Column\({.*?name: ''skill_metadata''.*?\)', '@Column({ type: ''jsonb'', nullable: true, name: ''skill_metadata'' })'
        $content = $content -replace '// @Column\({.*?name: ''last_skill_detection_at''.*?\)', '@Column({ name: ''last_skill_detection_at'', nullable: true })'
        
        Set-Content -Path $entityFile -Value $content
        Write-Host "✓ Agent entity file updated" -ForegroundColor Green
    }
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  SETUP COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Restart the backend: npm run start:dev" -ForegroundColor White
    Write-Host "2. Go to /skills page in the UI" -ForegroundColor White
    Write-Host "3. Click 'Initialize' to set up default configurations" -ForegroundColor White
    Write-Host "4. Click 'Run Detection' to detect skills for all agents" -ForegroundColor White
    
} else {
    Write-Host "`n❌ Setup failed!" -ForegroundColor Red
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure PostgreSQL is running" -ForegroundColor White
    Write-Host "2. Check your database connection settings in .env file" -ForegroundColor White
    Write-Host "3. Ensure the database 'ticket_assigner' exists" -ForegroundColor White
    Write-Host "4. Try running: docker compose up -d (if using Docker)" -ForegroundColor White
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")