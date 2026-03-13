import React, { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, Card, CardContent, List, ListItem, ListItemText, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import axios from 'axios';
import io from 'socket.io-client';
import FileUpload from '../components/FileUpload';
import FileTrackingList from '../components/FileTrackingList';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(2),
  color: theme.palette.text.primary,
}));

const Dashboard = () => {
  const [stats, setStats] = useState({
    eventTypeCounts: [],
    avgRisk: 0,
    highRiskCount: 0,
    externalDriveCount: 0
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [riskDistribution, setRiskDistribution] = useState([]);
  const [socket, setSocket] = useState(null);
  const [refreshFiles, setRefreshFiles] = useState(0);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:5001');
    setSocket(newSocket);

    // Fetch initial data
    fetchDashboardData();

    // Socket event listeners
    newSocket.on('file_event', (eventData) => {
      setRecentEvents(prev => [eventData, ...prev.slice(0, 9)]);
      // Update stats after new event
      fetchDashboardData();
    });

    newSocket.on('risk_alert', (alertData) => {
      // Handle risk alerts (could show notifications)
      console.log('Risk Alert:', alertData);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch event statistics
      const statsRes = await axios.get('/api/events/stats');
      setStats(statsRes.data);

      // Fetch recent events
      const eventsRes = await axios.get('/api/events/recent');
      setRecentEvents(eventsRes.data.slice(0, 10));

      // Fetch risk distribution
      const riskRes = await axios.get('/api/analytics/risk-summary');
      setRiskDistribution(riskRes.data.riskDistribution);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  // Prepare chart data
  const riskChartData = {
    labels: ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
    datasets: [
      {
        label: 'Risk Distribution',
        data: riskDistribution.map(item => item.count || 0),
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(255, 99, 132, 0.6)',
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const eventTypeChartData = {
    labels: stats.eventTypeCounts.map(item => item.event_type),
    datasets: [
      {
        label: 'Event Types',
        data: stats.eventTypeCounts.map(item => item.count),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Helper function to get risk level color
  const getRiskColor = (score) => {
    if (score < 20) return 'success';
    if (score < 40) return 'info';
    if (score < 60) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" gutterBottom>
        Security Dashboard
      </Typography>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Events
              </Typography>
              <Typography variant="h5" component="div">
                {stats.eventTypeCounts.reduce((sum, item) => sum + item.count, 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Average Risk Score
              </Typography>
              <Typography variant="h5" component="div">
                {Math.round(stats.avgRisk)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                High Risk Events
              </Typography>
              <Typography variant="h5" component="div" color="error">
                {stats.highRiskCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                External Drive Events
              </Typography>
              <Typography variant="h5" component="div" color="warning">
                {stats.externalDriveCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts and Recent Events */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Risk Distribution
            </Typography>
            <Box sx={{ height: 300 }}>
              <Doughnut data={riskChartData} options={{ maintainAspectRatio: false }} />
            </Box>
          </Item>
        </Grid>
        <Grid item xs={12} md={6}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Event Types
            </Typography>
            <Box sx={{ height: 300 }}>
              <Bar
                data={eventTypeChartData}
                options={{
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true
                    }
                  }
                }}
              />
            </Box>
          </Item>
        </Grid>
        <Grid item xs={12}>
          <Item>
            <Typography variant="h6" gutterBottom>
              Recent File Events
            </Typography>
            <List>
              {recentEvents.map((event) => (
                <ListItem
                  key={event.id}
                  divider
                  secondaryAction={
                    <Chip
                      label={`Risk: ${event.risk_score}`}
                      color={getRiskColor(event.risk_score)}
                      size="small"
                    />
                  }
                >
                  <ListItemText
                    primary={`${event.event_type}: ${event.file_name}`}
                    secondary={`${event.file_path || 'Unknown path'} - ${
                      event.created_at
                        ? new Date(event.created_at + (event.created_at?.endsWith('Z') ? '' : 'Z')).toLocaleString()
                        : 'Unknown time'
                    }`}
                  />
                </ListItem>
              ))}
            </List>
          </Item>
        </Grid>

        {/* File Upload and Tracking Section */}
        <Grid item xs={12} md={4}>
          <FileUpload
            onUploadComplete={() => setRefreshFiles(prev => prev + 1)}
          />
        </Grid>
        <Grid item xs={12} md={8}>
          <FileTrackingList refreshTrigger={refreshFiles} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
