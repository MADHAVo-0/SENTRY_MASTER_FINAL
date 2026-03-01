/**
 * ACFBF (Anomaly Detection) Service
 * 
 * Interfaces with Python ACFBF model for ML-based risk scoring
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ACFBFService {
    constructor() {
        this.modelPath = path.join(__dirname, '../../../ACFBF/trained_model.pkl');
        this.pythonScript = path.join(__dirname, '../../../ACFBF/model_manager.py');
        this.isModelReady = fs.existsSync(this.modelPath);
        this.predictionCache = new Map();
        this.cacheTTL = 60000; // 1 minute cache

        if (!this.isModelReady) {
            console.warn('⚠️  ACFBF model not found. ML predictions will be unavailable.');
            console.warn(`   Expected model at: ${this.modelPath}`);
            console.warn('   Run: npm run train-model');
        } else {
            console.log('✓ ACFBF model ready');
        }
    }

    /**
     * Get ML-based risk prediction for recent file events
     * @param {Array} events - Array of event objects
     * @returns {Promise<Object>} Prediction results
     */
    async predictRisk(events) {
        if (!this.isModelReady) {
            return this._getFallbackPrediction();
        }

        if (!events || events.length === 0) {
            return this._getFallbackPrediction();
        }

        // Check cache
        const cacheKey = this._getCacheKey(events);
        const cached = this.predictionCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.result;
        }

        try {
            const result = await this._runPythonPrediction(events);

            // Cache result
            this.predictionCache.set(cacheKey, {
                result,
                timestamp: Date.now()
            });

            // Clean old cache entries
            this._cleanCache();

            return result;
        } catch (error) {
            console.error('ACFBF prediction error:', error.message);
            return this._getFallbackPrediction();
        }
    }

    /**
     * Run Python prediction script
     * @private
     */
    async _runPythonPrediction(events) {
        return new Promise((resolve, reject) => {
            // Create temporary JSON file with events
            const tempFile = path.join(__dirname, `../../../ACFBF/temp_events_${Date.now()}.json`);
            fs.writeFileSync(tempFile, JSON.stringify(events));

            const python = spawn('python', [
                this.pythonScript,
                'predict',
                '--data', tempFile,
                '--model', this.modelPath
            ]);

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {
                    // Ignore cleanup errors
                }

                if (code !== 0) {
                    reject(new Error(`Python exited with code ${code}: ${stderr}`));
                    return;
                }

                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`Failed to parse Python output: ${error.message}`));
                }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                python.kill();
                reject(new Error('Python prediction timeout'));
            }, 10000);
        });
    }

    /**
     * Train or retrain the ACFBF model
     * @param {String} dataPath - Path to training data JSON
     * @param {Number} nContexts - Number of behavioral contexts
     * @returns {Promise<Object>} Training results
     */
    async trainModel(dataPath, nContexts = 5) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', [
                this.pythonScript,
                'train',
                '--data', dataPath,
                '--contexts', nContexts.toString(),
                '--output', this.modelPath
            ]);

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                console.log('[ACFBF Training]', output.trim());
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Training failed with code ${code}: ${stderr}`));
                    return;
                }

                this.isModelReady = fs.existsSync(this.modelPath);
                resolve({ success: true, output: stdout });
            });

            // Training can take longer
            setTimeout(() => {
                python.kill();
                reject(new Error('Training timeout'));
            }, 300000); // 5 minutes
        });
    }

    /**
     * Evaluate model performance
     * @param {String} testDataPath - Path to test data JSON
     * @returns {Promise<Object>} Evaluation results
     */
    async evaluateModel(testDataPath) {
        return new Promise((resolve, reject) => {
            const python = spawn('python', [
                this.pythonScript,
                'evaluate',
                '--data', testDataPath,
                '--model', this.modelPath
            ]);

            let stdout = '';
            let stderr = '';

            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            python.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Evaluation failed: ${stderr}`));
                    return;
                }

                resolve({ output: stdout });
            });
        });
    }

    /**
     * Get fallback prediction when ML model is unavailable
     * @private
     */
    _getFallbackPrediction() {
        return {
            features: {},
            context: 0,
            mahalanobis_distance: 0,
            risk_score: 0,
            is_anomaly: false,
            risk_level: 'low',
            timestamp: new Date().toISOString(),
            fallback: true
        };
    }

    /**
     * Generate cache key from events
     * @private
     */
    _getCacheKey(events) {
        // Use a hash of event IDs/types/paths
        const signature = events
            .slice(0, 10) // Only use first 10 events for key
            .map(e => `${e.event_type}:${e.file_path}`)
            .join('|');
        return signature;
    }

    /**
     * Clean expired cache entries
     * @private
     */
    _cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.predictionCache.entries()) {
            if (now - value.timestamp > this.cacheTTL) {
                this.predictionCache.delete(key);
            }
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            modelReady: this.isModelReady,
            modelPath: this.modelPath,
            cacheSize: this.predictionCache.size
        };
    }
}

// Singleton instance
const acfbfService = new ACFBFService();

module.exports = acfbfService;
