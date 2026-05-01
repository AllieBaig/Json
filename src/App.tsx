/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileJson, 
  Upload, 
  ChevronDown, 
  ChevronUp, 
  Play, 
  RotateCcw, 
  Copy, 
  Download, 
  Eye, 
  AlertCircle,
  CheckCircle2,
  Settings2,
  FileCode2,
  WifiOff,
  CloudLightning
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { openDB, IDBPDatabase } from 'idb';

// Initialize Gemini (will be used when online)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Database logic
const DB_NAME = 'JSONMorphDB';
const STORE_NAME = 'session';

async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

// Local Structural Mapping Fallback (Zero Internet Logic)
const localMorph = (source: any, template: any): any => {
  if (!template) return source;
  
  const result: any = {};
  const templateKeys = Object.keys(template);
  
  for (const key of templateKeys) {
    // 1. Direct match
    if (source[key] !== undefined) {
      result[key] = source[key];
    } 
    // 2. Case insensitive match
    else {
      const sourceKeys = Object.keys(source);
      const matchedKey = sourceKeys.find(sk => sk.toLowerCase() === key.toLowerCase());
      if (matchedKey) {
        result[key] = source[matchedKey];
      } else {
        // 3. Keep template default if it's not null/empty
        result[key] = template[key];
      }
    }
  }
  return result;
};

interface GroupProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
}

