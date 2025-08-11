# PowerShell script to run database migration for detected_skills table
# This adds the updated_at column needed for proper skill tracking

Write-Host "🔧 Database Migration Script for Ticket Assigner" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from backend/.env file
$envFile = Join-Path $PSScriptRoot "backend\.env"

if (Test-Path $envFile) {
    Write-Host "📁 Loading database configuration from backend/.env..." -ForegroundColor Yellow
    
    # Read .env file and extract database variables
    $envContent = Get-Content $envFile
    $dbConfig = @{}
    
    foreach ($line in $envContent) {
        if ($line -match "^([^#][^=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove quotes if present
            $value = $value -replace '^["'']|["'']$', ''
            $dbConfig[$key] = $value
        }
    }
    
    $DB_HOST = $dbConfig["DATABASE_HOST"]
    $DB_PORT = $dbConfig["DATABASE_PORT"] 
    $DB_NAME = $dbConfig["DATABASE_NAME"]
    $DB_USER = $dbConfig["DATABASE_USER"]
    $DB_PASSWORD = $dbConfig["DATABASE_PASSWORD"]
    $DB_SSL = $dbConfig["DATABASE_SSL"]
    
    Write-Host "✅ Configuration loaded" -ForegroundColor Green
    Write-Host "   Server: $DB_HOST" -ForegroundColor Gray
    Write-Host "   Database: $DB_NAME" -ForegroundColor Gray
    Write-Host "   User: $DB_USER" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "❌ Error: backend/.env file not found!" -ForegroundColor Red
    Write-Host "Please ensure you're running this script from the project root directory." -ForegroundColor Yellow
    exit 1
}

# Create the SQL migration commands
$migrationSQL = @"
-- Add updated_at column to detected_skills table
DO `$`$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'detected_skills' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE detected_skills 
        ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        
        -- Set initial value for existing rows
        UPDATE detected_skills 
        SET updated_at = COALESCE(detected_at, CURRENT_TIMESTAMP)
        WHERE updated_at IS NULL;
        
        RAISE NOTICE 'Column updated_at added successfully';
    ELSE
        RAISE NOTICE 'Column updated_at already exists';
    END IF;
END`$`$;

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS `$`$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
`$`$ language 'plpgsql';

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS update_detected_skills_updated_at ON detected_skills;

CREATE TRIGGER update_detected_skills_updated_at 
BEFORE UPDATE ON detected_skills 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'detected_skills' 
AND column_name IN ('detected_at', 'updated_at')
ORDER BY ordinal_position;
"@

# Save SQL to temporary file
$tempSQLFile = Join-Path $env:TEMP "ticket-assigner-migration-$(Get-Date -Format 'yyyyMMddHHmmss').sql"
$migrationSQL | Out-File -FilePath $tempSQLFile -Encoding UTF8

Write-Host "🚀 Running migration..." -ForegroundColor Yellow
Write-Host ""

# Set PGPASSWORD environment variable for non-interactive authentication
$env:PGPASSWORD = $DB_PASSWORD

# Build psql command
$psqlArgs = @(
    "-h", $DB_HOST,
    "-p", $DB_PORT,
    "-U", $DB_USER,
    "-d", $DB_NAME,
    "-f", $tempSQLFile,
    "-v", "ON_ERROR_STOP=1"
)

# Add SSL mode if required
if ($DB_SSL -eq "true" -or $DB_SSL -eq "require") {
    $psqlArgs += @("--set", "sslmode=require")
}

# Check if psql is available
$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlCommand) {
    Write-Host "❌ Error: psql command not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL client tools:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Cyan
    Write-Host "2. Or install via Chocolatey: choco install postgresql" -ForegroundColor Cyan
    Write-Host "3. Or install via winget: winget install PostgreSQL.PostgreSQL" -ForegroundColor Cyan
    
    # Clean up temp file
    Remove-Item $tempSQLFile -Force
    exit 1
}

try {
    # Run the migration
    $output = & psql @psqlArgs 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Migration output:" -ForegroundColor Cyan
        Write-Host $output
        Write-Host ""
        Write-Host "📝 Next steps:" -ForegroundColor Yellow
        Write-Host "1. Restart the backend server to apply changes" -ForegroundColor White
        Write-Host "2. Test skill detection and approval features" -ForegroundColor White
        Write-Host "3. Check that pending skills now appear correctly" -ForegroundColor White
    } else {
        Write-Host "❌ Migration failed!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Error output:" -ForegroundColor Red
        Write-Host $output
        Write-Host ""
        Write-Host "Please check your database connection and try again." -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error running migration: $_" -ForegroundColor Red
} finally {
    # Clean up
    Remove-Item $tempSQLFile -Force -ErrorAction SilentlyContinue
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Migration script completed" -ForegroundColor Cyan