# PowerShell script to run database migration for Azure PostgreSQL
# Uses .NET Npgsql library - no psql installation required

Write-Host "🔧 Azure PostgreSQL Migration Script for Ticket Assigner" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
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
    $DB_PORT = if ($dbConfig["DATABASE_PORT"]) { $dbConfig["DATABASE_PORT"] } else { "5432" }
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

# Download Npgsql if not present
$npgsqlPath = Join-Path $PSScriptRoot "npgsql.dll"
$npgsqlVersion = "8.0.3"

if (-not (Test-Path $npgsqlPath)) {
    Write-Host "📦 Downloading Npgsql library..." -ForegroundColor Yellow
    
    try {
        # Create temp directory for NuGet package
        $tempDir = Join-Path $env:TEMP "npgsql-temp-$(Get-Date -Format 'yyyyMMddHHmmss')"
        New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
        
        # Download NuGet package
        $nugetUrl = "https://www.nuget.org/api/v2/package/Npgsql/$npgsqlVersion"
        $packagePath = Join-Path $tempDir "npgsql.zip"
        
        Invoke-WebRequest -Uri $nugetUrl -OutFile $packagePath
        
        # Extract the package
        Expand-Archive -Path $packagePath -DestinationPath $tempDir -Force
        
        # Find and copy the appropriate DLL
        $dllPath = Get-ChildItem -Path $tempDir -Recurse -Filter "Npgsql.dll" | 
                   Where-Object { $_.DirectoryName -like "*net6.0*" -or $_.DirectoryName -like "*netstandard2.1*" } | 
                   Select-Object -First 1
        
        if ($dllPath) {
            Copy-Item $dllPath.FullName -Destination $npgsqlPath
            Write-Host "✅ Npgsql library downloaded successfully" -ForegroundColor Green
        } else {
            throw "Could not find Npgsql.dll in package"
        }
        
        # Clean up
        Remove-Item -Path $tempDir -Recurse -Force
    } catch {
        Write-Host "❌ Failed to download Npgsql: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Run this Node.js migration instead:" -ForegroundColor Yellow
        Write-Host "cd backend && npm run migration:run" -ForegroundColor Cyan
        exit 1
    }
}

# Load Npgsql assembly
try {
    Add-Type -Path $npgsqlPath
    Write-Host "✅ Npgsql library loaded" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Could not load Npgsql, trying alternative method..." -ForegroundColor Yellow
    
    # Try using the installed Npgsql from the backend node_modules
    $nodeNpgsql = Join-Path $PSScriptRoot "backend\node_modules\pg\lib"
    if (Test-Path $nodeNpgsql) {
        Write-Host "Using Node.js pg library instead..." -ForegroundColor Yellow
    } else {
        Write-Host "❌ Could not load database library" -ForegroundColor Red
        exit 1
    }
}

# Build connection string
$sslMode = if ($DB_SSL -eq "true" -or $DB_SSL -eq "require") { "Require" } else { "Prefer" }
$connectionString = "Host=$DB_HOST;Port=$DB_PORT;Database=$DB_NAME;Username=$DB_USER;Password=$DB_PASSWORD;SSL Mode=$sslMode;Trust Server Certificate=true"

Write-Host ""
Write-Host "🚀 Connecting to Azure PostgreSQL..." -ForegroundColor Yellow

try {
    # Create connection
    $connection = New-Object Npgsql.NpgsqlConnection($connectionString)
    $connection.Open()
    
    Write-Host "✅ Connected successfully" -ForegroundColor Green
    Write-Host ""
    
    # Create the migration commands
    $migrationCommands = @(
        @{
            Description = "Checking if updated_at column exists..."
            Query = @"
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'detected_skills' 
AND column_name = 'updated_at'
"@
        },
        @{
            Description = "Adding updated_at column..."
            Query = @"
ALTER TABLE detected_skills 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
"@
        },
        @{
            Description = "Setting initial values for existing rows..."
            Query = @"
UPDATE detected_skills 
SET updated_at = COALESCE(detected_at, CURRENT_TIMESTAMP)
WHERE updated_at IS NULL
"@
        },
        @{
            Description = "Creating trigger function..."
            Query = @"
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS `$`$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
`$`$ language 'plpgsql'
"@
        },
        @{
            Description = "Dropping old trigger if exists..."
            Query = "DROP TRIGGER IF EXISTS update_detected_skills_updated_at ON detected_skills"
        },
        @{
            Description = "Creating new trigger..."
            Query = @"
CREATE TRIGGER update_detected_skills_updated_at 
BEFORE UPDATE ON detected_skills 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column()
"@
        }
    )
    
    # Execute migration commands
    foreach ($cmdInfo in $migrationCommands) {
        Write-Host $cmdInfo.Description -ForegroundColor Cyan
        
        try {
            $command = New-Object Npgsql.NpgsqlCommand($cmdInfo.Query, $connection)
            $result = $command.ExecuteNonQuery()
            Write-Host "   ✅ Done" -ForegroundColor Green
        } catch {
            if ($_.Exception.Message -like "*already exists*") {
                Write-Host "   ℹ️ Already exists, skipping" -ForegroundColor Yellow
            } else {
                Write-Host "   ⚠️ Warning: $_" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host ""
    Write-Host "🔍 Verifying migration..." -ForegroundColor Yellow
    
    # Verify the migration
    $verifyQuery = @"
SELECT 
    column_name, 
    data_type, 
    column_default 
FROM information_schema.columns 
WHERE table_name = 'detected_skills' 
AND column_name IN ('detected_at', 'updated_at')
ORDER BY ordinal_position
"@
    
    $verifyCommand = New-Object Npgsql.NpgsqlCommand($verifyQuery, $connection)
    $reader = $verifyCommand.ExecuteReader()
    
    Write-Host ""
    Write-Host "Columns in detected_skills table:" -ForegroundColor Cyan
    while ($reader.Read()) {
        $colName = $reader["column_name"]
        $dataType = $reader["data_type"]
        $default = if ($reader["column_default"]) { $reader["column_default"] } else { "NULL" }
        Write-Host "   • $colName ($dataType) - Default: $default" -ForegroundColor White
    }
    $reader.Close()
    
    # Close connection
    $connection.Close()
    
    Write-Host ""
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Restart the backend server: cd backend && npm run start:dev" -ForegroundColor White
    Write-Host "2. Test skill detection on the Agents page" -ForegroundColor White
    Write-Host "3. Verify pending skills appear in the Skills page" -ForegroundColor White
    Write-Host "4. Test approve/reject functionality" -ForegroundColor White
    
} catch {
    Write-Host "❌ Migration failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.InnerException) {
        Write-Host "Inner exception: $($_.Exception.InnerException.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "1. Check your database credentials in backend/.env" -ForegroundColor White
    Write-Host "2. Ensure your IP is whitelisted in Azure PostgreSQL firewall rules" -ForegroundColor White
    Write-Host "3. Verify the database name and server address" -ForegroundColor White
    Write-Host "4. Make sure SSL is properly configured (DATABASE_SSL=true in .env)" -ForegroundColor White
    
    exit 1
} finally {
    if ($connection -and $connection.State -eq 'Open') {
        $connection.Close()
    }
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Migration script completed" -ForegroundColor Cyan