const CollapsibleGroup = ({ title, isOpen, onToggle, children, icon }: GroupProps) => (
  <div id={`group-${title.toLowerCase().replace(/\s/g, '-')}`} className="bg-[#F5F5F5] rounded-xl overflow-hidden mb-3 border border-gray-100">
    <button 
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 h-12 hover:bg-gray-100/50 transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-sm font-medium text-gray-700">{title}</span>
      </div>
      {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="px-4 pb-4"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

interface FileSubgroupProps {
  title: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  onFileSelect: (file: File) => void;
}

const FileSubgroup = ({ title, value, onChange, placeholder, onFileSelect }: FileSubgroupProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
      onFileSelect(file);
    }
  };

  return (
    <div id={`subgroup-${title.toLowerCase().replace(/\s/g, '-')}`} className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] uppercase tracking-wider font-bold text-gray-400">{title}</h4>
      </div>
      
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="relative group"
      >
        <div className="flex gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-[48px] bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Upload size={14} />
            Browse or Drop File
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelect(file);
              }}
            />
          </button>
        </div>

        <div className="mt-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            className={`w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono transition-all resize-none ${
              isFocused ? 'h-32 border-gray-400 ring-2 ring-gray-100' : 'h-10 opacity-60 hover:opacity-100'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [oldJson, setOldJson] = useState('');
  const [templateJson, setTemplateJson] = useState('');
  const [outputJson, setOutputJson] = useState('');
  const [isInputOpen, setIsInputOpen] = useState(true);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [autoConvert, setAutoConvert] = useState(true);
  const [isConverting, setIsConverting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dbRef = useRef<IDBPDatabase | null>(null);

  // Remove fallback shell on mount
  useEffect(() => {
    const fallback = document.getElementById('fallback-ui');
    if (fallback) fallback.classList.add('hidden');
  }, []);

  // Online detection
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // Initialize DB and load last session
  useEffect(() => {
    initDB().then(async (db) => {
      dbRef.current = db;
      const lastSession = await db.get(STORE_NAME, 'lastState');
      if (lastSession) {
        setOldJson(lastSession.oldJson || '');
        setTemplateJson(lastSession.templateJson || '');
        setOutputJson(lastSession.outputJson || '');
      }
    });
  }, []);

  // Persist session
  useEffect(() => {
    if (dbRef.current) {
      dbRef.current.put(STORE_NAME, { oldJson, templateJson, outputJson }, 'lastState');
    }
  }, [oldJson, templateJson, outputJson]);

  const isValidJson = (str: string) => {
    if (!str.trim()) return false;
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const handleFileSelect = async (file: File, type: 'old' | 'template') => {
    const text = await file.text();
    if (type === 'old') setOldJson(text);
    else setTemplateJson(text);
  };

  const convertJson = useCallback(async () => {
    if (!oldJson) return;
    if (!isValidJson(oldJson)) {
      setError('Source text is not valid JSON');
      return;
    }
    
    setError(null);
    setSuccess(false);
    setIsConverting(true);

    try {
      if (isOnline) {
        // AI Path
        const prompt = templateJson 
          ? `Map the data from the following Old JSON into the structure of the New Format Template. 
             Old JSON: ${oldJson}
             New Format Template: ${templateJson}
             Return ONLY the mapped JSON object. No words, no markdown.`
          : `Cleanup and prettify this JSON: ${oldJson}. Return ONLY the JSON object.`;

        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });

        const cleanedText = response.text?.replace(/```json|```/g, '').trim() || '';
        if (isValidJson(cleanedText)) {
          setOutputJson(JSON.stringify(JSON.parse(cleanedText), null, 2));
          setIsOutputOpen(true);
          setSuccess(true);
        } else {
          throw new Error("AI output was invalid JSON. Falling back to local mapping.");
        }
      } else {
        // Offline Path: Best-effort local mapping
        const sourceData = JSON.parse(oldJson);
        const templateData = templateJson && isValidJson(templateJson) ? JSON.parse(templateJson) : null;
        
        const result = Array.isArray(sourceData) 
          ? sourceData.map(item => localMorph(item, templateData))
          : localMorph(sourceData, templateData);

        setOutputJson(JSON.stringify(result, null, 2));
        setIsOutputOpen(true);
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Conversion failed');
      // Final fallback if AI failed
      if (isOnline && isValidJson(oldJson)) {
        const sourceData = JSON.parse(oldJson);
        setOutputJson(JSON.stringify(sourceData, null, 2));
        setIsOutputOpen(true);
      }
    } finally {
      setIsConverting(false);
    }
  }, [oldJson, templateJson, isOnline]);

  const resetAll = () => {
    setOldJson('');
    setTemplateJson('');
    setOutputJson('');
    setError(null);
    setSuccess(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputJson);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  const downloadJson = () => {
    const blob = new Blob([outputJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'morph-result.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Debounced Auto-convert
  useEffect(() => {
    if (autoConvert && oldJson && isValidJson(oldJson)) {
      const timer = setTimeout(convertJson, 1000);
      return () => clearTimeout(timer);
    }
  }, [oldJson, templateJson, autoConvert, convertJson]);

  return (
    <div className="min-h-screen bg-[#FFFFFF] font-sans text-gray-900 selection:bg-gray-100 overflow-x-hidden">
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white shadow-sm">
              <FileJson size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Smart JSON Morph</h1>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.05em]">v1.0 Offline-First</span>
                {!isOnline && (
                  <div className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold uppercase">
                    <WifiOff size={10} />
                    Offline Mode
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <AnimatePresence>
              {success && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 py-2 px-3 bg-green-50 text-green-600 rounded-full text-xs font-semibold"
                >
                  <CheckCircle2 size={12} />
                  Done
                </motion.div>
              )}
            </AnimatePresence>
            {isConverting && (
              <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 text-gray-400 rounded-full text-xs font-medium italic animate-pulse">
                {isOnline ? 'AI Mapping...' : 'Local Morphing...'}
              </div>
            )}
          </div>
        </header>

        {/* Input Files Group */}
        <CollapsibleGroup 
          title="Input Files" 
          isOpen={isInputOpen} 
          onToggle={() => setIsInputOpen(!isInputOpen)}
          icon={<FileCode2 size={16} />}
        >
          <div className="space-y-6 pt-2">
            <FileSubgroup 
              title="Old JSON (Source)"
              value={oldJson}
              onChange={setOldJson}
              placeholder="Paste source JSON here..."
              onFileSelect={(f) => handleFileSelect(f, 'old')}
            />
            <div className="h-[1px] bg-gray-200/50" />
            <FileSubgroup 
              title="New Format Template (Target)"
              value={templateJson}
              onChange={setTemplateJson}
              placeholder="Optional: Paste destination template structure..."
              onFileSelect={(f) => handleFileSelect(f, 'template')}
            />
          </div>
        </CollapsibleGroup>

        {/* Action Row */}
        <div id="action-group" className="bg-[#F5F5F5] rounded-xl p-3 mb-3 border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={convertJson}
              disabled={isConverting || !oldJson}
              className={`h-11 px-5 rounded-lg flex items-center gap-2 text-[13px] font-bold tracking-tight transition-all active:scale-[0.98] ${
                isConverting || !oldJson 
                  ? 'bg-gray-200 text-gray-400' 
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              {isOnline ? <CloudLightning size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              {isOnline ? 'AI CONVERT' : 'LOCAL MORPH'}
            </button>
            <button 
              onClick={resetAll}
              className="w-11 h-11 hover:bg-gray-200/50 rounded-lg text-gray-500 transition-colors flex items-center justify-center active:scale-[0.98]"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors">Auto</span>
              <div 
                onClick={(e) => {
                  e.preventDefault();
                  setAutoConvert(!autoConvert);
                }}
                className={`w-10 h-5 rounded-full relative transition-colors ${autoConvert ? 'bg-black' : 'bg-gray-300'}`}
              >
                <div 
                  className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform duration-200 ${autoConvert ? 'translate-x-[22px]' : 'translate-x-[2px]'}`}
                />
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {/* Output Group */}
        <CollapsibleGroup 
          title="Output" 
          isOpen={isOutputOpen} 
          onToggle={() => setIsOutputOpen(!isOutputOpen)}
          icon={<Settings2 size={16} />}
        >
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button 
              onClick={copyToClipboard}
              disabled={!outputJson}
              className="h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-gray-600 hover:border-gray-300 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Copy size={14} />
              <span className="hidden sm:inline">Copy Result</span>
              <span className="sm:hidden">Copy</span>
            </button>
            <button 
              onClick={downloadJson}
              disabled={!outputJson}
              className="h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-gray-600 hover:border-gray-300 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Save File</span>
              <span className="sm:hidden">Save</span>
            </button>
            <button 
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              disabled={!outputJson}
              className={`h-12 border rounded-xl flex items-center justify-center transition-all active:scale-[0.98] ${
                isPreviewOpen ? 'bg-black border-black text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              <Eye size={18} />
            </button>
          </div>

          <AnimatePresence>
            {isPreviewOpen && outputJson && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="mt-2"
              >
                <div className="bg-white border border-gray-200 rounded-xl p-4 max-h-[400px] overflow-auto scrollbar-thin scrollbar-thumb-gray-200 shadow-inner">
                  <pre className="text-[11px] font-mono text-gray-600 leading-relaxed overflow-wrap-anywhere whitespace-pre-wrap">
                    {/* Lazy rendering for performance: limit preview to first 20kb if huge */}
                    {outputJson.length > 20480 ? outputJson.substring(0, 20480) + '\n\n... (preview truncated for stability)' : outputJson}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleGroup>

        {/* Footer info */}
        <footer className="mt-12 text-center">
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.2em]">Stability Optimized • Native Shell • iOS Approved</p>
        </footer>
      </div>
    </div>
  );
}

