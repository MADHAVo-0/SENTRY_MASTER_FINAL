const express = require('express');
const router = express.Router();
const { db } = require('../db/setup');
const auth = require('../middleware/auth');
const acfbfService = require('../services/acfbfService');
const path = require('path');

// @route   GET api/acfbf/status
// @desc    Get ACFBF model status
// @access  Private
router.get('/status', auth, async (req, res) => {
    try {
        const status = acfbfService.getStatus();

        // Get some stats from database
        const totalEvents = await db('file_events').count('* as count').first();
        const mlScoredEvents = await db('file_events')
            .whereNotNull('ml_risk_score')
            .count('* as count')
            .first();

        res.json({
            ...status,
            totalEvents: totalEvents.count,
            mlScoredEvents: mlScoredEvents.count,
            coverage: totalEvents.count > 0
                ? ((mlScoredEvents.count / totalEvents.count) * 100).toFixed(1) + '%'
                : '0%'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/acfbf/train
// @desc    Trigger model training
// @access  Private
router.post('/train', auth, async (req, res) => {
    try {
        const { dataSource, nContexts } = req.body;

        let dataPath;
        if (dataSource === 'synthetic') {
            // Use existing synthetic data
            dataPath = path.join(__dirname, '../../../ACFBF/training_data.json');
        } else if (dataSource === 'database') {
            // Export recent events from database to JSON for training
            const events = await db('file_events')
                .orderBy('created_at', 'desc')
                .limit(5000);

            const fs = require('fs');
            dataPath = path.join(__dirname, '../../../ACFBF/db_training_data.json');
            fs.writeFileSync(dataPath, JSON.stringify(events));
        } else {
            return res.status(400).json({ msg: 'Invalid data source' });
        }

        // Start training (async)
        acfbfService.trainModel(dataPath, nContexts || 5)
            .then(result => {
                console.log('Model training completed');
            })
            .catch(error => {
                console.error('Model training failed:', error);
            });

        res.json({
            msg: 'Model training started',
            dataSource,
            nContexts: nContexts || 5
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/acfbf/predictions/:timeRange
// @desc    Get recent ML predictions
// @access  Private
router.get('/predictions/:timeRange', auth, async (req, res) => {
    try {
        const { timeRange } = req.params; // 'hour', 'day', 'week'

        let startDate;
        const now = new Date();

        switch (timeRange) {
            case 'hour':
                startDate = new Date(now.getTime() - 60 * 60 * 1000);
                break;
            case 'day':
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        const predictions = await db('file_events')
            .whereNotNull('ml_risk_score')
            .where('created_at', '>=', startDate.toISOString())
            .select('id', 'event_type', 'file_name', 'file_path',
                'ml_risk_score', 'ml_context', 'mahalanobis_distance',
                'risk_level', 'created_at')
            .orderBy('ml_risk_score', 'desc')
            .limit(100);

        // Get risk level stats
        const riskStats = await db('file_events')
            .whereNotNull('risk_level')
            .where('created_at', '>=', startDate.toISOString())
            .select('risk_level')
            .count('* as count')
            .groupBy('risk_level');

        res.json({
            predictions,
            stats: riskStats,
            timeRange
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/acfbf/feature-importance
// @desc    Get feature importance (mock for now, requires Python integration)
// @access  Private
router.get('/feature-importance', auth, async (req, res) => {
    try {
        // Return stored feature importance or default values
        const featureImportance = {
            'access_rate': 0.15,
            'write_rate': 0.14,
            'delete_rate': 0.13,
            'read_write_ratio': 0.11,
            'sensitive_file_ratio': 0.12,
            'unique_file_ratio': 0.10,
            'access_time_entropy': 0.09,
            'operation_entropy': 0.08,
            'burstiness_index': 0.06,
            'directory_diversity': 0.02
        };

        res.json(featureImportance);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/acfbf/contexts
// @desc    Get behavioral context distribution
// @access  Private
router.get('/contexts', auth, async (req, res) => {
    try {
        const contexts = await db('file_events')
            .whereNotNull('ml_context')
            .select('ml_context')
            .count('* as count')
            .groupBy('ml_context')
            .orderBy('ml_context');

        res.json(contexts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
