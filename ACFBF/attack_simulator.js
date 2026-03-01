const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * ACFBF Attack Simulation Script
 * 
 * This script simulates two types of attacks:
 * 1. Ransomware (Rapid file creation/modification/deletion)
 * 2. Data Exfiltration (Accessing sensitive files and "moving" them to external drive)
 */

const TARGET_DIR = path.resolve(__dirname, 'test_monitor');

// Ensure target directory exists
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function simulateRansomware() {
    console.log('🚀 Starting Ransomware Simulation...');

    // 1. Create 50 files rapidly
    console.log('--- Phase 1: Rapid File Creation ---');
    for (let i = 0; i < 50; i++) {
        const filePath = path.join(TARGET_DIR, `important_doc_${i}.docx`);
        fs.writeFileSync(filePath, 'Sensitive commercial data content...');
        console.log(`Created: ${filePath}`);
        await sleep(100); // Very fast
    }

    // 2. Modify them rapidly (simulating encryption)
    console.log('--- Phase 2: Rapid File Encryption (Modification) ---');
    for (let i = 0; i < 50; i++) {
        const filePath = path.join(TARGET_DIR, `important_doc_${i}.docx`);
        fs.appendFileSync(filePath, '\nENCRYPTED_WITH_RSA_4096_NONCE_XF293...');
        console.log(`Encrypted: ${filePath}`);
        await sleep(50);
    }

    // 3. Mass deletion
    console.log('--- Phase 3: Mass Deletion ---');
    for (let i = 0; i < 50; i++) {
        const filePath = path.join(TARGET_DIR, `important_doc_${i}.docx`);
        fs.unlinkSync(filePath);
        console.log(`Deleted: ${filePath}`);
        await sleep(20);
    }

    console.log('✅ Ransomware Simulation Complete.');
}

async function simulateExfiltration() {
    console.log('🚀 Starting Data Exfiltration Simulation...');

    const sensitiveFiles = [
        'passwords.txt',
        'config.env',
        'database_backup.sql',
        'private_key.pem',
        'customer_list.csv'
    ];

    // 1. Access sensitive files
    console.log('--- Phase 1: Accessing Sensitive Files ---');
    for (const file of sensitiveFiles) {
        const filePath = path.join(TARGET_DIR, file);
        fs.writeFileSync(filePath, 'HIGHLY SENSITIVE DATA CONTENT');
        // Read the file to register access event
        fs.readFileSync(filePath);
        console.log(`Accessed: ${filePath}`);
        await sleep(1000);
    }

    // 2. "Move" to external drive (simulated by path name)
    console.log('--- Phase 2: Exfiltrating to Simulated External Drive ---');
    const externalDir = path.join(TARGET_DIR, 'Exfiltrated_Data');
    if (!fs.existsSync(externalDir)) fs.mkdirSync(externalDir);

    for (const file of sensitiveFiles) {
        const sourcePath = path.join(TARGET_DIR, file);
        const destPath = path.join(externalDir, file);
        fs.renameSync(sourcePath, destPath);
        console.log(`Exfiltrated: ${file} -> ${destPath}`);
        await sleep(500);
    }

    console.log('✅ Data Exfiltration Simulation Complete.');
}

async function run() {
    console.log('================================================');
    console.log('   ACFBF REAL-TIME ATTACK SIMULATOR');
    console.log('================================================');
    console.log(`Targeting directory: ${TARGET_DIR}`);
    console.log('Waiting 5 seconds for user to prepare...');
    await sleep(5000);

    await simulateRansomware();

    console.log('\nWait 10 seconds before next attack...');
    await sleep(10000);

    await simulateExfiltration();

    console.log('\n================================================');
    console.log('   SIMULATION FINISHED');
    console.log('   Check Sentry Tracker UI for ML scores!');
    console.log('================================================');
}

run().catch(console.error);
