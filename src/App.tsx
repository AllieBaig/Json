/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  FileCode2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
      className="w-full flex items-center justify-between p-4 h-12 hover:bg-gray-100/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-sm font-medium text-gray-700">{title}</span>
      </div>
      {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
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
    if (file && file.type === 'application/json') {
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
          {/* Action Row */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer"
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isValidJson = (str: string) => {
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

  const convertJson = async () => {
    if (!oldJson) {
      setError('Source JSON is required');
      return;
    }
    setError(null);
    setSuccess(false);
    setIsConverting(true);

    try {
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
        throw new Error("Generated content is not valid JSON");
      }
    } catch (err: any) {
      setError(err.message || 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  };

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
  };

  // Auto-convert logic
  useEffect(() => {
    if (autoConvert && oldJson && (templateJson || oldJson.length > 20)) {
      const timer = setTimeout(convertJson, 1000);
      return () => clearTimeout(timer);
    }
  }, [oldJson, templateJson, autoConvert]);

  return (
    <div className="min-h-screen bg-[#FFFFFF] font-sans text-gray-900 selection:bg-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center text-white">
              <FileJson size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Smart JSON Morph</h1>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-[0.05em]">System-Following Utility</p>
            </div>
          </div>
          <div className="flex gap-2">
            {success && (
              <motion.div 
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 py-2 px-3 bg-green-50 text-green-600 rounded-full text-xs font-medium"
              >
                <CheckCircle2 size={12} />
                Saved
              </motion.div>
            )}
            {isConverting && (
              <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 text-gray-400 rounded-full text-xs font-medium italic animate-pulse">
                Processing...
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
              title="New Format Template (Schema)"
              value={templateJson}
              onChange={setTemplateJson}
              placeholder="Optional: Paste destination template structure..."
              onFileSelect={(f) => handleFileSelect(f, 'template')}
            />
          </div>
        </CollapsibleGroup>

        {/* Action Row */}
        <div id="action-group" className="bg-[#F5F5F5] rounded-xl p-3 mb-3 border border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={convertJson}
              disabled={isConverting || !oldJson}
              className={`h-10 px-4 rounded-lg flex items-center gap-2 text-xs font-semibold transition-all ${
                isConverting || !oldJson 
                  ? 'bg-gray-200 text-gray-400' 
                  : 'bg-black text-white hover:bg-gray-800'
              }`}
            >
              <Play size={14} fill="currentColor" />
              CONVERT
            </button>
            <button 
              onClick={resetAll}
              className="h-10 px-3 hover:bg-gray-200/50 rounded-lg text-gray-500 transition-colors"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">Auto</span>
              <div 
                onClick={() => setAutoConvert(!autoConvert)}
                className={`w-10 h-5 rounded-full relative transition-colors ${autoConvert ? 'bg-black' : 'bg-gray-300'}`}
              >
                <motion.div 
                  animate={{ x: autoConvert ? 22 : 2 }}
                  className="w-4 h-4 bg-white rounded-full absolute top-0.5"
                />
              </div>
            </label>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600"
          >
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            <span className="text-xs font-medium leading-relaxed">{error}</span>
          </motion.div>
        )}

        {/* Output Group */}
        <CollapsibleGroup 
          title="Output" 
          isOpen={isOutputOpen} 
          onToggle={() => setIsOutputOpen(!isOutputOpen)}
          icon={<Settings2 size={16} />}
        >
          <div className="flex gap-2 mb-4">
            <button 
              onClick={copyToClipboard}
              disabled={!outputJson}
              className="flex-1 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-gray-600 hover:border-gray-300 transition-all disabled:opacity-50"
            >
              <Copy size={14} />
              Copy JSON
            </button>
            <button 
              onClick={downloadJson}
              disabled={!outputJson}
              className="flex-1 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center gap-2 text-xs font-medium text-gray-600 hover:border-gray-300 transition-all disabled:opacity-50"
            >
              <Download size={14} />
              Download
            </button>
            <button 
              onClick={() => setIsPreviewOpen(!isPreviewOpen)}
              disabled={!outputJson}
              className={`w-12 h-12 border rounded-xl flex items-center justify-center transition-all ${
                isPreviewOpen ? 'bg-black border-black text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              <Eye size={18} />
            </button>
          </div>

          <AnimatePresence>
            {isPreviewOpen && outputJson && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2"
              >
                <div className="bg-white border border-gray-200 rounded-xl p-4 max-h-[400px] overflow-auto scrollbar-thin scrollbar-thumb-gray-200">
                  <pre className="text-xs font-mono text-gray-600 leading-relaxed">
                    {outputJson}
                  </pre>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleGroup>

        {/* Footer info */}
        <footer className="mt-12 text-center">
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-[0.2em]">Crafted with Precision & AI Mapping</p>
        </footer>
      </div>
    </div>
  );
}
