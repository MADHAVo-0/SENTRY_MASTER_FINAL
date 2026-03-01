const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database connection
const db = knex({
  client: 'sqlite3',
  connection: {
    filename: process.env.DB_PATH || path.join(dataDir, 'sentry.db')
  },
  useNullAsDefault: true
});

// Setup database schema
const setupDatabase = async () => {
  try {
    // Create users table
    await db.schema.hasTable('users').then(exists => {
      if (!exists) {
        return db.schema.createTable('users', table => {
          table.increments('id').primary();
          table.string('username').notNullable().unique();
          table.string('email').notNullable().unique();
          table.string('password').notNullable();
          table.string('role').defaultTo('user');
          table.timestamp('created_at').defaultTo(db.fn.now());
          table.timestamp('updated_at').defaultTo(db.fn.now());
        });
      }
    });

    // Create file_events table
    await db.schema.hasTable('file_events').then(exists => {
      if (!exists) {
        return db.schema.createTable('file_events', table => {
          table.increments('id').primary();
          table.string('event_type').notNullable(); // create, modify, delete, access, etc.
          table.string('file_path').notNullable();
          table.string('file_name').notNullable();
          table.string('file_extension');
          table.integer('file_size');
          table.string('user_id');
          table.string('process_name');
          table.string('source_ip');
          table.boolean('is_external_drive').defaultTo(false);
          table.integer('risk_score').defaultTo(0);
          // ML/ACFBF specific columns
          table.float('ml_risk_score');
          table.integer('ml_context');
          table.float('mahalanobis_distance');
          table.string('risk_level'); // low, medium, high, critical
          table.timestamp('created_at').defaultTo(db.fn.now());
        });
      }
    });

    // Add ML columns to existing file_events table if they don't exist
    await db.schema.hasTable('file_events').then(async exists => {
      if (exists) {
        const hasColumn = await db.schema.hasColumn('file_events', 'ml_risk_score');
        if (!hasColumn) {
          await db.schema.table('file_events', table => {
            table.float('ml_risk_score');
            table.integer('ml_context');
            table.float('mahalanobis_distance');
            table.string('risk_level');
          });
          console.log('Added ML columns to file_events table');
        }
      }
    });

    // Create risk_alerts table
    await db.schema.hasTable('risk_alerts').then(exists => {
      if (!exists) {
        return db.schema.createTable('risk_alerts', table => {
          table.increments('id').primary();
          table.string('alert_type').notNullable();
          table.string('description').notNullable();
          table.integer('severity').notNullable(); // 1-5 scale
          table.integer('risk_score').notNullable();
          table.integer('file_event_id').references('id').inTable('file_events');
          table.boolean('resolved').defaultTo(false);
          table.timestamp('created_at').defaultTo(db.fn.now());
          table.timestamp('updated_at').defaultTo(db.fn.now());
        });
      }
    });

    // Create external_domains table
    await db.schema.hasTable('external_domains').then(exists => {
      if (!exists) {
        return db.schema.createTable('external_domains', table => {
          table.increments('id').primary();
          table.string('domain').notNullable().unique();
          table.string('status').defaultTo('unknown'); // allowed, blocked, unknown
          table.integer('trust_score').defaultTo(50);
          table.timestamp('created_at').defaultTo(db.fn.now());
          table.timestamp('updated_at').defaultTo(db.fn.now());
        });
      }
    });

    // Create settings table
    await db.schema.hasTable('settings').then(exists => {
      if (!exists) {
        return db.schema.createTable('settings', table => {
          table.increments('id').primary();
          table.string('key').notNullable().unique();
          table.string('value').notNullable();
          table.string('description');
          table.timestamp('updated_at').defaultTo(db.fn.now());
        });
      }
    });

    // Create otp_requests table for OTP-based authentication
    await db.schema.hasTable('otp_requests').then(exists => {
      if (!exists) {
        return db.schema.createTable('otp_requests', table => {
          table.increments('id').primary();
          table.integer('user_id').notNullable().references('id').inTable('users');
          table.string('code_hash').notNullable();
          table.timestamp('expires_at').notNullable();
          table.boolean('verified').defaultTo(false);
          table.integer('attempts').defaultTo(0);
          table.timestamp('created_at').defaultTo(db.fn.now());
        });
      }
    });

    // Create file_tracks table
    await db.schema.hasTable('file_tracks').then(exists => {
      if (!exists) {
        return db.schema.createTable('file_tracks', table => {
          table.increments('id').primary();
          table.string('filename').notNullable();
          table.string('originalname').notNullable();
          table.string('mimetype').notNullable();
          table.integer('size').notNullable();
          table.string('path').notNullable();
          table.integer('user_id').notNullable();
          table.timestamp('upload_date').defaultTo(db.fn.now());
          table.string('status').defaultTo('active');
          table.string('risk_level').defaultTo('low');
          table.foreign('user_id').references('id').inTable('users');
        });
      }
    });

    console.log('Database setup completed');
  } catch (error) {
    console.error('Database setup error:', error);
  }
};

module.exports = { db, setupDatabase };