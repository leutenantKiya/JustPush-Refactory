import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Play, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { LogEntry, TerminalStatus } from '../types';

interface TerminalProps {
  logs: LogEntry[];
  status: TerminalStatus;
  onRun: () => void;
  onClear: () => void;
}

const Terminal: React.FC<TerminalProps> = ({ logs, status, onRun, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getStatusColor = () => {
    switch (status) {
      case TerminalStatus.RUNNING: return 'text-yellow-400';
      case TerminalStatus.SUCCESS: return 'text-green-400';
      case TerminalStatus.ERROR: return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-t border-slate-700 font-mono text-sm shadow-2xl">
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526] border-b border-slate-700">
        <div className="flex items-center space-x-2">
          <TerminalIcon size={16} className="text-slate-400" />
          <span className="text-slate-300 font-medium">Terraform CLI Simulation</span>
          <span className={`text-xs px-2 py-0.5 rounded-full bg-opacity-20 ${getStatusColor()} bg-current`}>
            {status}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={onClear}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Clear Console"
          >
            <RefreshCw size={14} />
          </button>
          <button 
            onClick={onRun}
            disabled={status === TerminalStatus.RUNNING}
            className={`flex items-center space-x-1 px-3 py-1 rounded text-xs font-bold transition-all
              ${status === TerminalStatus.RUNNING 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20'}`}
          >
            <Play size={12} fill="currentColor" />
            <span>APPLY</span>
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 font-mono">
        {logs.length === 0 && (
          <div className="text-slate-500 italic mt-2">
            Ready to deploy. Click 'APPLY' to simulate Terraform execution.
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="break-words whitespace-pre-wrap">
            <span className="text-slate-500 mr-2 select-none">
              {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            {log.type === 'command' && <span className="text-yellow-400 font-bold mr-2">$</span>}
            <span className={`
              ${log.type === 'command' ? 'text-yellow-100 font-bold' : ''}
              ${log.type === 'success' ? 'text-green-400' : ''}
              ${log.type === 'error' ? 'text-red-400' : ''}
              ${log.type === 'warning' ? 'text-orange-400' : ''}
              ${log.type === 'info' ? 'text-slate-300' : ''}
            `}>
              {log.text}
            </span>
          </div>
        ))}
        {status === TerminalStatus.RUNNING && (
          <div className="animate-pulse text-green-500">_</div>
        )}
      </div>
    </div>
  );
};

export default Terminal;