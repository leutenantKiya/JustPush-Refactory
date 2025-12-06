import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import GitHubIcon from '@material-ui/icons/GitHub';
import CodeIcon from '@material-ui/icons/Code';
import GetAppIcon from '@material-ui/icons/GetApp';
import { useApi, fetchApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import type { DetectedPath, AnalyzeResponse } from '@internal/backstage-plugin-justpush-backend';

const useStyles = makeStyles(theme => ({
  paper: {
    padding: theme.spacing(5),
    marginBottom: theme.spacing(4),
    borderRadius: 16,
    backgroundColor: '#1e1e1e',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  uploadArea: {
    border: '1px dashed rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: theme.spacing(6),
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    backgroundColor: '#2a2a2a',
    '&:hover': {
      backgroundColor: '#323232',
      borderColor: 'rgba(255, 255, 255, 0.25)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      transform: 'translateY(-2px)',
    },
  },
  button: {
    borderRadius: 12,
    textTransform: 'none',
    fontWeight: 500,
    fontSize: '0.9375rem',
    padding: theme.spacing(1.5, 4),
    boxShadow: 'none',
    backgroundColor: '#f5f5f5',
    color: '#1a1a1a',
    border: 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      backgroundColor: '#ffffff',
      boxShadow: '0 4px 16px rgba(255, 255, 255, 0.15), 0 0 20px rgba(255, 255, 255, 0.08)',
      transform: 'translateY(-1px)',
    },
    '&:disabled': {
      backgroundColor: '#3a3a3a',
      color: '#6e6e6e',
      border: 'none',
    },
  },
  pathCard: {
    marginBottom: theme.spacing(2),
    borderRadius: 14,
    backgroundColor: '#1e1e1e',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    '&:hover': {
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      transform: 'translateY(-2px)',
      borderColor: 'rgba(255, 255, 255, 0.18)',
      backgroundColor: '#242424',
    },
  },
  chip: {
    marginRight: theme.spacing(0.75),
    marginBottom: theme.spacing(0.75),
    borderRadius: 8,
    fontWeight: 500,
    fontSize: '0.8125rem',
    backgroundColor: '#2a2a2a',
    color: '#e0e0e0',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    height: 26,
    padding: '0 10px',
  },
  methodChip: {
    marginRight: theme.spacing(0.75),
    fontWeight: 600,
    borderRadius: 8,
    fontSize: '0.75rem',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    backgroundColor: '#1a1a1a',
    color: '#d0d0d0',
    height: 24,
    padding: '0 8px',
  },
  specTextarea: {
    width: '100%',
    height: 450,
    fontFamily: '"SF Mono", "Consolas", "Monaco", monospace',
    fontSize: 13.5,
    lineHeight: 1.7,
    padding: theme.spacing(3),
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    color: '#e8e8e8',
    overflow: 'auto',
    boxSizing: 'border-box',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    transition: 'all 0.3s ease',
    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
    '&:focus': {
      outline: 'none',
      backgroundColor: '#2e2e2e',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      boxShadow: '0 0 0 3px rgba(255, 255, 255, 0.05), inset 0 2px 4px rgba(0, 0, 0, 0.2)',
    },
  },
  compactCard: {
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#1e1e1e',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    transition: 'all 0.3s ease',
  },
  statsCard: {
    padding: theme.spacing(2),
  },
  sectionHeader: {
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: '#f5f5f5',
    fontSize: '1.75rem',
  },
  infoBox: {
    backgroundColor: '#2a2a2a',
    padding: theme.spacing(2.5),
    borderRadius: 12,
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  tableContainer: {
    borderRadius: 12,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backgroundColor: '#1e1e1e',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
  },
}));

export const ImporterComponent = () => {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const [tabValue, setTabValue] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [path, setPath] = useState('');
  const [domain, setDomain] = useState('https://api.example.com');
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [detectedPaths, setDetectedPaths] = useState<DetectedPath[]>([]);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null);
    }
  };

  const handleUploadZip = async () => {
    if (!file) {
      setError('Please select a ZIP file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const baseUrl = await discoveryApi.getBaseUrl('justpush');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetchApi.fetch(`${baseUrl}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      setUploadId(data.uploadId);
      setDetectedPaths(data.detectedPaths);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportGitHub = async () => {
    if (!githubUrl) {
      setError('Please enter a GitHub URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const baseUrl = await discoveryApi.getBaseUrl('justpush');
      const response = await fetchApi.fetch(`${baseUrl}/import/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoUrl: githubUrl,
          branch: branch || 'main',
          path: path || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Import failed: ${response.statusText}`);
      }

      const data = await response.json();
      setUploadId(data.uploadId);
      setDetectedPaths(data.detectedPaths);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadId) {
      setError('No project to analyze');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setAnalysisProgress(0);

    try {
      // Simulate progress steps
      setAnalysisStep('Preparing files...');
      setAnalysisProgress(10);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      setAnalysisStep('Detecting endpoints...');
      setAnalysisProgress(30);

      const baseUrl = await discoveryApi.getBaseUrl('justpush');
      console.log(`Analyzing project with uploadId: ${uploadId}, URL: ${baseUrl}/analyze/${uploadId}`);
      
      setAnalysisStep('Analyzing API patterns...');
      setAnalysisProgress(50);
      
      const response = await fetchApi.fetch(`${baseUrl}/analyze/${uploadId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || response.statusText;
        throw new Error(`Analysis failed: ${errorMessage}`);
      }

      setAnalysisStep('Generating OpenAPI spec with AI...');
      setAnalysisProgress(80);

      const data = await response.json();
      
      setAnalysisStep('Finalizing...');
      setAnalysisProgress(100);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setAnalyzeResult(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(0);
      setAnalysisStep('');
    }
  };

  return (
    <Box p={4} style={{ backgroundColor: '#161616', minHeight: '100vh' }}>
      <Box mb={6}>
        <Typography variant="h5" className={classes.sectionHeader} style={{ marginBottom: 12 }}>
          JustPush - API Normalization Tool
        </Typography>
        <Typography variant="body1" style={{ color: '#b0b0b0', fontSize: '0.9375rem', lineHeight: 1.6, maxWidth: 720, fontWeight: 400 }}>
          Upload ZIP or import from GitHub to detect and analyze API endpoints with AI-powered OpenAPI generation.
        </Typography>
      </Box>

      <Paper className={classes.paper}>
        <Grid container spacing={3} style={{ marginBottom: 32 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="API Domain / Base URL"
              variant="outlined"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="https://api.example.com"
              helperText="This will be used as the base URL in your generated OpenAPI specification"
              InputProps={{
                style: {
                  borderRadius: 12,
                  backgroundColor: '#2a2a2a',
                  fontSize: '0.9375rem',
                  color: '#e0e0e0',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                },
              }}
              InputLabelProps={{
                style: { color: '#b0b0b0', fontSize: '0.9375rem', fontWeight: 500 },
              }}
            />
          </Grid>
        </Grid>

        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Upload ZIP" icon={<CloudUploadIcon />} />
          <Tab label="Import from GitHub" icon={<GitHubIcon />} />
        </Tabs>

        <Box mt={3}>
          {tabValue === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Box className={classes.uploadArea} onClick={() => document.getElementById('file-input')?.click()}>
                  <input
                    id="file-input"
                    type="file"
                    accept=".zip"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <CloudUploadIcon style={{ fontSize: 56, color: '#8a8a8a', marginBottom: 16 }} />
                  <Typography variant="h6" style={{ color: '#e8e8e8', fontWeight: 500, marginBottom: 8, fontSize: '1rem' }}>
                    {file ? file.name : 'Click to select ZIP file'}
                  </Typography>
                  <Typography variant="body2" style={{ color: '#8a8a8a', fontSize: '0.875rem' }}>
                    Maximum file size: 100MB
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={handleUploadZip}
                  disabled={!file || loading}
                  className={classes.button}
                >
                  {loading ? <CircularProgress size={24} /> : 'Upload and Detect APIs'}
                </Button>
              </Grid>
            </Grid>
          )}

          {tabValue === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="GitHub Repository URL"
                  variant="outlined"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  helperText="Enter full GitHub repository URL"
                  InputProps={{
                    style: { borderRadius: 12, backgroundColor: '#2a2a2a', fontSize: '0.9375rem', color: '#e0e0e0', border: '1px solid rgba(255, 255, 255, 0.1)' },
                  }}
                  InputLabelProps={{
                    style: { color: '#b0b0b0', fontSize: '0.9375rem', fontWeight: 500 },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Branch"
                  variant="outlined"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  InputProps={{
                    style: { borderRadius: 12, backgroundColor: '#2a2a2a', fontSize: '0.9375rem', color: '#e0e0e0', border: '1px solid rgba(255, 255, 255, 0.1)' },
                  }}
                  InputLabelProps={{
                    style: { color: '#b0b0b0', fontSize: '0.9375rem', fontWeight: 500 },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Subdirectory (optional)"
                  variant="outlined"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="backend/src"
                  InputProps={{
                    style: { borderRadius: 12, backgroundColor: '#2a2a2a', fontSize: '0.9375rem', color: '#e0e0e0', border: '1px solid rgba(255, 255, 255, 0.1)' },
                  }}
                  InputLabelProps={{
                    style: { color: '#b0b0b0', fontSize: '0.9375rem', fontWeight: 500 },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={handleImportGitHub}
                  disabled={!githubUrl || loading}
                  className={classes.button}
                >
                  {loading ? <CircularProgress size={24} /> : 'Import and Detect APIs'}
                </Button>
              </Grid>
            </Grid>
          )}
        </Box>

        {loading && <LinearProgress style={{ marginTop: 16 }} />}

        {error && (
          <Box mt={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
      </Paper>

      {detectedPaths.length > 0 && (
        <Paper className={classes.paper}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6" style={{ marginBottom: 0, fontSize: '1.25rem', fontWeight: 600, color: '#f5f5f5', letterSpacing: '-0.01em' }}>
              Detected API Paths ({detectedPaths.length})
            </Typography>
            <Button
              variant="contained"
              onClick={handleAnalyze}
              disabled={analyzing}
              className={classes.button}
              style={{ padding: '10px 24px' }}
            >
              {analyzing ? <CircularProgress size={18} color="inherit" /> : 'Analyze with AI'}
            </Button>
          </Box>

          {analyzing && (
            <Box mb={3}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="body2" style={{ color: '#b0b0b0', fontSize: '0.875rem' }}>
                  {analysisStep}
                </Typography>
                <Typography variant="body2" style={{ color: '#b0b0b0', fontSize: '0.875rem' }}>
                  {analysisProgress}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={analysisProgress} 
                style={{ 
                  height: 6, 
                  borderRadius: 4,
                  backgroundColor: '#2a2a2a',
                }}
              />
            </Box>
          )}

          <TableContainer component={Paper} className={classes.tableContainer}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell style={{ color: '#c0c0c0', backgroundColor: '#242424', fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Path</TableCell>
                  <TableCell style={{ color: '#c0c0c0', backgroundColor: '#242424', fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</TableCell>
                  <TableCell style={{ color: '#c0c0c0', backgroundColor: '#242424', fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Framework</TableCell>
                  <TableCell align="center" style={{ color: '#c0c0c0', backgroundColor: '#242424', fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</TableCell>
                  <TableCell align="center" style={{ color: '#c0c0c0', backgroundColor: '#242424', fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Files</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detectedPaths.map((detected, index) => (
                  <TableRow key={index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <TableCell style={{ backgroundColor: '#1e1e1e', padding: '12px 16px' }}>
                      <Box display="flex" alignItems="center">
                        <CodeIcon style={{ marginRight: 8, fontSize: 16, color: '#9a9a9a' }} />
                        <code style={{ fontSize: 12.5, color: '#e8e8e8', backgroundColor: '#2a2a2a', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          {detected.path}
                        </code>
                      </Box>
                    </TableCell>
                    <TableCell style={{ backgroundColor: '#1e1e1e', padding: '12px 16px' }}>
                      <Chip 
                        label={detected.type} 
                        size="small" 
                        className={classes.methodChip}
                        style={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell style={{ backgroundColor: '#1e1e1e', padding: '12px 16px' }}>
                      {detected.framework ? (
                        <Chip 
                          label={detected.framework} 
                          size="small" 
                          className={classes.chip}
                        />
                      ) : (
                        <Typography variant="caption" style={{ color: '#6e6e6e' }}>-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center" style={{ backgroundColor: '#1e1e1e', padding: '12px 16px' }}>
                      <Box display="flex" alignItems="center" justifyContent="center">
                        <Box 
                          style={{ 
                            width: 40, 
                            height: 6, 
                            backgroundColor: '#2a2a2a', 
                            borderRadius: 4,
                            marginRight: 8,
                            overflow: 'hidden'
                          }}
                        >
                          <Box 
                            style={{ 
                              width: `${detected.confidence * 100}%`, 
                              height: '100%', 
                              backgroundColor: detected.confidence > 0.7 ? '#4caf50' : detected.confidence > 0.5 ? '#ff9800' : '#f44336',
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </Box>
                        <Typography variant="caption" style={{ color: '#d0d0d0', fontSize: '0.75rem', fontWeight: 500 }}>
                          {(detected.confidence * 100).toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center" style={{ backgroundColor: '#1e1e1e', padding: '12px 16px' }}>
                      <Typography variant="body2" style={{ color: '#d0d0d0', fontSize: '0.8125rem' }}>
                        {detected.files.length}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {analyzeResult && (
        <Paper className={classes.paper}>
          <Typography variant="h6" gutterBottom style={{ color: '#f5f5f5', fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 24 }}>
            Analysis Results
          </Typography>

          <Grid container spacing={2}>
            {/* Left Column - Statistics and Endpoints */}
            <Grid item xs={12} md={analyzeResult.openApiSpec ? 6 : 12}>
              <Grid container spacing={2} style={{ marginBottom: 16 }}>
                <Grid item xs={6}>
                  <Card className={classes.compactCard}>
                    <CardContent className={classes.statsCard}>
                      <Typography variant="body2" gutterBottom style={{ color: '#9a9a9a', fontSize: '0.75rem', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Total Endpoints
                      </Typography>
                      <Typography variant="h4" style={{ color: '#f5f5f5', fontWeight: 600, letterSpacing: '-0.02em', fontSize: '1.75rem' }}>
                        {analyzeResult.summary.totalEndpoints}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6}>
                  <Card className={classes.compactCard}>
                    <CardContent className={classes.statsCard}>
                      <Typography variant="body2" gutterBottom style={{ color: '#9a9a9a', fontSize: '0.75rem', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Methods
                      </Typography>
                      <Box>
                        {Object.entries(analyzeResult.summary.byMethod).map(([method, count]) => (
                          <Chip
                            key={method}
                            label={`${method}: ${count}`}
                            size="small"
                            className={classes.chip}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Typography variant="subtitle2" gutterBottom style={{ marginTop: 8, marginBottom: 12, color: '#d0d0d0', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Endpoints ({analyzeResult.endpoints.length})
              </Typography>
              
              <TableContainer component={Paper} className={classes.tableContainer} style={{ maxHeight: 450 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell style={{ color: '#c0c0c0', backgroundColor: '#242424', fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Method</TableCell>
                      <TableCell style={{ color: '#c0c0c0', backgroundColor: '#242424', fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Path</TableCell>
                      <TableCell style={{ color: '#c0c0c0', backgroundColor: '#242424', fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>File</TableCell>
                      <TableCell align="right" style={{ color: '#c0c0c0', backgroundColor: '#242424', fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Line</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analyzeResult.endpoints.slice(0, 50).map((endpoint, index) => (
                      <TableRow key={index} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <TableCell style={{ backgroundColor: '#1e1e1e', padding: '12px 16px' }}>
                          <Chip
                            label={endpoint.method}
                            size="small"
                            className={classes.methodChip}
                          />
                        </TableCell>
                        <TableCell style={{ backgroundColor: '#1e1e1e', padding: '12px 16px' }}>
                          <code style={{ fontSize: 12.5, color: '#d0d0d0', backgroundColor: '#2a2a2a', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.08)' }}>{endpoint.path}</code>
                        </TableCell>
                        <TableCell style={{ fontSize: 12.5, color: '#9a9a9a', backgroundColor: '#1e1e1e', padding: '12px 16px' }}>{endpoint.file}</TableCell>
                        <TableCell align="right" style={{ fontSize: 12.5, color: '#d0d0d0', backgroundColor: '#1e1e1e', padding: '12px 16px' }}>{endpoint.line}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {analyzeResult.endpoints.length > 50 && (
                <Typography variant="caption" style={{ marginTop: 12, display: 'block', textAlign: 'center', color: '#7a7a7a', fontSize: '0.8125rem' }}>
                  Showing 50 of {analyzeResult.endpoints.length} endpoints
                </Typography>
              )}
            </Grid>

            {/* Right Column - OpenAPI Spec */}
            {analyzeResult.openApiSpec && (
              <Grid item xs={12} md={6}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="subtitle2" style={{ color: '#d0d0d0', fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    OpenAPI Specification
                  </Typography>
                  <Box display="flex" alignItems="center">
                    {analyzeResult.geminiMetadata && (
                      <Chip 
                        label={analyzeResult.geminiMetadata.model}
                        size="small"
                        className={classes.chip}
                        style={{ marginRight: 12 }}
                      />
                    )}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<GetAppIcon style={{ fontSize: 18 }} />}
                      className={classes.button}
                      style={{ padding: '8px 20px', fontSize: '0.875rem' }}
                      onClick={() => {
                        const blob = new Blob([analyzeResult.openApiSpec!], { type: 'text/yaml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'openapi-spec.yaml';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download
                    </Button>
                  </Box>
                </Box>
                <Box
                  className={classes.specTextarea}
                  component="pre"
                  tabIndex={0}
                >
                  {analyzeResult.openApiSpec}
                </Box>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}
    </Box>
  );
};
