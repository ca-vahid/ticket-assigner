# PowerShell Script to Setup Skill Detection Database for Azure PostgreSQL
# Run with: powershell -ExecutionPolicy Bypass -File setup-skills-azure.ps1

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  SKILL DETECTION SETUP SCRIPT (AZURE)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Load environment variables
$envFile = ".env"
if (Test-Path $envFile) {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
            # Debug output
            if ($key -like "DB_*" -or $key -like "DATABASE_*") {
                if ($key -like "*PASSWORD*") {
                    Write-Host "  $key = ****" -ForegroundColor Gray
                } else {
                    Write-Host "  $key = $value" -ForegroundColor Gray
                }
            }
        }
    }
}

# Database connection settings - check both DB_ and DATABASE_ prefixes
$dbHost = if ($env:DATABASE_HOST) { $env:DATABASE_HOST } elseif ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$dbPort = if ($env:DATABASE_PORT) { $env:DATABASE_PORT } elseif ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$dbName = if ($env:DATABASE_NAME) { $env:DATABASE_NAME } elseif ($env:DB_NAME) { $env:DB_NAME } else { "ticket_assigner" }
$dbUser = if ($env:DATABASE_USER) { $env:DATABASE_USER } elseif ($env:DB_USER) { $env:DB_USER } else { "user" }
$dbPassword = if ($env:DATABASE_PASSWORD) { $env:DATABASE_PASSWORD } elseif ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "password" }
$dbSSL = if ($env:DATABASE_SSL -eq "true") { "true" } else { "false" }

Write-Host "`nDatabase Configuration:" -ForegroundColor Green
Write-Host "  Host: $dbHost" -ForegroundColor White
Write-Host "  Port: $dbPort" -ForegroundColor White
Write-Host "  Database: $dbName" -ForegroundColor White
Write-Host "  User: $dbUser" -ForegroundColor White
Write-Host "  SSL: $dbSSL" -ForegroundColor White

