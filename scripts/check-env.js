#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Checking environment configuration...\n');

// Check backend .env
const backendEnvPath = path.join(__dirname, '..', 'backend', '.env');
const frontendEnvPath = path.join(__dirname, '..', 'frontend', '.env.local');

const requiredBackendVars = {
  'DATABASE_HOST': 'Database host (usually localhost for development)',
  'DATABASE_PORT': 'Database port (usually 5432)',
  'DATABASE_NAME': 'Database name',
  'DATABASE_USER': 'Database user',
  'DATABASE_PASSWORD': 'Database password',
  'FRESHSERVICE_API_KEY': '⚠️  REQUIRED: Your Freshservice API key',
  'FRESHSERVICE_DOMAIN': '⚠️  REQUIRED: Your Freshservice domain (e.g., company.freshservice.com)',
};

const requiredFrontendVars = {
  'NEXT_PUBLIC_API_URL': 'Backend API URL (usually http://localhost:3001)',
};

function checkEnvFile(filePath, requiredVars, fileName) {
  console.log(`📁 Checking ${fileName}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${fileName} not found!`);
    console.log(`   Create it by copying the example file:`);
    console.log(`   cp ${filePath}.example ${filePath}\n`);
    return false;
  }

  const envContent = fs.readFileSync(filePath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key) {
        envVars[key.trim()] = value ? value.trim() : '';
      }
    }
  });

  let hasIssues = false;
  
  Object.entries(requiredVars).forEach(([key, description]) => {
    if (!envVars[key] || envVars[key] === '' || 
        envVars[key].includes('your-') || 
        envVars[key].includes('skip-for-now')) {
      console.log(`   ⚠️  ${key}: Not configured (${description})`);
      hasIssues = true;
    } else {
      console.log(`   ✅ ${key}: Configured`);
    }
  });

  if (!hasIssues) {
    console.log(`✅ ${fileName} is properly configured!\n`);
  } else {
    console.log(`\n`);
  }

  return !hasIssues;
}

// Check both files
const backendOk = checkEnvFile(backendEnvPath, requiredBackendVars, 'backend/.env');
const frontendOk = checkEnvFile(frontendEnvPath, requiredFrontendVars, 'frontend/.env.local');

if (backendOk && frontendOk) {
  console.log('✅ All environment variables are configured!');
  console.log('\n🚀 You can now run: npm run dev\n');
  process.exit(0);
} else {
  console.log('⚠️  Some environment variables need configuration.');
  console.log('\n📖 See SETUP.md for instructions on obtaining API keys.\n');
  process.exit(1);
}