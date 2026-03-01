const knex = require('knex');
const path = require('path');

async function checkDatabase() {
    console.log('--- ACFBF Database Verification ---');

    const dbPath = path.resolve(__dirname, '../data/sentry.db');
    console.log(`Checking database at: ${dbPath}`);

    const db = knex({
        client: 'sqlite3',
        connection: {
            filename: dbPath
        },
        useNullAsDefault: true
    });

    try {
        const totalEvents = await db('file_events').count('id as count').first();
        console.log(`Total events in DB: ${totalEvents.count}`);

        const mlEvents = await db('file_events')
            .whereNotNull('ml_risk_score')
            .orderBy('id', 'desc')
            .limit(10);

        console.log(`Events with ML scores: ${mlEvents.length}`);

        if (mlEvents.length > 0) {
            console.log('\nRecent ML-Scored Events:');
            mlEvents.forEach(row => {
                console.log(`[ID: ${row.id}] ${row.event_type} | ${row.file_name}`);
                console.log(`  -> ML Risk Score: ${row.ml_risk_score.toFixed(4)}`);
                console.log(`  -> Context: ${row.ml_context}`);
                console.log(`  -> Risk Level: ${row.risk_level}`);
                console.log(`  -> Mahalanobis: ${row.mahalanobis_distance.toFixed(4)}`);
                console.log('-------------------');
            });
        } else {
            console.log('\n⚠️ No ML scores found yet. Keep in mind there is a 50-event / 60-second buffer.');
        }

    } catch (err) {
        console.error('Error during DB check:', err.message);
    } finally {
        await db.destroy();
    }
}

checkDatabase();