# Check if it's an Azure host
if ($dbHost -like "*.database.azure.com" -or $dbHost -like "*.postgres.database.azure.com") {
    Write-Host "  Type: Azure PostgreSQL Detected" -ForegroundColor Cyan
}

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
    // Get connection config from environment
    const dbConfig = {
        host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
        database: process.env.DATABASE_NAME || process.env.DB_NAME || 'ticket_assigner',
        user: process.env.DATABASE_USER || process.env.DB_USER || 'user',
        password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'password',
        ssl: (process.env.DATABASE_SSL === 'true' || process.env.DB_SSL === 'true') ? {
            rejectUnauthorized: false // Required for Azure
        } : false
    };

    // Special handling for Azure PostgreSQL
    if (dbConfig.host.includes('.database.azure.com') || dbConfig.host.includes('.postgres.database.azure.com')) {
        console.log('Configuring for Azure PostgreSQL...');
        dbConfig.ssl = {
            rejectUnauthorized: false
        };
        // Azure requires specific connection settings
        dbConfig.connectionTimeoutMillis = 30000;
        dbConfig.query_timeout = 30000;
        dbConfig.keepAlive = true;
        dbConfig.keepAliveInitialDelayMillis = 10000;
    }

    const client = new Client(dbConfig);

    try {
        console.log('Connecting to Azure PostgreSQL database...');
        console.log(`  Host: ${dbConfig.host}`);
        console.log(`  Database: ${dbConfig.database}`);
        console.log(`  User: ${dbConfig.user}`);
        console.log(`  SSL: ${dbConfig.ssl ? 'Enabled' : 'Disabled'}`);
        
        await client.connect();
        console.log('✓ Connected to database successfully!\n');

        // Test the connection
        const testResult = await client.query('SELECT version()');
        console.log('Database version:', testResult.rows[0].version.split(',')[0]);
        console.log('');

        // Check if agents table exists
        const checkAgentsTable = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'agents'
            );
        `);
        
        if (!checkAgentsTable.rows[0].exists) {
            console.error('❌ The agents table does not exist!');
            console.error('Please ensure the main database schema is set up first.');
            process.exit(1);
        }

        // Check existing tables and columns
        const checkTablesQuery = `
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name IN ('skill_detection_config', 'detected_skills', 'skill_audit_logs')
        `;
        
        const tablesCheck = await client.query(checkTablesQuery);
        const existingTables = parseInt(tablesCheck.rows[0].count);
        
        if (existingTables > 0) {
            console.log(`ℹ Some skill detection tables already exist (${existingTables}/3)`);
        }

        const checkColumnsQuery = `
            SELECT COUNT(*) as count
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'agents' 
            AND column_name IN ('category_skills', 'auto_detected_skills', 'skill_metadata', 'last_skill_detection_at')
        `;
        
        const columnsCheck = await client.query(checkColumnsQuery);
        const existingColumns = parseInt(columnsCheck.rows[0].count);
        
        if (existingColumns > 0) {
            console.log(`ℹ Some skill columns already exist in agents table (${existingColumns}/4)`);
        }

        console.log('\nApplying migration...\n');

        // Add columns to agents table
        console.log('Step 1: Adding skill columns to agents table...');
        const alterTableQueries = [
            { 
                name: 'category_skills',
                query: "ALTER TABLE agents ADD COLUMN IF NOT EXISTS category_skills text[]"
            },
            { 
                name: 'auto_detected_skills',
                query: "ALTER TABLE agents ADD COLUMN IF NOT EXISTS auto_detected_skills text[]"
            },
            { 
                name: 'skill_metadata',
                query: "ALTER TABLE agents ADD COLUMN IF NOT EXISTS skill_metadata jsonb"
            },
            { 
                name: 'last_skill_detection_at',
                query: "ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_skill_detection_at timestamp"
            }
        ];

        for (const item of alterTableQueries) {
            try {
                await client.query(item.query);
                console.log(`  ✓ ${item.name} column ready`);
            } catch (err) {
                if (err.code === '42701') { // Column already exists
                    console.log(`  ℹ ${item.name} column already exists`);
                } else {
                    console.log(`  ⚠ Error with ${item.name}: ${err.message}`);
                }
            }
        }

        // Create skill_detection_config table
        console.log('\nStep 2: Creating skill_detection_config table...');
        try {
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
        } catch (err) {
            console.log(`  ⚠ ${err.message}`);
        }

        // Create detected_skills table
        console.log('\nStep 3: Creating detected_skills table...');
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS detected_skills (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
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
        } catch (err) {
            console.log(`  ⚠ ${err.message}`);
        }

        // Create skill_audit_logs table
        console.log('\nStep 4: Creating skill_audit_logs table...');
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS skill_audit_logs (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
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
        } catch (err) {
            console.log(`  ⚠ ${err.message}`);
        }

        // Create indexes
        console.log('\nStep 5: Creating indexes for performance...');
        const indexQueries = [
            { 
                name: 'idx_detected_skills_agent_id',
                query: "CREATE INDEX IF NOT EXISTS idx_detected_skills_agent_id ON detected_skills(agent_id)"
            },
            { 
                name: 'idx_detected_skills_status',
                query: "CREATE INDEX IF NOT EXISTS idx_detected_skills_status ON detected_skills(status)"
            },
            { 
                name: 'idx_skill_audit_logs_agent_id',
                query: "CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_agent_id ON skill_audit_logs(agent_id)"
            },
            { 
                name: 'idx_skill_audit_logs_created_at',
                query: "CREATE INDEX IF NOT EXISTS idx_skill_audit_logs_created_at ON skill_audit_logs(created_at)"
            }
        ];

        for (const item of indexQueries) {
            try {
                await client.query(item.query);
                console.log(`  ✓ ${item.name}`);
            } catch (err) {
                console.log(`  ⚠ ${item.name}: ${err.message}`);
            }
        }

        // Verify the migration
        console.log('\nVerifying migration...');
        
        const verifyTables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('skill_detection_config', 'detected_skills', 'skill_audit_logs')
            ORDER BY table_name
        `);
        
        console.log(`  ✓ Created ${verifyTables.rows.length} tables:`);
        verifyTables.rows.forEach(row => {
            console.log(`    - ${row.table_name}`);
        });

        const verifyColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'agents' 
            AND column_name IN ('category_skills', 'auto_detected_skills', 'skill_metadata', 'last_skill_detection_at')
            ORDER BY column_name
        `);
        
        console.log(`  ✓ Added ${verifyColumns.rows.length} columns to agents table:`);
        verifyColumns.rows.forEach(row => {
            console.log(`    - ${row.column_name}`);
        });

        console.log('\n✅ Migration completed successfully!\n');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n⚠️  Database connection failed. Please ensure:');
            console.error('   1. Your Azure PostgreSQL server is running');
            console.error('   2. Firewall rules allow your IP address');
            console.error('   3. Connection settings in .env are correct');
            console.error('   4. SSL is enabled (DATABASE_SSL=true for Azure)');
        } else if (error.code === '28P01') {
            console.error('\n⚠️  Authentication failed. Please check:');
            console.error('   1. Username and password are correct');
            console.error('   2. User has proper permissions');
        } else if (error.code === 'ENOTFOUND') {
            console.error('\n⚠️  Host not found. Please check:');
            console.error('   1. DATABASE_HOST is correct');
            console.error('   2. Should be: yourserver.postgres.database.azure.com');
        } else if (error.code === '3D000') {
            console.error('\n⚠️  Database does not exist. Please check:');
            console.error('   1. DATABASE_NAME is correct');
            console.error('   2. Database has been created in Azure');
        }
        
        console.error('\nFull error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
'@

# Save the Node.js script
$nodeScriptPath = "temp_migration_azure.js"
Set-Content -Path $nodeScriptPath -Value $nodeScript

Write-Host "`nRunning database migration on Azure PostgreSQL..." -ForegroundColor Yellow
Write-Host "=================================================" -ForegroundColor Gray

