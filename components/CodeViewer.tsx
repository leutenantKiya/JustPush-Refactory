import React from 'react';
import { Copy, Check, Download } from 'lucide-react';
import { GeneratedFile } from '../types';

interface CodeViewerProps {
  file: GeneratedFile | null;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ file }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (file) {
      navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (file) {
      const blob = new Blob([file.content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 bg-[#1e1e1e]">
        <div className="text-center">
          <p>Select a file to view content</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-slate-300">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-[#252526]">
       <div className="flex items-center space-x-2">
         <span className="text-sm font-mono text-blue-400">{file.filename}</span>
         <span className="text-xs text-slate-500 px-2 border-l border-slate-600">
           {file.description}
         </span>
       </div>
       <div className="flex items-center space-x-2">
         <button
           onClick={handleDownload}
           className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
           title="Download file"
         >
           <Download size={16} />
         </button>
         <button
           onClick={handleCopy}
           className="p-1.5 hover:bg-slate-700 rounded transition-colors text-slate-400 hover:text-white"
           title="Copy code"
         >
           {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
         </button>
       </div>
     </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="font-mono text-sm leading-relaxed">
          <code className="language-hcl block">
            {file.content}
          </code>
        </pre>
      </div>
    </div>
  );
};

export default CodeViewer;