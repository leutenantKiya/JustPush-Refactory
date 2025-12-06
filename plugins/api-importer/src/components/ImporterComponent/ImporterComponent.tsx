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
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import GitHubIcon from '@material-ui/icons/GitHub';
import FolderIcon from '@material-ui/icons/Folder';
import CodeIcon from '@material-ui/icons/Code';
import { useApi, fetchApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import { DetectedPath, AnalyzeResponse } from '@internal/backstage-plugin-api-importer-backend/src/types/api';

const useStyles = makeStyles(theme => ({
  paper: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  uploadArea: {
    border: `2px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(4),
    textAlign: 'center',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
  button: {
    marginTop: theme.spacing(2),
  },
  pathCard: {
    marginBottom: theme.spacing(2),
  },
  chip: {
    marginRight: theme.spacing(1),
  },
  endpointCard: {
    marginTop: theme.spacing(2),
  },
  methodChip: {
    marginRight: theme.spacing(1),
    fontWeight: 'bold',
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
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
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
      const baseUrl = await discoveryApi.getBaseUrl('api-importer');
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
      const baseUrl = await discoveryApi.getBaseUrl('api-importer');
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

    try {
      const baseUrl = await discoveryApi.getBaseUrl('api-importer');
      const response = await fetchApi.fetch(`${baseUrl}/analyze/${uploadId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      setAnalyzeResult(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const getMethodColor = (method: string): 'primary' | 'secondary' | 'default' => {
    switch (method) {
      case 'GET': return 'primary';
      case 'POST': return 'secondary';
      case 'PUT': return 'default';
      case 'DELETE': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        API Importer & Analyzer
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Upload ZIP file or import from GitHub to automatically detect and analyze API endpoints
      </Typography>

      <Paper className={classes.paper}>
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
                  <CloudUploadIcon style={{ fontSize: 48, color: '#999' }} />
                  <Typography variant="h6">
                    {file ? file.name : 'Click to select ZIP file'}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
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
          <Typography variant="h5" gutterBottom>
            <FolderIcon style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Detected API Paths ({detectedPaths.length})
          </Typography>

          {detectedPaths.map((detected, index) => (
            <Card key={index} className={classes.pathCard}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6">
                      <CodeIcon style={{ verticalAlign: 'middle', marginRight: 8 }} />
                      {detected.path}
                    </Typography>
                    <Box mt={1}>
                      <Chip label={detected.type} size="small" className={classes.chip} color="primary" />
                      <Chip label={`Confidence: ${(detected.confidence * 100).toFixed(0)}%`} size="small" className={classes.chip} />
                      {detected.framework && (
                        <Chip label={detected.framework} size="small" className={classes.chip} color="secondary" />
                      )}
                      <Chip label={`${detected.files.length} files`} size="small" />
                    </Box>
                  </Box>
                </Box>
                <Accordion style={{ marginTop: 16 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography>View Files ({detected.files.length})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense>
                      {detected.files.slice(0, 20).map((file, idx) => (
                        <ListItem key={idx}>
                          <ListItemText primary={file} />
                        </ListItem>
                      ))}
                      {detected.files.length > 20 && (
                        <ListItem>
                          <ListItemText primary={`... and ${detected.files.length - 20} more`} />
                        </ListItem>
                      )}
                    </List>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          ))}

          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleAnalyze}
            disabled={analyzing}
            className={classes.button}
          >
            {analyzing ? <CircularProgress size={24} /> : 'Analyze Endpoints'}
          </Button>
        </Paper>
      )}

      {analyzeResult && (
        <Paper className={classes.paper}>
          <Typography variant="h5" gutterBottom>
            Analysis Results
          </Typography>

          <Grid container spacing={2} style={{ marginBottom: 16 }}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Total Endpoints
                  </Typography>
                  <Typography variant="h4">
                    {analyzeResult.summary.totalEndpoints}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    By Method
                  </Typography>
                  <Box>
                    {Object.entries(analyzeResult.summary.byMethod).map(([method, count]) => (
                      <Chip
                        key={method}
                        label={`${method}: ${count}`}
                        className={classes.chip}
                        color={getMethodColor(method)}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Typography variant="h6" gutterBottom>
            Endpoints ({analyzeResult.endpoints.length})
          </Typography>
          
          <TableContainer component={Paper} className={classes.endpointCard}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Method</TableCell>
                  <TableCell>Path</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell align="right">Line</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {analyzeResult.endpoints.slice(0, 100).map((endpoint, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Chip
                        label={endpoint.method}
                        size="small"
                        color={getMethodColor(endpoint.method)}
                        className={classes.methodChip}
                      />
                    </TableCell>
                    <TableCell>
                      <code>{endpoint.path}</code>
                    </TableCell>
                    <TableCell>{endpoint.file}</TableCell>
                    <TableCell align="right">{endpoint.line}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {analyzeResult.endpoints.length > 100 && (
            <Typography variant="body2" color="textSecondary" style={{ marginTop: 16, textAlign: 'center' }}>
              Showing first 100 of {analyzeResult.endpoints.length} endpoints
            </Typography>
          )}
        </Paper>
      )}
    </Box>
  );
};