# Run the Node.js script
node $nodeScriptPath 2>&1
$exitCode = $LASTEXITCODE

# Clean up temp file
Remove-Item $nodeScriptPath -ErrorAction SilentlyContinue

if ($exitCode -eq 0) {
    Write-Host "`n✅ Database setup complete on Azure!" -ForegroundColor Green
    
    # Now fix the entity file
    Write-Host "`nEnabling skill columns in Agent entity..." -ForegroundColor Yellow
    
    $entityFile = "src/database/entities/agent.entity.ts"
    if (Test-Path $entityFile) {
        $content = Get-Content $entityFile -Raw
        
        # Uncomment the column decorators
        $content = $content -replace '// @Column\(''text''', '@Column(''text'''
        $content = $content -replace '// @Column\({', '@Column({'
        
        Set-Content -Path $entityFile -Value $content -Encoding UTF8
        Write-Host "✓ Agent entity file updated" -ForegroundColor Green
    }
    
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  AZURE SETUP COMPLETE!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "1. Restart the backend: npm run start:dev" -ForegroundColor White
    Write-Host "2. Go to /skills page in the UI" -ForegroundColor White
    Write-Host "3. Click 'Initialize' to set up default configurations" -ForegroundColor White
    Write-Host "4. Click 'Run Detection' to detect skills for all agents" -ForegroundColor White
    
} else {
    Write-Host "`n❌ Setup failed!" -ForegroundColor Red
    Write-Host "`nTroubleshooting for Azure PostgreSQL:" -ForegroundColor Yellow
    Write-Host "1. Check your .env file has correct Azure settings:" -ForegroundColor White
    Write-Host "   DATABASE_HOST=yourserver.postgres.database.azure.com" -ForegroundColor Gray
    Write-Host "   DATABASE_USER=yourusername" -ForegroundColor Gray
    Write-Host "   DATABASE_PASSWORD=yourpassword" -ForegroundColor Gray
    Write-Host "   DATABASE_NAME=ticket_assigner" -ForegroundColor Gray
    Write-Host "   DATABASE_SSL=true" -ForegroundColor Gray
    Write-Host "2. Ensure your IP is whitelisted in Azure firewall rules" -ForegroundColor White
    Write-Host "3. Verify the database exists in Azure Portal" -ForegroundColor White
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")