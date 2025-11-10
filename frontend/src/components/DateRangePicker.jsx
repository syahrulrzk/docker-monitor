import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const DateRangePicker = ({ onDateChange }) => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(formatDate(thirtyDaysAgo));
  const [endDate, setEndDate] = useState(formatDate(today));
  const [isExpanded, setIsExpanded] = useState(false);

  const handleStartChange = (e) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    onDateChange(newStart, endDate);
  };

  const handleEndChange = (e) => {
    const newEnd = e.target.value;
    setEndDate(newEnd);
    onDateChange(startDate, newEnd);
  };

  const setPreset = (days) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    setStartDate(startStr);
    setEndDate(endStr);
    onDateChange(startStr, endStr);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden transition-all duration-300">
      {/* Collapsed Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-white">Date Range Filter</h3>
            <p className="text-xs text-slate-400">
              {new Date(startDate).toLocaleDateString('en-GB')} - {new Date(endDate).toLocaleDateString('en-GB')}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 hidden md:block">Click to {isExpanded ? 'collapse' : 'expand'}</span>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 pb-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2 font-semibold">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={handleStartChange}
                max={endDate}
                min={formatDate(thirtyDaysAgo)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2 font-semibold">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={handleEndChange}
                min={startDate}
                max={formatDate(today)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPreset(1)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition font-semibold"
            >
              Last 24h
            </button>
            <button
              onClick={() => setPreset(7)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition font-semibold"
            >
              Last 7 days
            </button>
            <button
              onClick={() => setPreset(14)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition font-semibold"
            >
              Last 14 days
            </button>
            <button
              onClick={() => setPreset(30)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg text-sm text-white transition font-semibold"
            >
              Last 30 days
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateRangePicker;
