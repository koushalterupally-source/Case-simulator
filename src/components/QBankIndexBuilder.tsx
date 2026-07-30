import React, { useState } from 'react';
import { Layers, Search, Filter, Sparkles, Download, Copy, Check, Plus, BookOpen, FileText, Code } from 'lucide-react';
import { PYQItem, SubjectType, RoleTag } from '../types';

interface QBankIndexBuilderProps {
  pyqList: PYQItem[];
  onUpdatePyqList: (newList: PYQItem[]) => void;
  onParseRawText: (rawText: string) => Promise<void>;
  isParsing: boolean;
}

export const QBankIndexBuilder: React.FC<QBankIndexBuilderProps> = ({
  pyqList,
  onUpdatePyqList,
  onParseRawText,
  isParsing,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [rawInputText, setRawInputText] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredItems = pyqList.filter((item) => {
    const matchesSearch =
      item.qid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.stem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.conceptTested.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubject = subjectFilter === 'All' || item.subject === subjectFilter;
    const matchesRole = roleFilter === 'All' || item.roleTag === roleFilter;

    return matchesSearch && matchesSubject && matchesRole;
  });

  const handleCopyMarkdownIndex = () => {
    const mdTable = `| QID | Exam | Year | Subject | System | Topic | Stem | Options | Correct Answer | Concept tested | Role tag |\n|---|---|---|---|---|---|---|---|---|---|---|\n` +
      filteredItems.map(q => 
        `| ${q.qid} | ${q.exam} | ${q.year} | ${q.subject} | ${q.system} | ${q.topic} | ${q.stem.slice(0, 60)}... | A:${q.options.A} B:${q.options.B} C:${q.options.C} D:${q.options.D} | ${q.correctAnswer} | ${q.conceptTested} | ${q.roleTag} |`
      ).join('\n');

    navigator.clipboard.writeText(mdTable);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(pyqList, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INDEX_Medtrix_PYQs.json`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner & Part 1 Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600/20 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/30">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white font-sans">
                Part 1 — PYQ Question Bank Indexer & Parser
              </h2>
              <p className="text-xs text-slate-400">
                Pre-indexed NEET-PG & INI-CET Question Bank (2015-2024). Add custom QBank text to auto-index.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyMarkdownIndex}
              className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Markdown' : 'Copy Index (.md)'}</span>
            </button>

            <button
              onClick={handleExportJson}
              className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON Index</span>
            </button>
          </div>
        </div>

        {/* Index Parsing Input */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
          <label className="block text-xs font-mono font-bold text-indigo-300 uppercase tracking-wider">
            ➕ Add Custom QBank Text / PDF Raw Snippet to AI Indexer
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              value={rawInputText}
              onChange={(e) => setRawInputText(e.target.value)}
              placeholder="Paste raw question bank text from Medtrix / PDF / DOCX... (e.g., '1. A 54yo male presents with ACS... Options: A... B... Answer: A')"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 h-20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={async () => {
                if (!rawInputText.trim()) return;
                await onParseRawText(rawInputText);
                setRawInputText('');
              }}
              disabled={!rawInputText.trim() || isParsing}
              className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-medium px-4 py-2 rounded-lg text-xs shadow transition flex items-center justify-center space-x-2 disabled:opacity-50 whitespace-nowrap self-end sm:self-auto cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isParsing ? 'Parsing Index...' : 'Run Index Pass'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by QID, topic, stem, or concept..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">Subject:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="All">All Subjects</option>
              <option value="Medicine">Medicine</option>
              <option value="Surgery">Surgery</option>
              <option value="OBGY">OBGY</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Pharmacology">Pharmacology</option>
              <option value="Pathology">Pathology</option>
              <option value="PSM">PSM</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Role Tag:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none"
            >
              <option value="All">All Roles</option>
              <option value="EMERGENCY">EMERGENCY</option>
              <option value="DIAGNOSIS">DIAGNOSIS</option>
              <option value="INVESTIGATION">INVESTIGATION</option>
              <option value="MANAGEMENT">MANAGEMENT</option>
              <option value="PHARM">PHARM</option>
              <option value="COMPLICATION">COMPLICATION</option>
              <option value="PREVENTION">PREVENTION</option>
            </select>
          </div>
        </div>

      </div>

      {/* Structured PYQ Index Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
              <th className="p-3">QID</th>
              <th className="p-3">Exam/Year</th>
              <th className="p-3">Subject/System</th>
              <th className="p-3">Role Tag</th>
              <th className="p-3 max-w-xs">Question Stem (Snippet)</th>
              <th className="p-3">Correct Ans</th>
              <th className="p-3 max-w-xs">Concept Tested</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans text-slate-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500 font-mono">
                  No indexed PYQ questions found matching search criteria.
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/50 transition">
                  <td className="p-3 font-mono font-bold text-indigo-400 whitespace-nowrap">
                    {item.qid}
                  </td>
                  <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                    {item.exam} {item.year}
                  </td>
                  <td className="p-3 font-mono text-slate-300 whitespace-nowrap">
                    {item.subject} ({item.system})
                  </td>
                  <td className="p-3 font-mono whitespace-nowrap">
                    <span className="bg-slate-800 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold text-[10px]">
                      {item.roleTag}
                    </span>
                  </td>
                  <td className="p-3 max-w-xs truncate text-slate-300">
                    {item.stem}
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-400 text-center">
                    {item.correctAnswer}
                  </td>
                  <td className="p-3 max-w-xs text-slate-300 truncate">
                    {item.conceptTested}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
