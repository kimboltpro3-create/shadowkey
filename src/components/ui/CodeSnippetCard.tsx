import { Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

interface CodeSnippetCardProps {
  title: string;
  description: string;
  code: string;
  language?: string;
  gradient?: string;
}

export function CodeSnippetCard({
  title,
  description,
  code,
  language = 'typescript',
  gradient = 'from-sky-500 to-cyan-500'
}: CodeSnippetCardProps) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative w-full bg-slate-950 rounded-xl overflow-hidden shadow-xl">
      {/* Gradient Header */}
      <div className={`bg-gradient-to-r ${gradient} p-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
            <p className="text-xs text-white/80">{description}</p>
          </div>
          <span className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded text-xs font-medium text-white whitespace-nowrap">
            {language}
          </span>
        </div>
      </div>

      {/* Code Block */}
      <div className="relative">
        <pre className="p-4 overflow-x-auto text-xs leading-relaxed">
          <code className="text-emerald-400 font-mono whitespace-pre">
            {code}
          </code>
        </pre>

        {/* Copy Button */}
        <button
          onClick={copyCode}
          className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
        >
          {copied ? (
            <CheckCircle size={14} className="text-emerald-400" />
          ) : (
            <Copy size={14} className="text-slate-400" />
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-slate-900 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">ShadowKey Agent SDK</span>
          <span className="text-slate-500">shadowkey.dev</span>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-sky-500/10 to-transparent rounded-tr-full" />
    </div>
  );
}
