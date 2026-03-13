const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const os = require('os');
const { db } = require('../db/setup');
const { calculateRiskScore } = require('./riskAnalyzer');
const acfbfService = require('./acfbfService');

// Get default monitoring paths if not specified
const getDefaultPaths = () => {
  const userHome = os.homedir();
  const paths = [
    path.join(userHome, 'Documents'),
    path.join(userHome, 'Downloads'),
    path.join(userHome, 'Desktop')
  ];

  // Add OneDrive versions if they exist
  const oneDrivePath = path.join(userHome, 'OneDrive');
  if (fs.existsSync(oneDrivePath)) {
    paths.push(path.join(oneDrivePath, 'Documents'));
    paths.push(path.join(oneDrivePath, 'Downloads'));
    paths.push(path.join(oneDrivePath, 'Desktop'));
  }

  // Filter out non-existent paths to avoid chokidar warnings
  const finalPaths = paths.filter(p => fs.existsSync(p));

  // Add a dedicated project-local test monitor path
  const projectTestPath = path.resolve(__dirname, '../../../ACFBF/test_monitor');
  if (!fs.existsSync(projectTestPath)) fs.mkdirSync(projectTestPath, { recursive: true });
  finalPaths.push(projectTestPath);

  return finalPaths;
};

// Setup file monitoring with chokidar
const setupFileMonitoring = (io) => {
  // Get paths to monitor from environment or use defaults
  const monitoringPaths = process.env.MONITORING_PATHS
    ? process.env.MONITORING_PATHS.split(',')
    : getDefaultPaths();

  console.log(`Monitoring paths: ${monitoringPaths.join(', ')}`);

  // Initialize watcher
  const watcher = chokidar.watch(monitoringPaths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    },
    ignored: [
      /(^|[\/\\])\../, // Ignore dot files
      '**/node_modules/**',
      '**/.git/**'
    ]
  });

  // Event buffer for ML predictions
  let eventBuffer = [];
  const BUFFER_SIZE = 50; // Analyze every 50 events
  const BUFFER_TIME = 60000; // Or every 60 seconds

  // Periodic ML analysis
  setInterval(async () => {
    if (eventBuffer.length > 0) {
      await processEventBuffer(eventBuffer);
      eventBuffer = [];
    }
  }, BUFFER_TIME);

  // Process buffered events with ML
  const processEventBuffer = async (events) => {
    try {
      const mlPrediction = await acfbfService.predictRisk(events);

      // Update recent events with ML prediction
      if (!mlPrediction.fallback && events.length > 0) {
        const recentEventIds = events.slice(-10).map(e => e.id).filter(id => id);

        if (recentEventIds.length > 0) {
          await db('file_events')
            .whereIn('id', recentEventIds)
            .update({
              ml_risk_score: mlPrediction.risk_score,
              ml_context: mlPrediction.context,
              mahalanobis_distance: mlPrediction.mahalanobis_distance,
              risk_level: mlPrediction.risk_level
            });

          // Emit ML update to clients
          io.emit('ml_update', {
            event_ids: recentEventIds,
            ml_prediction: mlPrediction
          });
        }
      }
    } catch (error) {
      console.error('Error processing event buffer with ML:', error.message);
    }
  };

  // File event handlers
  const handleFileEvent = async (eventType, filePath) => {
    try {
      const fileName = path.basename(filePath);
      const fileExt = path.extname(filePath).slice(1);
      const isExternalDrive = filePath.startsWith('/media/') ||
        filePath.match(/^[A-Z]:\\/) && !filePath.startsWith('C:\\');

      // Calculate risk score based on file and event type
      const riskScore = calculateRiskScore({
        eventType,
        filePath,
        fileName,
        fileExt,
        isExternalDrive
      });

      // Create file event record
      const [eventId] = await db('file_events').insert({
        event_type: eventType,
        file_path: filePath,
        file_name: fileName,
        file_extension: fileExt,
        is_external_drive: isExternalDrive ? 1 : 0,
        risk_score: riskScore,
        user_id: os.userInfo().username,
        process_name: 'system'
      });

      // Add to event buffer for ML analysis
      eventBuffer.push({
        id: eventId,
        event_type: eventType,
        file_path: filePath,
        file_name: fileName,
        file_extension: fileExt,
        created_at: new Date().toISOString()
      });

      // Process buffer if full
      if (eventBuffer.length >= BUFFER_SIZE) {
        await processEventBuffer(eventBuffer);
        eventBuffer = [];
      }

      // Emit event to connected clients
      const eventData = {
        id: eventId,
        event_type: eventType,
        file_path: filePath,
        file_name: fileName,
        risk_score: riskScore,
        timestamp: new Date().toISOString()
      };

      io.emit('file_event', eventData);

      // Generate alert if risk score is high
      if (riskScore > 70) {
        const alertData = {
          alert_type: 'high_risk_activity',
          description: `High risk ${eventType} activity detected on file: ${fileName}`,
          severity: Math.ceil(riskScore / 20), // Convert to 1-5 scale
          risk_score: riskScore,
          file_event_id: eventId
        };

        await db('risk_alerts').insert(alertData);
        io.emit('risk_alert', alertData);
      }

      console.log(`[${eventType}] ${filePath} (Risk: ${riskScore})`);
    } catch (error) {
      console.error(`Error processing ${eventType} event:`, error);
    }
  };

  // Setup event listeners
  watcher
    .on('add', (filePath) => handleFileEvent('create', filePath))
    .on('change', (filePath) => handleFileEvent('modify', filePath))
    .on('unlink', (filePath) => handleFileEvent('delete', filePath))
    .on('addDir', (dirPath) => handleFileEvent('create_dir', dirPath))
    .on('unlinkDir', (dirPath) => handleFileEvent('delete_dir', dirPath))
    .on('error', (error) => console.error(`Watcher error: ${error}`));

  return watcher;
};

module.exports = { setupFileMonitoring };
