import React, { useState, useEffect } from 'react';
import {
    Box, Grid, Paper, Typography, Card, CardContent, Button, CircularProgress, Chip, LinearProgress
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
    ...theme.typography.body2,
    padding: theme.spacing(2),
    color: theme.palette.text.primary,
}));

const MLInsights = () => {
    const [status, setStatus] = useState(null);
    const [predictions, setPredictions] = useState([]);
    const [featureImportance, setFeatureImportance] = useState({});
    const [contexts, setContexts] = useState([]);
    const [training, setTraining] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        try {
            setLoading(true);

            const [statusRes, predictionsRes, featureRes, contextsRes] = await Promise.all([
                axios.get('/api/acfbf/status'),
                axios.get('/api/acfbf/predictions/day'),
                axios.get('/api/acfbf/feature-importance'),
                axios.get('/api/acfbf/contexts')
            ]);

            setStatus(statusRes.data);
            setPredictions(predictionsRes.data.predictions || []);
            setFeatureImportance(featureRes.data);
            setContexts(contextsRes.data);
        } catch (error) {
            console.error('Error fetching ML data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTrainModel = async () => {
        try {
            setTraining(true);
            await axios.post('/api/acfbf/train', {
                dataSource: 'synthetic',
                nContexts: 5
            });
            alert('Model training started! This may take a few minutes.');
            // Refresh status after 5 seconds
            setTimeout(fetchAllData, 5000);
        } catch (error) {
            console.error('Error training model:', error);
            alert('Failed to start model training');
        } finally {
            setTraining(false);
        }
    };

    // Prepare feature importance chart
    const featureChartData = {
        labels: Object.keys(featureImportance).map(key =>
            key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        ),
        datasets: [{
            label: 'Feature Importance',
            data: Object.values(featureImportance),
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
        }]
    };

    const getRiskLevelColor = (level) => {
        switch (level) {
            case 'critical': return 'error';
            case 'high': return 'warning';
            case 'medium': return 'info';
            case 'low': return 'success';
            default: return 'default';
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ flexGrow: 1 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                <Box display="flex" alignItems="center">
                    <SmartToyIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                    <Typography variant="h4">
                        ML Anomaly Detection
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleTrainModel}
                    disabled={training}
                >
                    {training ? 'Training...' : 'Retrain Model'}
                </Button>
            </Box>

            {/* Model Status */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Model Status
                            </Typography>
                            <Box display="flex" alignItems="center" mt={1}>
                                {status?.modelReady ? (
                                    <>
                                        <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                                        <Typography variant="h6" color="success.main">Ready</Typography>
                                    </>
                                ) : (
                                    <>
                                        <ErrorIcon color="error" sx={{ mr: 1 }} />
                                        <Typography variant="h6" color="error.main">Not Trained</Typography>
                                    </>
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Total Events
                            </Typography>
                            <Typography variant="h5">
                                {status?.totalEvents || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                ML Scored Events
                            </Typography>
                            <Typography variant="h5">
                                {status?.mlScoredEvents || 0}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>

                <Grid item xs={12} md={3}>
                    <Card>
                        <CardContent>
                            <Typography color="textSecondary" gutterBottom>
                                Coverage
                            </Typography>
                            <Typography variant="h5">
                                {status?.coverage || '0%'}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Feature Importance Chart */}
            <Grid container spacing={3}>
                <Grid item xs={12} md={7}>
                    <Item>
                        <Typography variant="h6" gutterBottom>
                            Feature Importance Analysis
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            Shows which behavioral features contribute most to anomaly detection
                        </Typography>
                        <Box sx={{ height: 350 }}>
                            <Bar
                                data={featureChartData}
                                options={{
                                    indexAxis: 'y',
                                    maintainAspectRatio: false,
                                    scales: {
                                        x: { beginAtZero: true, max: 0.2 }
                                    },
                                    plugins: {
                                        legend: { display: false }
                                    }
                                }}
                            />
                        </Box>
                    </Item>
                </Grid>

                <Grid item xs={12} md={5}>
                    <Item>
                        <Typography variant="h6" gutterBottom>
                            Behavioral Contexts
                        </Typography>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            Distinct behavioral patterns identified by K-means clustering
                        </Typography>
                        {contexts.map((ctx, idx) => (
                            <Box key={idx} sx={{ mb: 2 }}>
                                <Box display="flex" justifyContent="space-between" mb={0.5}>
                                    <Typography variant="body2">
                                        Context {ctx.ml_context}
                                    </Typography>
                                    <Typography variant="body2">
                                        {ctx.count} events
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={Math.min((ctx.count / status?.mlScoredEvents) * 100, 100)}
                                    sx={{ height: 8, borderRadius: 4 }}
                                />
                            </Box>
                        ))}
                        {contexts.length === 0 && (
                            <Typography color="textSecondary" align="center">
                                No context data available yet
                            </Typography>
                        )}
                    </Item>
                </Grid>

                {/* Recent High Risk Predictions */}
                <Grid item xs={12}>
                    <Item>
                        <Typography variant="h6" gutterBottom>
                            Recent ML Predictions (Last 24 Hours)
                        </Typography>
                        {predictions.length === 0 ? (
                            <Typography color="textSecondary" align="center" my={4}>
                                No ML predictions available yet. Events will be scored automatically.
                            </Typography>
                        ) : (
                            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                                {predictions.slice(0, 20).map((pred) => (
                                    <Box
                                        key={pred.id}
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            p: 2,
                                            mb: 1,
                                            borderRadius: 1,
                                            bgcolor: 'background.default',
                                            '&:hover': { bgcolor: 'action.hover' }
                                        }}
                                    >
                                        <Box flex={1}>
                                            <Typography variant="body1" fontWeight="medium">
                                                {pred.event_type}: {pred.file_name}
                                            </Typography>
                                            <Typography variant="body2" color="textSecondary">
                                                {pred.file_path}
                                            </Typography>
                                            <Typography variant="caption" color="textSecondary">
                                                {new Date(pred.created_at).toLocaleString()}
                                            </Typography>
                                        </Box>
                                        <Box display="flex" flexDirection="column" alignItems="flex-end" gap={0.5}>
                                            <Chip
                                                label={pred.risk_level?.toUpperCase() || 'UNKNOWN'}
                                                color={getRiskLevelColor(pred.risk_level)}
                                                size="small"
                                            />
                                            <Typography variant="caption" color="textSecondary">
                                                ML Risk: {(pred.ml_risk_score * 100).toFixed(1)}%
                                            </Typography>
                                            <Typography variant="caption" color="textSecondary">
                                                Context: {pred.ml_context}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Item>
                </Grid>
            </Grid>
        </Box>
    );
};

export default MLInsights;
