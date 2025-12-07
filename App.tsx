import React, { useState, useCallback, useEffect } from 'react';
import {
  Server,
  Cpu,
  Box,
  FileCode,
  Rocket,
  Loader2,
  FolderOpen,
  Network,
  Download
} from 'lucide-react';
import { generateInfrastructure, runTerraformCommand, getProjectFiles } from './services/geminiService';
import { GeneratedFile, GenerationResponse, LogEntry, TerminalStatus } from './types';
import Terminal from './components/Terminal';
import CodeViewer from './components/CodeViewer';

const DEFAULT_LOGS: LogEntry[] = [
  { id: '1', text: 'Welcome to KubeGenius v1.0.0', type: 'info', timestamp: Date.now() },
  { id: '2', text: 'Waiting for infrastructure definition...', type: 'info', timestamp: Date.now() + 10 },
];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<(GenerationResponse & { projectName: string }) | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  // Kubeconfig State
  const [kubeconfigInfo, setKubeconfigInfo] = useState<{
    server: string;
    context: string;
    namespace: string;
  } | null>(null);

  // Terminal State
  const [logs, setLogs] = useState<LogEntry[]>(DEFAULT_LOGS);
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus>(TerminalStatus.IDLE);

  // Load kubeconfig info on mount
  useEffect(() => {
    // For now, we'll hardcode the kubeconfig info since we can't read files from frontend
    // In a real implementation, this would come from an API endpoint
    setKubeconfigInfo({
      server: 'https://103.185.52.178:6443',
      context: 'mau-menang',
      namespace: 'mau-menang'
    });
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setLogs(prev => [
      ...prev, 
      { id: Date.now().toString(), text: `analyzing request: "${prompt}"`, type: 'info', timestamp: Date.now() }
    ]);

    try {
      const data = await generateInfrastructure(prompt);
      setResult(data);
      setCurrentProject(data.projectName);
      if (data.files.length > 0) {
        setSelectedFile(data.files[0]);
      }
      setLogs(prev => [
        ...prev,
        { id: Date.now().toString(), text: `Configuration generated successfully. Project: ${data.projectName}`, type: 'success', timestamp: Date.now() }
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setLogs(prev => [
        ...prev,
        { id: Date.now().toString(), text: `Failed to generate configuration: ${errorMessage}`, type: 'error', timestamp: Date.now() }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const addLog = (text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(36), text, type, timestamp: Date.now() }]);
  };

  const handleDownloadAll = () => {
    if (!result) return;

    result.files.forEach((file) => {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const executeTerraform = useCallback(async () => {
    if (!currentProject) return;

    setTerminalStatus(TerminalStatus.RUNNING);

    try {
      // Terraform Init
      addLog('terraform init', 'command');
      const initResult = await runTerraformCommand('init', currentProject);
      if (initResult.stdout) addLog(initResult.stdout, 'info');
      if (initResult.stderr) addLog(initResult.stderr, 'warning');
      if (initResult.error) throw new Error(initResult.error);

      // Terraform Plan
      addLog('terraform plan', 'command');
      const planResult = await runTerraformCommand('plan', currentProject);
      if (planResult.stdout) addLog(planResult.stdout, 'info');
      if (planResult.stderr) addLog(planResult.stderr, 'warning');
      if (planResult.error) throw new Error(planResult.error);

      // Terraform Apply
      addLog('terraform apply -auto-approve', 'command');
      const applyResult = await runTerraformCommand('apply', currentProject);
      if (applyResult.stdout) addLog(applyResult.stdout, 'info');
      if (applyResult.stderr) addLog(applyResult.stderr, 'warning');
      if (applyResult.error) throw new Error(applyResult.error);

      addLog('Terraform apply completed successfully!', 'success');
      setTerminalStatus(TerminalStatus.SUCCESS);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Execution failed';
      addLog(`Error: ${errorMessage}`, 'error');
      setTerminalStatus(TerminalStatus.ERROR);
    }
  }, [currentProject]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0f172a] text-slate-200">
      
      {/* Sidebar: Inputs & File Explorer */}
      <div className="w-80 flex flex-col border-r border-slate-700 bg-[#111827]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-[#1e293b]">
          <div className="flex items-center gap-2 mb-1">
            <Box className="text-blue-500" />
            <h1 className="font-bold text-lg tracking-tight text-white">KubeGenius</h1>
          </div>
          <p className="text-xs text-slate-400">AI-Powered Infrastructure as Code</p>
        </div>

        {/* Input Area */}
        <div className="p-4 border-b border-slate-700">
          <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
            Project Requirements
          </label>
          <textarea
            className="w-full h-32 bg-[#1f2937] border border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none placeholder-slate-500"
            placeholder="e.g. A Node.js API with 3 replicas, exposed on port 3000, connected to a Redis cache."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="mt-3 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
          >
            {isGenerating ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Architecting...</span>
              </>
            ) : (
              <>
                <Rocket size={16} />
                <span>Generate Terraform</span>
              </>
            )}
          </button>
        </div>

        {/* File Explorer */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500 mb-3">
              <div className="flex items-center gap-2">
                <FolderOpen size={14} />
                <span>Workspace Files</span>
              </div>
              {result && (
                <button
                  onClick={handleDownloadAll}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors text-slate-300 hover:text-white"
                  title="Download all files"
                >
                  <Download size={12} />
                  <span>All</span>
                </button>
              )}
            </div>

            {!result ? (
              <div className="text-center py-8 text-slate-600 text-sm">
                No files generated yet.
              </div>
            ) : (
              <ul className="space-y-1">
                {result.files.map((file) => (
                  <li key={file.filename}>
                    <button
                      onClick={() => setSelectedFile(file)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors
                        ${selectedFile?.filename === file.filename
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                          : 'hover:bg-slate-800 text-slate-300'}`}
                    >
                      <FileCode size={15} className={file.filename.endsWith('.tf') ? 'text-violet-400' : 'text-yellow-400'} />
                      <span className="truncate">{file.filename}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Cluster Info */}
        {kubeconfigInfo && (
          <div className="p-4 border-t border-slate-700 bg-[#1e293b]">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500 mb-2">
              <Network size={14} />
              <span>Cluster Info</span>
            </div>
            <div className="space-y-1 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Server:</span>
                <span className="text-slate-300 truncate ml-2">{kubeconfigInfo.server}</span>
              </div>
              <div className="flex justify-between">
                <span>Context:</span>
                <span className="text-slate-300 truncate ml-2">{kubeconfigInfo.context}</span>
              </div>
              <div className="flex justify-between">
                <span>Namespace:</span>
                <span className="text-slate-300 truncate ml-2">{kubeconfigInfo.namespace}</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500 bg-[#1e293b]">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Gemini v2.5-flash Active</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#0f172a]">
        
        {/* Split View: Code (Top) / Terminal (Bottom) */}
        <div className="flex-1 flex flex-col h-full">
          
          {/* Top: Code Editor View */}
          <div className="flex-1 min-h-0 relative">
            {result ? (
              <CodeViewer file={selectedFile} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                  <Cpu size={32} className="text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-400">Ready to Architect</h3>
                <p className="max-w-md text-center mt-2 text-sm">
                  Describe your infrastructure needs in the sidebar and let the AI build your Kubernetes resources.
                </p>
              </div>
            )}
          </div>

          {/* Bottom: Simulated Terminal */}
          <div className="h-64 min-h-[200px] shrink-0">
            <Terminal
              logs={logs}
              status={terminalStatus}
              onRun={executeTerraform}
              onClear={() => setLogs([])}
            />
          </div>

        </div>
      </div>
    </div>
  );
}