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
  TextareaAutosize,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Alert } from '@material-ui/lab';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import GitHubIcon from '@material-ui/icons/GitHub';
import FolderIcon from '@material-ui/icons/Folder';
import CodeIcon from '@material-ui/icons/Code';
import GetAppIcon from '@material-ui/icons/GetApp';
import { useApi, fetchApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import type { DetectedPath, AnalyzeResponse } from '@internal/backstage-plugin-justpush-backend';

const useStyles = makeStyles(theme => ({
  root: {
    maxWidth: 1400,
    margin: '0 auto',
  },
  header: {
    marginBottom: theme.spacing(3),
  },
  paper: {
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(2),
  },
  uploadArea: {
    border: `2px dashed ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(3),
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      borderColor: theme.palette.primary.main,
    },
  },
  compactButton: {
    marginTop: theme.spacing(1.5),
  },
  pathCard: {
    marginBottom: theme.spacing(1.5),
    '& .MuiCardContent-root': {
      padding: theme.spacing(2),
      '&:last-child': {
        paddingBottom: theme.spacing(2),
      },
    },
  },
  chip: {
    marginRight: theme.spacing(0.5),
    marginBottom: theme.spacing(0.5),
    height: 24,
  },
  methodChip: {
    marginRight: theme.spacing(0.5),
    fontWeight: 600,
    height: 24,
    fontSize: '0.75rem',
  },
  specTextarea: {
    width: '100%',
    minHeight: 300,
    maxHeight: 400,
    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
    fontSize: 11,
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: theme.palette.background.default,
    resize: 'vertical',
  },
  summaryBox: {
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  summaryCard: {
    flex: 1,
    padding: theme.spacing(1.5),
    textAlign: 'center',
    backgroundColor: theme.palette.background.default,
    borderRadius: theme.shape.borderRadius,
  },
  endpointList: {
    maxHeight: 350,
    overflow: 'auto',
    '& .MuiListItem-root': {
      paddingTop: theme.spacing(0.75),
      paddingBottom: theme.spacing(0.75),
    },
  },
  compactAccordion: {
    boxShadow: 'none',
    '&:before': {
      display: 'none',
    },
    '& .MuiAccordionSummary-root': {
      minHeight: 40,
      padding: theme.spacing(0, 1),
    },
    '& .MuiAccordionDetails-root': {
      padding: theme.spacing(1),
    },
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

    try {
      const baseUrl = await discoveryApi.getBaseUrl('justpush');
      console.log(`Analyzing project with uploadId: ${uploadId}, URL: ${baseUrl}/analyze/${uploadId}`);
      const response = await fetchApi.fetch(`${baseUrl}/analyze/${uploadId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || response.statusText;
        throw new Error(`Analysis failed: ${errorMessage}`);
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
    <Box p={2} className={classes.root}>
      <Box className={classes.header}>
        <Typography variant="h4" gutterBottom style={{ fontWeight: 600 }}>
          JustPush
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Auto-detect API endpoints and generate OpenAPI specs with AI
        </Typography>
      </Box>

      <Paper className={classes.paper}>
        <Tabs 
          value={tabValue} 
          onChange={(_, newValue) => setTabValue(newValue)}
          variant="fullWidth"
        >
          <Tab label="Upload ZIP" icon={<CloudUploadIcon />} />
          <Tab label="GitHub" icon={<GitHubIcon />} />
        </Tabs>

        <Box mt={2}>
          {tabValue === 0 && (
            <>
              <Box className={classes.uploadArea} onClick={() => document.getElementById('file-input')?.click()}>
                <input
                  id="file-input"
                  type="file"
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <CloudUploadIcon style={{ fontSize: 40, color: '#999' }} />
                <Typography variant="body1" style={{ marginTop: 8 }}>
                  {file ? file.name : 'Click to select ZIP file'}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Max 100MB
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleUploadZip}
                disabled={!file || loading}
                className={classes.compactButton}
              >
                {loading ? <CircularProgress size={20} /> : 'Upload & Detect'}
              </Button>
            </>
          )}

          {tabValue === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Repository URL"
                  variant="outlined"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Branch"
                  variant="outlined"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Path (optional)"
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
                >
                  {loading ? <CircularProgress size={20} /> : 'Import & Detect'}
                </Button>
              </Grid>
            </Grid>
          )}
        </Box>

        {loading && <LinearProgress style={{ marginTop: 12 }} />}

        {error && (
          <Box mt={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}
      </Paper>

      {detectedPaths.length > 0 && (
        <Paper className={classes.paper}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Typography variant="h6" style={{ fontWeight: 600 }}>
              <FolderIcon style={{ verticalAlign: 'middle', marginRight: 8, fontSize: 20 }} />
              Detected Paths ({detectedPaths.length})
            </Typography>
          </Box>

          {detectedPaths.map((detected, index) => (
            <Card key={index} className={classes.pathCard} variant="outlined">
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box flex={1}>
                    <Typography variant="body1" style={{ fontWeight: 500, marginBottom: 6 }}>
                      <CodeIcon style={{ verticalAlign: 'middle', marginRight: 4, fontSize: 18 }} />
                      {detected.path}
                    </Typography>
                    <Box>
                      <Chip label={detected.type} size="small" className={classes.chip} color="primary" />
                      <Chip label={`${(detected.confidence * 100).toFixed(0)}%`} size="small" className={classes.chip} />
                      {detected.framework && (
                        <Chip label={detected.framework} size="small" className={classes.chip} color="secondary" />
                      )}
                      <Chip label={`${detected.files.length} files`} size="small" className={classes.chip} />
                    </Box>
                  </Box>
                </Box>
                <Accordion className={classes.compactAccordion}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2">Files ({detected.files.length})</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <List dense disablePadding>
                      {detected.files.slice(0, 10).map((file, idx) => (
                        <ListItem key={idx} style={{ paddingLeft: 0 }}>
                          <ListItemText 
                            primary={<Typography variant="caption">{file}</Typography>} 
                          />
                        </ListItem>
                      ))}
                      {detected.files.length > 10 && (
                        <Typography variant="caption" color="textSecondary">
                          ... and {detected.files.length - 10} more
                        </Typography>
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
            style={{ marginTop: 8 }}
          >
            {analyzing ? <CircularProgress size={20} /> : 'Analyze Endpoints'}
          </Button>
        </Paper>
      )}

      {analyzeResult && (
        <Paper className={classes.paper}>
          <Typography variant="h6" gutterBottom style={{ fontWeight: 600 }}>
            Analysis Results
          </Typography>

          <Grid container spacing={2}>
            {/* Left side - API Summary */}
            <Grid item xs={12} md={6}>
              <Box className={classes.summaryBox}>
                <Paper className={classes.summaryCard} variant="outlined">
                  <Typography variant="h4" color="primary" style={{ fontWeight: 700 }}>
                    {analyzeResult.summary.totalEndpoints}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Endpoints
                  </Typography>
                </Paper>
                <Paper className={classes.summaryCard} variant="outlined">
                  <Typography variant="h4" color="secondary" style={{ fontWeight: 700 }}>
                    {Object.keys(analyzeResult.summary.byMethod).length}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Methods
                  </Typography>
                </Paper>
              </Box>

              <Box mb={1.5}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  By Method
                </Typography>
                <Box>
                  {Object.entries(analyzeResult.summary.byMethod).map(([method, count]) => (
                    <Chip
                      key={method}
                      label={`${method}: ${count}`}
                      className={classes.chip}
                      color={getMethodColor(method)}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Endpoints
                </Typography>
                <List dense disablePadding className={classes.endpointList}>
                  {(() => {
                    const grouped = analyzeResult.endpoints.reduce((acc, endpoint) => {
                      if (!acc[endpoint.path]) {
                        acc[endpoint.path] = [];
                      }
                      acc[endpoint.path].push(endpoint);
                      return acc;
                    }, {} as Record<string, typeof analyzeResult.endpoints>);

                    return Object.entries(grouped).map(([path, endpoints]) => (
                      <ListItem key={path} style={{ paddingLeft: 0, paddingRight: 0 }}>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" flexWrap="wrap">
                              {endpoints.map((ep, idx) => (
                                <Chip
                                  key={idx}
                                  label={ep.method}
                                  size="small"
                                  color={getMethodColor(ep.method)}
                                  className={classes.methodChip}
                                />
                              ))}
                              <code style={{ fontSize: 12 }}>{path}</code>
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="textSecondary">
                              {endpoints[0].file}:{endpoints[0].line}
                            </Typography>
                          }
                        />
                      </ListItem>
                    ));
                  })()}
                </List>
              </Box>
            </Grid>

            {/* Right side - OpenAPI Spec */}
            <Grid item xs={12} md={6}>
              {analyzeResult.openApiSpec && (
                <>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                    <Typography variant="body2" color="textSecondary">
                      OpenAPI Specification
                    </Typography>
                    <Box>
                      {analyzeResult.geminiMetadata && (
                        <Chip 
                          label={analyzeResult.geminiMetadata.model}
                          size="small"
                          color="primary"
                          style={{ marginRight: 8, height: 24 }}
                        />
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<GetAppIcon style={{ fontSize: 16 }} />}
                        onClick={() => {
                          const blob = new Blob([analyzeResult.openApiSpec!], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'openapi-spec.json';
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
                  <TextareaAutosize
                    className={classes.specTextarea}
                    value={(() => {
                      const spec = analyzeResult.openApiSpec;
                      const words = spec.split(/\s+/);
                      if (words.length > 300) {
                        return words.slice(0, 300).join(' ') + '\n\n... (truncated, download full spec)';
                      }
                      return spec;
                    })()}
                    readOnly
                    placeholder="OpenAPI specification..."
                  />
                </>
              )}
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};
