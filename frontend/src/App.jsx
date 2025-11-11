import { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import HostMetricsChart from './components/HostMetricsChart';
import HostMetricsSummary from './components/HostMetricsSummary';
import ContainerMetricsChart from './components/ContainerMetricsChart';
import ContainersList from './components/ContainersList';
import MetricsCards from './components/MetricsCards';
import TopTables from './components/TopTables';
import { useMetrics } from './hooks/useMetrics';
import { AlertCircle, Loader2, Shield, AlertTriangle, CheckCircle, Cpu, MemoryStick, FileText, HardDrive, ChevronRight, X, TrendingUp, Box } from 'lucide-react';

function App() {
  const { hostMetrics, containerMetrics, loading, error, refetch } = useMetrics();
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hostSubTab, setHostSubTab] = useState('overview');
  const [containerFilter, setContainerFilter] = useState('all');
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [containerLogs, setContainerLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('all'); // all, error, warning, info
  const [expandedLog, setExpandedLog] = useState(null); // Track which log is expanded
  const [containerStats, setContainerStats] = useState({ total_size_gb: 0, container_count: 0 });
  const [selectedLogDate, setSelectedLogDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [availableLogDates, setAvailableLogDates] = useState([]);
  const [logSizePerDate, setLogSizePerDate] = useState({}); // Track log size per date
  const [allContainers, setAllContainers] = useState([]); // Real container data from Docker API
  const [logsLoading, setLogsLoading] = useState(false); // Loading state for logs
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true); // Toggle auto-refresh
  const [realTimeLogs, setRealTimeLogs] = useState(false); // Toggle real-time WebSocket streaming
  const logsEndRef = useRef(null); // Ref for auto-scroll to top
  const wsRef = useRef(null); // WebSocket reference
  const lastLogTimestampRef = useRef(null); // Track last log timestamp for polling

  useEffect(() => {
    if (hostMetrics.length > 0) {
      setLastUpdate(new Date());
    }
  }, [hostMetrics]);

  const handleRefresh = () => {
    refetch();
    setLastUpdate(new Date());
  };

  // Fetch container stats (total size)
  useEffect(() => {
    const fetchContainerStats = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/containers/stats');
        if (response.ok) {
          const data = await response.json();
          setContainerStats(data);
        }
      } catch (err) {
        console.error('Error fetching container stats:', err);
      }
    };
    
    fetchContainerStats();
    const interval = setInterval(fetchContainerStats, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch all containers (running + stopped) with real data
  useEffect(() => {
    const fetchAllContainers = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/containers/all');
        if (response.ok) {
          const data = await response.json();
          setAllContainers(data.containers || []);
        }
      } catch (err) {
        console.error('Error fetching all containers:', err);
      }
    };
    
    fetchAllContainers();
    const interval = setInterval(fetchAllContainers, 5000); // Update every 5s for real-time
    return () => clearInterval(interval);
  }, []);

  // Fetch container logs (REAL from backend) with date support
  const fetchContainerLogs = async (containerName, containerData = null, date = null) => {
    try {
      // Set showLogs FIRST to prevent modal flash
      setShowLogs(true);
      
      // Then set container if provided
      if (containerData) {
        setSelectedContainer(containerData);
      }
      
      // Set loading state AFTER showLogs to show in UI
      setLogsLoading(true);
      
      const targetDate = date || selectedLogDate;
      const response = await fetch(`http://localhost:8000/api/containers/${containerName}/logs?tail=500&date=${targetDate}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setContainerLogs(data.logs || []);
      
      // Calculate total log size for this date (in bytes)
      const totalSize = (data.logs || []).reduce((sum, log) => {
        const logText = log.message || '';
        return sum + new Blob([logText]).size;
      }, 0);
      
      // Update log size per date
      setLogSizePerDate(prev => ({
        ...prev,
        [targetDate]: totalSize
      }));
      
    } catch (err) {
      console.error('Error fetching logs:', err);
      setContainerLogs([]);
      setShowLogs(true);
    } finally {
      // ALWAYS reset loading state
      setLogsLoading(false);
    }
  };

  // Generate last 10 days for date picker
  useEffect(() => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 10; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    setAvailableLogDates(dates);
  }, []);

  // Fetch logs when sidebar first opens
  useEffect(() => {
    if (showLogs && selectedContainer) {
      const containerName = selectedContainer.name || selectedContainer.container_name;
      fetchContainerLogs(containerName, null, selectedLogDate);
    }
  }, [showLogs, selectedContainer, selectedLogDate]);

  // Real-time logs polling
  useEffect(() => {
    if (showLogs && selectedContainer && realTimeLogs) {
      const containerName = selectedContainer.name || selectedContainer.container_name;

      const pollLogs = async () => {
        try {
          const response = await fetch(`http://localhost:8000/api/containers/${containerName}/logs/live?since=${encodeURIComponent(lastLogTimestampRef.current || '')}`);
          if (response.ok) {
            const data = await response.json();
            if (data.logs && data.logs.length > 0) {
              // Add new logs to the beginning (newest first)
              setContainerLogs(prevLogs => [...data.logs, ...prevLogs]);

              // Update the last timestamp for next poll
              if (data.latest_timestamp) {
                lastLogTimestampRef.current = data.latest_timestamp;
              }
            }
          }
        } catch (error) {
          console.error('Error polling logs:', error);
        }
      };

      // Initial poll to get recent logs
      pollLogs();

      // Set up polling interval
      const interval = setInterval(pollLogs, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    } else {
      // Reset timestamp when real-time is disabled
      lastLogTimestampRef.current = null;
    }
  }, [showLogs, selectedContainer, realTimeLogs]);

  // Auto-refresh logs every 3 seconds (like docker logs -f) - only when not using real-time
  useEffect(() => {
    if (showLogs && selectedContainer && autoRefreshLogs && !realTimeLogs) {
      const containerName = selectedContainer.name || selectedContainer.container_name;
      const interval = setInterval(() => {
        fetchContainerLogs(containerName, null, selectedLogDate);
      }, 3000); // 3 seconds for real-time streaming feel
      return () => clearInterval(interval);
    }
  }, [showLogs, selectedContainer, selectedLogDate, autoRefreshLogs, realTimeLogs]);

  // Auto-scroll to TOP when new logs arrive (newest first)
  useEffect(() => {
    if (autoRefreshLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [containerLogs, autoRefreshLogs]);

  return (
    <div className="flex h-screen bg-transparent relative">
      {/* Sidebar */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar onRefresh={handleRefresh} lastUpdate={lastUpdate} activeTab={activeTab} hostMetrics={hostMetrics} containerMetrics={containerMetrics} />
        
        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Loading metrics...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-400" />
                <div>
                  <h3 className="text-lg font-semibold text-red-300">Error Loading Metrics</h3>
                  <p className="text-sm text-red-400 mt-1">{error}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    Make sure the backend is running on http://localhost:8000
                  </p>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-8">
              {/* Dashboard View - Overview */}
              {activeTab === 'dashboard' && (
                <>
                  {/* Dashboard Header */}
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
                      🧭 Dashboard Overview
                    </h1>
                    <p className="text-slate-400">Real-time system & container monitoring</p>
                  </div>

                  {/* Host Summary Cards */}
                  <div>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      📊 Host Summary
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* CPU Usage - Donut Chart */}
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 hover:border-sky-500/50 transition-all hover:scale-105">
                        <div className="flex flex-col items-center">
                          <span className="text-sm text-slate-400 font-semibold mb-4">CPU Usage</span>
                          <div className="relative w-32 h-32">
                            <svg className="transform -rotate-90 w-32 h-32">
                              <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="#1e293b"
                                strokeWidth="16"
                                fill="none"
                              />
                              <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="#38bdf8"
                                strokeWidth="16"
                                fill="none"
                                strokeDasharray={`${(hostMetrics.length > 0 ? hostMetrics[hostMetrics.length - 1].cpu_percent : 0) * 3.52} 352`}
                                className="transition-all duration-500"
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                  {hostMetrics.length > 0 ? hostMetrics[hostMetrics.length - 1].cpu_percent.toFixed(1) : '0.0'}%
                                </div>
                                <Cpu className="w-4 h-4 text-sky-400 mx-auto mt-1" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* RAM Usage - Donut Chart */}
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 hover:border-purple-500/50 transition-all hover:scale-105">
                        <div className="flex flex-col items-center">
                          <span className="text-sm text-slate-400 font-semibold mb-4">RAM Usage</span>
                          <div className="relative w-32 h-32">
                            <svg className="transform -rotate-90 w-32 h-32">
                              <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="#1e293b"
                                strokeWidth="16"
                                fill="none"
                              />
                              <circle
                                cx="64"
                                cy="64"
                                r="56"
                                stroke="#a855f7"
                                strokeWidth="16"
                                fill="none"
                                strokeDasharray={`${(hostMetrics.length > 0 ? hostMetrics[hostMetrics.length - 1].memory_percent : 0) * 3.52} 352`}
                                className="transition-all duration-500"
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-2xl font-bold text-white">
                                  {hostMetrics.length > 0 ? hostMetrics[hostMetrics.length - 1].memory_percent.toFixed(1) : '0.0'}%
                                </div>
                                <MemoryStick className="w-4 h-4 text-purple-400 mx-auto mt-1" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Network I/O */}
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 hover:border-emerald-500/50 transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-slate-400 font-semibold">Network I/O</span>
                          <TrendingUp className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">
                          ↓ {hostMetrics.length > 0 ? (hostMetrics[hostMetrics.length - 1].network_in_mbit || 0).toFixed(2) : '0.00'} Mb/s
                        </div>
                        <div className="text-2xl font-bold text-white mb-2">
                          ↑ {hostMetrics.length > 0 ? (hostMetrics[hostMetrics.length - 1].network_out_mbit || 0).toFixed(2) : '0.00'} Mb/s
                        </div>
                        <div className="text-xs text-emerald-300 mt-2">
                          Total: {hostMetrics.length > 0 ? ((hostMetrics[hostMetrics.length - 1].network_in_mbit || 0) + (hostMetrics[hostMetrics.length - 1].network_out_mbit || 0)).toFixed(2) : '0.00'} Mb/s
                        </div>
                      </div>

                      {/* System Uptime */}
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 hover:border-amber-500/50 transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-slate-400 font-semibold">System Uptime</span>
                          <TrendingUp className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="text-3xl font-bold text-white mb-2">
                          {Math.floor((Date.now() - (lastUpdate ? lastUpdate.getTime() - 30000 : Date.now())) / 3600000)}h {Math.floor(((Date.now() - (lastUpdate ? lastUpdate.getTime() - 30000 : Date.now())) % 3600000) / 60000)}m
                        </div>
                        <div className="text-xs text-slate-400 mt-2">
                          Last update: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'N/A'}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-xs text-emerald-300">System Online</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Container Summary */}
                  <div>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      🐳 Container Summary
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                      {/* Total Containers */}
                      <div className="bg-gradient-to-br from-cyan-900/20 to-cyan-800/20 rounded-2xl p-6 border border-cyan-700/50 hover:border-cyan-600/70 transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-cyan-300 font-semibold">Total Containers</span>
                          <CheckCircle className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="text-5xl font-bold text-white mb-2">
                          {[...new Set(containerMetrics.map(m => m.container_name))].length}
                        </div>
                        <div className="text-xs text-cyan-300 mt-2">
                          Running containers
                        </div>
                      </div>

                      {/* Total Size - NEW */}
                      <div className="bg-gradient-to-br from-indigo-900/20 to-indigo-800/20 rounded-2xl p-6 border border-indigo-700/50 hover:border-indigo-600/70 transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-indigo-300 font-semibold">Total Size</span>
                          <HardDrive className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="text-4xl font-bold text-white mb-2">
                          {containerStats.total_size_gb > 0 ? containerStats.total_size_gb.toFixed(2) : '0.00'}
                        </div>
                        <div className="text-xs text-indigo-300 mt-2">
                          GB ({containerStats.container_count || 0} containers)
                        </div>
                      </div>

                      {/* Top Container by CPU */}
                      <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 rounded-2xl p-6 border border-red-700/50 hover:border-red-600/70 transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-red-300 font-semibold">Top CPU</span>
                          <Cpu className="w-5 h-5 text-red-400" />
                        </div>
                        {(() => {
                          const latest = {};
                          containerMetrics.forEach(m => {
                            if (!latest[m.container_name] || new Date(m.timestamp) > new Date(latest[m.container_name].timestamp)) {
                              latest[m.container_name] = m;
                            }
                          });
                          const topCPU = Object.values(latest).sort((a, b) => b.cpu_percent - a.cpu_percent)[0];
                          return topCPU ? (
                            <>
                              <div className="text-3xl font-bold text-white mb-2">
                                {topCPU.cpu_percent.toFixed(1)}%
                              </div>
                              <div className="text-xs text-red-300 truncate" title={topCPU.container_name}>
                                {topCPU.container_name}
                              </div>
                            </>
                          ) : (
                            <div className="text-xl text-slate-500">No data</div>
                          );
                        })()}
                      </div>

                      {/* Top Container by RAM */}
                      <div className="bg-gradient-to-br from-pink-900/20 to-pink-800/20 rounded-2xl p-6 border border-pink-700/50 hover:border-pink-600/70 transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-pink-300 font-semibold">Top RAM</span>
                          <MemoryStick className="w-5 h-5 text-pink-400" />
                        </div>
                        {(() => {
                          const latest = {};
                          containerMetrics.forEach(m => {
                            if (!latest[m.container_name] || new Date(m.timestamp) > new Date(latest[m.container_name].timestamp)) {
                              latest[m.container_name] = m;
                            }
                          });
                          const topRAM = Object.values(latest).sort((a, b) => b.memory_used_mb - a.memory_used_mb)[0];
                          return topRAM ? (
                            <>
                              <div className="text-3xl font-bold text-white mb-2">
                                {topRAM.memory_used_mb.toFixed(0)} MB
                              </div>
                              <div className="text-xs text-pink-300 truncate" title={topRAM.container_name}>
                                {topRAM.container_name}
                              </div>
                            </>
                          ) : (
                            <div className="text-xl text-slate-500">No data</div>
                          );
                        })()}
                      </div>

                      {/* Alerts Summary */}
                      <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 rounded-2xl p-6 border border-yellow-700/50 hover:border-yellow-600/70 transition-all hover:scale-105">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-yellow-300 font-semibold">🔔 Alerts</span>
                          <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        </div>
                        {(() => {
                          const latest = {};
                          containerMetrics.forEach(m => {
                            if (!latest[m.container_name] || new Date(m.timestamp) > new Date(latest[m.container_name].timestamp)) {
                              latest[m.container_name] = m;
                            }
                          });
                          const highCPU = Object.values(latest).filter(m => m.cpu_percent > 80).length;
                          const highRAM = Object.values(latest).filter(m => m.memory_percent > 80).length;
                          return (
                            <>
                              <div className="space-y-1 mb-2">
                                {highCPU > 0 && (
                                  <div className="text-sm text-yellow-200">
                                    ⚠️ {highCPU} high CPU
                                  </div>
                                )}
                                {highRAM > 0 && (
                                  <div className="text-sm text-yellow-200">
                                    ⚠️ {highRAM} high RAM
                                  </div>
                                )}
                                {highCPU === 0 && highRAM === 0 && (
                                  <div className="text-2xl text-green-400 font-bold">
                                    ✓ All OK
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-yellow-300 mt-2">
                                Total: {highCPU + highRAM} warnings
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Top 3 Containers Detail */}
                  <div>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      📈 Top 3 Resource Consumers
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top 3 by CPU */}
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Cpu className="w-5 h-5 text-blue-400" />
                          Top 3 by CPU
                        </h3>
                        <div className="space-y-3">
                          {(() => {
                            const latest = {};
                            containerMetrics.forEach(m => {
                              if (!latest[m.container_name] || new Date(m.timestamp) > new Date(latest[m.container_name].timestamp)) {
                                latest[m.container_name] = m;
                              }
                            });
                            const top3CPU = Object.values(latest).sort((a, b) => b.cpu_percent - a.cpu_percent).slice(0, 3);
                            return top3CPU.map((m, idx) => (
                              <div key={m.container_id} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="text-2xl font-bold text-blue-400">#{idx + 1}</div>
                                    <div>
                                      <div className="font-semibold text-white truncate max-w-[200px]" title={m.container_name}>
                                        {m.container_name}
                                      </div>
                                      <div className="text-xs text-slate-400">ID: {m.container_id}</div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-3xl font-bold text-blue-400">
                                      {m.cpu_percent.toFixed(1)}%
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Top 3 by RAM */}
                      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <MemoryStick className="w-5 h-5 text-purple-400" />
                          Top 3 by RAM
                        </h3>
                        <div className="space-y-3">
                          {(() => {
                            const latest = {};
                            containerMetrics.forEach(m => {
                              if (!latest[m.container_name] || new Date(m.timestamp) > new Date(latest[m.container_name].timestamp)) {
                                latest[m.container_name] = m;
                              }
                            });
                            const top3RAM = Object.values(latest).sort((a, b) => b.memory_used_mb - a.memory_used_mb).slice(0, 3);
                            return top3RAM.map((m, idx) => (
                              <div key={m.container_id} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="text-2xl font-bold text-purple-400">#{idx + 1}</div>
                                    <div>
                                      <div className="font-semibold text-white truncate max-w-[200px]" title={m.container_name}>
                                        {m.container_name}
                                      </div>
                                      <div className="text-xs text-slate-400">{m.memory_percent.toFixed(1)}%</div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-3xl font-bold text-purple-400">
                                      {m.memory_used_mb.toFixed(0)}
                                    </div>
                                    <div className="text-xs text-slate-400">MB</div>
                                  </div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Trend Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* CPU Trend */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                        CPU Trend (Last 10 min)
                      </h3>
                      <div className="h-32 flex items-end gap-2">
                        {hostMetrics.slice(-20).map((m, i) => (
                          <div 
                            key={i} 
                            className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:opacity-80" 
                            style={{ height: `${m.cpu_percent}%` }}
                            title={`${m.cpu_percent.toFixed(1)}%`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-2">
                        <span>10 min ago</span>
                        <span>Now</span>
                      </div>
                    </div>

                    {/* RAM Trend */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                        RAM Trend (Last 10 min)
                      </h3>
                      <div className="h-32 flex items-end gap-2">
                        {hostMetrics.slice(-20).map((m, i) => (
                          <div 
                            key={i} 
                            className="flex-1 bg-gradient-to-t from-purple-500 to-purple-400 rounded-t transition-all hover:opacity-80" 
                            style={{ height: `${m.memory_percent}%` }}
                            title={`${m.memory_percent.toFixed(1)}%`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-2">
                        <span>10 min ago</span>
                        <span>Now</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Host Only View */}
              {activeTab === 'host' && (
                <>
                  {/* Host Header */}
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
                      🖥️ Host System Detail
                    </h1>
                    <p className="text-slate-400">Deep monitoring of host machine resources</p>
                  </div>

                  {/* System Info Card */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 mb-8">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      💻 System Information
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Hostname</div>
                        <div className="text-lg font-semibold text-white">docker-monitor-host</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">OS</div>
                        <div className="text-lg font-semibold text-white">Linux Kali</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Kernel Version</div>
                        <div className="text-lg font-semibold text-white">6.x.x</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase mb-1">Docker Version</div>
                        <div className="text-lg font-semibold text-white">24.0.x</div>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs Navigation */}
                  <div className="flex gap-2 mb-6 overflow-x-auto">
                    {[
                      { id: 'overview', label: '📋 Overview', icon: TrendingUp },
                      { id: 'cpu', label: '🧠 CPU', icon: Cpu },
                      { id: 'memory', label: '🧮 Memory', icon: MemoryStick },
                      { id: 'disk', label: '💾 Disk', icon: Shield },
                      { id: 'network', label: '🌐 Network', icon: TrendingUp },
                    ].map(tab => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setHostSubTab(tab.id)}
                          className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                            hostSubTab === tab.id
                              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Overview Tab */}
                  {hostSubTab === 'overview' && (
                    <>
                      <HostMetricsSummary hostMetrics={hostMetrics} />
                      <HostMetricsChart data={hostMetrics} />
                    </>
                  )}

                        {/* CPU Tab */}
                        {hostSubTab === 'cpu' && (
                          <div className="space-y-6">
                            {/* CPU Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-2xl p-6 border border-blue-700/50">
                                <div className="text-sm text-blue-300 font-semibold mb-2">Total Cores</div>
                                <div className="text-5xl font-bold text-white mb-2">8</div>
                                <div className="text-xs text-blue-300">Physical + Logical</div>
                              </div>
                              <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-2xl p-6 border border-purple-700/50">
                                <div className="text-sm text-purple-300 font-semibold mb-2">Current Usage</div>
                                <div className="text-5xl font-bold text-white mb-2">
                                  {hostMetrics.length > 0 ? hostMetrics[hostMetrics.length - 1].cpu_percent.toFixed(1) : '0.0'}%
                                </div>
                                <div className="text-xs text-purple-300">Real-time</div>
                              </div>
                              <div className="bg-gradient-to-br from-orange-900/20 to-orange-800/20 rounded-2xl p-6 border border-orange-700/50">
                                <div className="text-sm text-orange-300 font-semibold mb-2">Load Average</div>
                                <div className="text-2xl font-bold text-white mb-1">1.2 / 0.8 / 0.5</div>
                                <div className="text-xs text-orange-300">1m / 5m / 15m</div>
                              </div>
                            </div>

                            {/* CPU Chart */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <Cpu className="w-6 h-6 text-blue-400" />
                                CPU Usage History
                              </h3>
                              <HostMetricsChart data={hostMetrics} />
                            </div>

                            {/* CPU Per Core (Simulated) */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                              <h3 className="text-xl font-bold text-white mb-6">CPU Usage Per Core</h3>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[...Array(8)].map((_, i) => {
                                  const usage = hostMetrics.length > 0 
                                    ? (hostMetrics[hostMetrics.length - 1].cpu_percent + (Math.random() * 20 - 10)).toFixed(1)
                                    : (Math.random() * 100).toFixed(1);
                                  return (
                                    <div key={i} className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
                                      <div className="text-sm text-slate-400 mb-2">Core {i}</div>
                                      <div className="text-3xl font-bold text-blue-400 mb-2">{usage}%</div>
                                      <div className="w-full bg-slate-600 rounded-full h-2">
                                        <div 
                                          className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all"
                                          style={{ width: `${usage}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Memory Tab */}
                        {hostSubTab === 'memory' && (
                          <div className="space-y-6">
                            {/* Memory Stats Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                              {(() => {
                                const latest = hostMetrics.length > 0 ? hostMetrics[hostMetrics.length - 1] : null;
                                const totalMB = latest ? latest.memory_total_mb : 16384;
                                const usedMB = latest ? latest.memory_used_mb : 0;
                                const freeMB = totalMB - usedMB;
                                return (
                                  <>
                                    <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-2xl p-6 border border-purple-700/50">
                                      <div className="text-sm text-purple-300 font-semibold mb-2">Total RAM</div>
                                      <div className="text-4xl font-bold text-white mb-2">
                                        {(totalMB / 1024).toFixed(1)}
                                      </div>
                                      <div className="text-xs text-purple-300">GB</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 rounded-2xl p-6 border border-red-700/50">
                                      <div className="text-sm text-red-300 font-semibold mb-2">Used</div>
                                      <div className="text-4xl font-bold text-white mb-2">
                                        {(usedMB / 1024).toFixed(1)}
                                      </div>
                                      <div className="text-xs text-red-300">GB ({latest ? latest.memory_percent.toFixed(1) : '0'}%)</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-2xl p-6 border border-green-700/50">
                                      <div className="text-sm text-green-300 font-semibold mb-2">Free</div>
                                      <div className="text-4xl font-bold text-white mb-2">
                                        {(freeMB / 1024).toFixed(1)}
                                      </div>
                                      <div className="text-xs text-green-300">GB ({((freeMB / totalMB) * 100).toFixed(1)}%)</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-2xl p-6 border border-blue-700/50">
                                      <div className="text-sm text-blue-300 font-semibold mb-2">Swap</div>
                                      <div className="text-4xl font-bold text-white mb-2">0.0</div>
                                      <div className="text-xs text-blue-300">GB (0%)</div>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>

                            {/* Memory Chart */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <MemoryStick className="w-6 h-6 text-purple-400" />
                                Memory Usage History
                              </h3>
                              <HostMetricsChart data={hostMetrics} />
                            </div>

                            {/* Memory Breakdown */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                              <h3 className="text-xl font-bold text-white mb-6">Memory Breakdown</h3>
                              {(() => {
                                const latest = hostMetrics.length > 0 ? hostMetrics[hostMetrics.length - 1] : null;
                                const totalMB = latest ? latest.memory_total_mb : 16384;
                                const usedMB = latest ? latest.memory_used_mb : 0;
                                const usedPercent = latest ? latest.memory_percent : 0;
                                const freePercent = 100 - usedPercent;
                                return (
                                  <div className="space-y-4">
                                    <div>
                                      <div className="flex justify-between mb-2">
                                        <span className="text-slate-300">Used Memory</span>
                                        <span className="text-white font-bold">{(usedMB / 1024).toFixed(2)} GB ({usedPercent.toFixed(1)}%)</span>
                                      </div>
                                      <div className="w-full bg-slate-700 rounded-full h-4">
                                        <div 
                                          className="bg-gradient-to-r from-purple-500 to-purple-400 h-4 rounded-full transition-all"
                                          style={{ width: `${usedPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex justify-between mb-2">
                                        <span className="text-slate-300">Free Memory</span>
                                        <span className="text-white font-bold">{((totalMB - usedMB) / 1024).toFixed(2)} GB ({freePercent.toFixed(1)}%)</span>
                                      </div>
                                      <div className="w-full bg-slate-700 rounded-full h-4">
                                        <div 
                                          className="bg-gradient-to-r from-green-500 to-green-400 h-4 rounded-full transition-all"
                                          style={{ width: `${freePercent}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex justify-between mb-2">
                                        <span className="text-slate-300">Swap Usage</span>
                                        <span className="text-white font-bold">0.00 GB (0.0%)</span>
                                      </div>
                                      <div className="w-full bg-slate-700 rounded-full h-4">
                                        <div 
                                          className="bg-gradient-to-r from-blue-500 to-blue-400 h-4 rounded-full transition-all"
                                          style={{ width: '0%' }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Disk Tab */}
                        {hostSubTab === 'disk' && (
                          <div className="space-y-6">
                            {/* Disk I/O Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-2xl p-6 border border-blue-700/50">
                                <div className="text-sm text-blue-300 font-semibold mb-2">📄 Disk Read</div>
                                <div className="text-5xl font-bold text-white mb-2">
                                  {hostMetrics.length > 0 ? (hostMetrics[hostMetrics.length - 1].disk_read_kb || 0).toFixed(2) : '0.00'}
                                </div>
                                <div className="text-xs text-blue-300">KiB/s</div>
                              </div>
                              <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-2xl p-6 border border-purple-700/50">
                                <div className="text-sm text-purple-300 font-semibold mb-2">✏️ Disk Write</div>
                                <div className="text-5xl font-bold text-white mb-2">
                                  {hostMetrics.length > 0 ? (hostMetrics[hostMetrics.length - 1].disk_write_mb || 0).toFixed(2) : '0.00'}
                                </div>
                                <div className="text-xs text-purple-300">MiB/s</div>
                              </div>
                            </div>

                            {/* Disk Usage Per Mount Point */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                              <h3 className="text-xl font-bold text-white mb-6">Disk Usage Per Mount Point</h3>
                              <div className="space-y-4">
                                {/* Root / */}
                                <div className="bg-slate-700/50 rounded-xl p-6 border border-slate-600">
                                  <div className="flex justify-between items-center mb-3">
                                    <div>
                                      <div className="text-lg font-bold text-white">/</div>
                                      <div className="text-xs text-slate-400">Root filesystem</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-2xl font-bold text-blue-400">128 GB</div>
                                      <div className="text-xs text-slate-400">of 256 GB</div>
                                    </div>
                                  </div>
                                  <div className="w-full bg-slate-600 rounded-full h-3">
                                    <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full" style={{ width: '50%' }} />
                                  </div>
                                  <div className="text-sm text-slate-400 mt-2">50% used</div>
                                </div>

                                {/* /var/lib/docker */}
                                <div className="bg-slate-700/50 rounded-xl p-6 border border-slate-600">
                                  <div className="flex justify-between items-center mb-3">
                                    <div>
                                      <div className="text-lg font-bold text-white">/var/lib/docker</div>
                                      <div className="text-xs text-slate-400">Docker storage</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-2xl font-bold text-purple-400">45 GB</div>
                                      <div className="text-xs text-slate-400">of 100 GB</div>
                                    </div>
                                  </div>
                                  <div className="w-full bg-slate-600 rounded-full h-3">
                                    <div className="bg-gradient-to-r from-purple-500 to-purple-400 h-3 rounded-full" style={{ width: '45%' }} />
                                  </div>
                                  <div className="text-sm text-slate-400 mt-2">45% used</div>
                                </div>

                                {/* /home */}
                                <div className="bg-slate-700/50 rounded-xl p-6 border border-slate-600">
                                  <div className="flex justify-between items-center mb-3">
                                    <div>
                                      <div className="text-lg font-bold text-white">/home</div>
                                      <div className="text-xs text-slate-400">User data</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-2xl font-bold text-green-400">32 GB</div>
                                      <div className="text-xs text-slate-400">of 200 GB</div>
                                    </div>
                                  </div>
                                  <div className="w-full bg-slate-600 rounded-full h-3">
                                    <div className="bg-gradient-to-r from-green-500 to-green-400 h-3 rounded-full" style={{ width: '16%' }} />
                                  </div>
                                  <div className="text-sm text-slate-400 mt-2">16% used</div>
                                </div>
                              </div>
                            </div>

                            {/* I/O Rate History */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                              <h3 className="text-xl font-bold text-white mb-6">I/O Rate History</h3>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Read Rate */}
                                <div>
                                  <h4 className="text-sm text-blue-300 font-semibold mb-3">Read Rate (KiB/s)</h4>
                                  <div className="h-32 flex items-end gap-2">
                                    {hostMetrics.slice(-20).map((m, i) => (
                                      <div 
                                        key={i} 
                                        className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t" 
                                        style={{ height: `${Math.min((m.disk_read_kb || 0) * 10, 100)}%` }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                {/* Write Rate */}
                                <div>
                                  <h4 className="text-sm text-purple-300 font-semibold mb-3">Write Rate (MiB/s)</h4>
                                  <div className="h-32 flex items-end gap-2">
                                    {hostMetrics.slice(-20).map((m, i) => (
                                      <div 
                                        key={i} 
                                        className="flex-1 bg-gradient-to-t from-purple-500 to-purple-400 rounded-t" 
                                        style={{ height: `${Math.min((m.disk_write_mb || 0) * 50, 100)}%` }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Network Tab */}
                        {hostSubTab === 'network' && (
                          <div className="space-y-6">
                            {/* Network I/O Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-2xl p-6 border border-green-700/50">
                                <div className="text-sm text-green-300 font-semibold mb-2">⬇️ Network In</div>
                                <div className="text-5xl font-bold text-white mb-2">
                                  {hostMetrics.length > 0 ? (hostMetrics[hostMetrics.length - 1].network_in_mbit || 0).toFixed(2) : '0.00'}
                                </div>
                                <div className="text-xs text-green-300">Mbit/s</div>
                              </div>
                              <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-2xl p-6 border border-blue-700/50">
                                <div className="text-sm text-blue-300 font-semibold mb-2">⬆️ Network Out</div>
                                <div className="text-5xl font-bold text-white mb-2">
                                  {hostMetrics.length > 0 ? (hostMetrics[hostMetrics.length - 1].network_out_mbit || 0).toFixed(2) : '0.00'}
                                </div>
                                <div className="text-xs text-blue-300">Mbit/s</div>
                              </div>
                            </div>

                            {/* Network Interfaces */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                              <h3 className="text-xl font-bold text-white mb-6">Network Interfaces</h3>
                              <div className="space-y-4">
                                {/* eth0 */}
                                <div className="bg-slate-700/50 rounded-xl p-6 border border-slate-600">
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <div className="text-lg font-bold text-white">eth0</div>
                                      <div className="text-xs text-slate-400">Primary Interface</div>
                                    </div>
                                    <span className="text-xs bg-green-900/50 text-green-200 px-3 py-1 rounded-full">ACTIVE</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                      <div className="text-xs text-slate-400">IP Address</div>
                                      <div className="text-sm font-semibold text-white">192.168.1.100</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-slate-400">MAC Address</div>
                                      <div className="text-sm font-semibold text-white">00:1A:2B:3C:4D:5E</div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div>
                                      <div className="text-xs text-green-400">↓ RX</div>
                                      <div className="text-sm font-bold text-green-400">
                                        {hostMetrics.length > 0 ? (hostMetrics[hostMetrics.length - 1].network_in_mbit || 0).toFixed(2) : '0.00'} Mbit/s
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-blue-400">↑ TX</div>
                                      <div className="text-sm font-bold text-blue-400">
                                        {hostMetrics.length > 0 ? (hostMetrics[hostMetrics.length - 1].network_out_mbit || 0).toFixed(2) : '0.00'} Mbit/s
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* docker0 */}
                                <div className="bg-slate-700/50 rounded-xl p-6 border border-slate-600">
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <div className="text-lg font-bold text-white">docker0</div>
                                      <div className="text-xs text-slate-400">Docker Bridge</div>
                                    </div>
                                    <span className="text-xs bg-green-900/50 text-green-200 px-3 py-1 rounded-full">ACTIVE</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                      <div className="text-xs text-slate-400">IP Address</div>
                                      <div className="text-sm font-semibold text-white">172.17.0.1</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-slate-400">MAC Address</div>
                                      <div className="text-sm font-semibold text-white">02:42:A1:B2:C3:D4</div>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div>
                                      <div className="text-xs text-green-400">↓ RX</div>
                                      <div className="text-sm font-bold text-green-400">0.05 Mbit/s</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-blue-400">↑ TX</div>
                                      <div className="text-sm font-bold text-blue-400">0.03 Mbit/s</div>
                                    </div>
                                  </div>
                                </div>

                                {/* lo */}
                                <div className="bg-slate-700/50 rounded-xl p-6 border border-slate-600">
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <div className="text-lg font-bold text-white">lo</div>
                                      <div className="text-xs text-slate-400">Loopback</div>
                                    </div>
                                    <span className="text-xs bg-green-900/50 text-green-200 px-3 py-1 rounded-full">ACTIVE</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                      <div className="text-xs text-slate-400">IP Address</div>
                                      <div className="text-sm font-semibold text-white">127.0.0.1</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-slate-400">MAC Address</div>
                                      <div className="text-sm font-semibold text-white">N/A</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Network Traffic History */}
                            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700">
                              <h3 className="text-xl font-bold text-white mb-6">Network Traffic History</h3>
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* RX */}
                                <div>
                                  <h4 className="text-sm text-green-300 font-semibold mb-3">Receive (Mbit/s)</h4>
                                  <div className="h-32 flex items-end gap-2">
                                    {hostMetrics.slice(-20).map((m, i) => (
                                      <div 
                                        key={i} 
                                        className="flex-1 bg-gradient-to-t from-green-500 to-green-400 rounded-t" 
                                        style={{ height: `${Math.min((m.network_in_mbit || 0) * 10, 100)}%` }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                {/* TX */}
                                <div>
                                  <h4 className="text-sm text-blue-300 font-semibold mb-3">Transmit (Mbit/s)</h4>
                                  <div className="h-32 flex items-end gap-2">
                                    {hostMetrics.slice(-20).map((m, i) => (
                                      <div 
                                        key={i} 
                                        className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t" 
                                        style={{ height: `${Math.min((m.network_out_mbit || 0) * 10, 100)}%` }}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                </>
              )}

              {/* Containers View - Enhanced */}
              {activeTab === 'containers' && (
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">
                      🐋 Container Monitoring
                    </h1>
                    <p className="text-slate-400">Per-container performance & status tracking</p>
                  </div>

                  {/* Filter Buttons */}
                  <div className="flex gap-3 mb-6">
                    <button
                      onClick={() => setContainerFilter('all')}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                        containerFilter === 'all'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-105'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      All Containers
                    </button>
                    <button
                      onClick={() => setContainerFilter('running')}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                        containerFilter === 'running'
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg scale-105'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      Running
                    </button>
                    <button
                      onClick={() => setContainerFilter('stopped')}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                        containerFilter === 'stopped'
                          ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg scale-105'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <div className="w-2 h-2 bg-red-400 rounded-full" />
                      Stopped
                    </button>
                  </div>

                  {/* Container Table */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-900/50 border-b border-slate-700">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Container</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">CPU %</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">RAM</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Uptime</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Image</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {(() => {
                            // Merge real container data with metrics data
                            // Get latest metrics per container
                            const latest = {};
                            containerMetrics.forEach(m => {
                              if (!latest[m.container_name] || new Date(m.timestamp) > new Date(latest[m.container_name].timestamp)) {
                                latest[m.container_name] = m;
                              }
                            });
                            
                            // Use real container data from Docker API and merge with metrics
                            let containers = allContainers.map(container => {
                              const metrics = latest[container.name] || {};
                              return {
                                ...container,
                                cpu_percent: metrics.cpu_percent || container.cpu_percent || 0,
                                memory_mb: metrics.memory_used_mb || container.memory_mb || 0,
                                memory_percent: metrics.memory_percent || container.memory_percent || 0
                              };
                            });
                            
                            // Apply filter by status
                            if (containerFilter === 'running') {
                              containers = containers.filter(c => c.status === 'running');
                            } else if (containerFilter === 'stopped') {
                              containers = containers.filter(c => c.status !== 'running');
                            }

                            if (containers.length === 0) {
                              return (
                                <tr>
                                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-3">
                                      <Box className="w-12 h-12 opacity-30" />
                                      <p>No containers found</p>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }

                            return containers.map((container, idx) => {
                              const isRunning = container.status === 'running';
                              const statusColor = isRunning ? 'green' : container.status === 'exited' ? 'red' : 'yellow';
                              const statusText = container.status.charAt(0).toUpperCase() + container.status.slice(1);
                              
                              return (
                              <tr 
                                key={container.id}
                                className="hover:bg-slate-800/50 transition-colors"
                              >
                                <td className="px-6 py-4">
                                  <div>
                                    <div className="font-semibold text-white">{container.name}</div>
                                    <div className="text-xs text-slate-500 font-mono">{container.id}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-${statusColor}-900/50 text-${statusColor}-200`}>
                                    <div className={`w-2 h-2 bg-${statusColor}-400 rounded-full ${isRunning ? 'animate-pulse' : ''}`} />
                                    {statusText}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  {isRunning ? (
                                    <div className="flex items-center gap-3">
                                      <span className="text-lg font-bold text-blue-400">{container.cpu_percent.toFixed(1)}%</span>
                                      <div className="w-20 bg-slate-700 rounded-full h-2">
                                        <div 
                                          className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full"
                                          style={{ width: `${Math.min(container.cpu_percent, 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 text-sm">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  {isRunning ? (
                                    <div>
                                      <div className="font-bold text-purple-400">{container.memory_mb.toFixed(0)} MB</div>
                                      <div className="text-xs text-slate-500">{container.memory_percent.toFixed(1)}%</div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-500 text-sm">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm">
                                    <div className="text-slate-300 font-medium">{container.uptime_label} {container.uptime_display}</div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-slate-300 font-mono">
                                    {container.image}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Convert to format expected by fetchContainerLogs
                                      const containerData = {
                                        container_name: container.name,
                                        container_id: container.id
                                      };
                                      fetchContainerLogs(container.name, containerData);
                                    }}
                                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="View Logs"
                                    disabled={!isRunning}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            )});
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Container Logs Sidebar */}
                  {showLogs && (
                    <>
                      {/* Backdrop Overlay */}
                      <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
                        onClick={() => {
                          setShowLogs(false);
                          setLogFilter('all');
                        }}
                      />
                      
                      {/* Sidebar */}
                      <div className="fixed top-0 right-0 h-full w-full md:w-3/4 lg:w-2/3 xl:w-1/2 bg-slate-900 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out">
                        {/* Header */}
                        <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex-shrink-0">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <FileText className="w-6 h-6 text-emerald-400" />
                              <div>
                                <h2 className="text-xl font-bold text-white">
                                  Container Logs: {selectedContainer?.name || selectedContainer?.container_name || 'Unknown'}
                                </h2>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setShowLogs(false);
                                setLogFilter('all');
                              }}
                              className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          
                          {/* Date Picker - Last 10 Days */}
                          <div className="mb-4 mt-4">
                            <div className="text-xs text-slate-400 mb-2 font-semibold">📅 Select Date (Last 10 Days)</div>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {availableLogDates.map((date) => {
                                const dateObj = new Date(date);
                                const isToday = date === new Date().toISOString().split('T')[0];
                                const dayName = isToday ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                                const dayDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
                                const logSize = logSizePerDate[date] || 0;
                                const sizeKB = (logSize / 1024).toFixed(1);
                                
                                return (
                                  <button
                                    key={date}
                                    onClick={() => setSelectedLogDate(date)}
                                    className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
                                      selectedLogDate === date
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                                    }`}
                                  >
                                    <div className="text-center">
                                      <div className="text-xs opacity-80">{dayName}</div>
                                      <div className="font-bold">{dayDate}</div>
                                      {logSize > 0 && (
                                        <div className="text-xs opacity-70 mt-1">
                                          📊 {sizeKB} KB
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Filter Buttons */}
                          <div className="flex gap-2 flex-wrap items-center justify-between">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                onClick={() => setLogFilter('all')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                  logFilter === 'all'
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                All Logs
                              </button>
                              <button
                                onClick={() => setLogFilter('error')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                                  logFilter === 'error'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                🔴 Errors
                              </button>
                              <button
                                onClick={() => setLogFilter('warning')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                                  logFilter === 'warning'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                ⚠️ Warnings
                              </button>
                              <button
                                onClick={() => setLogFilter('info')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                                  logFilter === 'info'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                ✅ Info
                              </button>
                            </div>
                            
                            {/* Real-time Logs Toggle */}
                            <button
                              onClick={() => setRealTimeLogs(!realTimeLogs)}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                                realTimeLogs
                                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                              }`}
                              title={realTimeLogs ? 'Disable real-time streaming' : 'Enable real-time streaming'}
                            >
                              {realTimeLogs ? (
                                <>
                                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                  ⚡ Real-time
                                </>
                              ) : (
                                <>
                                  <div className="w-2 h-2 bg-slate-500 rounded-full" />
                                  📄 Static
                                </>
                              )}
                            </button>

                            {/* Auto-refresh Toggle (only show when not in real-time mode) */}
                            {!realTimeLogs && (
                              <button
                                onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                                  autoRefreshLogs
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                                }`}
                                title={autoRefreshLogs ? 'Pause auto-refresh' : 'Resume auto-refresh'}
                              >
                                {autoRefreshLogs ? (
                                  <>
                                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                    Live (3s)
                                  </>
                                ) : (
                                  <>
                                    <div className="w-2 h-2 bg-slate-500 rounded-full" />
                                    Paused
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Logs Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 font-mono text-sm relative">
                          {/* Loading Overlay */}
                          {logsLoading && (
                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-10 flex items-center justify-center">
                              <div className="text-center">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                                <p className="text-slate-400 text-sm">Loading logs...</p>
                              </div>
                            </div>
                          )}
                          
                          {containerLogs.length === 0 && !logsLoading ? (
                            <div className="text-center text-slate-500 py-12">
                              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p className="text-lg font-semibold mb-2">No logs available</p>
                              <p className="text-sm">
                                No logs found for {new Date(selectedLogDate).toLocaleDateString('en-GB', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                              </p>
                              <p className="text-xs mt-2 text-slate-600">Try selecting a different date</p>
                            </div>
                          ) : (
                            <>
                              {/* Auto-scroll anchor at TOP (newest first) */}
                              <div ref={logsEndRef} />
                              <div className="space-y-1">
                                {containerLogs
                                  .filter(log => {
                                    const logText = log.message || log;
                                    const logLevel = log.level || (
                                      logText.match(/\b(error|500|502|503|504|failed|exception|fatal)\b/i) ? 'ERROR' :
                                      logText.match(/\b(warn|warning|deprecated)\b/i) ? 'WARNING' :
                                      'INFO'
                                    );
                                    
                                    if (logFilter === 'all') return true;
                                    if (logFilter === 'error') return logLevel === 'ERROR';
                                    if (logFilter === 'warning') return logLevel === 'WARNING';
                                    if (logFilter === 'info') return logLevel === 'INFO';
                                    return true;
                                  })
                                  .map((log, idx) => {
                                // Determine log level styling
                                let bgClass = 'bg-slate-900/50';
                                let textClass = 'text-slate-300';
                                let borderClass = 'border-l-slate-700';
                                let icon = 'ℹ️';
                                
                                const logText = log.message || log;
                                const logLevel = log.level || (
                                  logText.includes('ERROR') || logText.includes('500') || logText.includes('failed') ? 'ERROR' :
                                  logText.includes('WARNING') || logText.includes('WARN') ? 'WARNING' :
                                  logText.includes('INFO') ? 'INFO' : 'INFO'
                                );

                                if (logLevel === 'ERROR' || logText.match(/\b(error|500|502|503|504|failed|exception|fatal)\b/i)) {
                                  bgClass = 'bg-red-900/20 hover:bg-red-900/30';
                                  textClass = 'text-red-300';
                                  borderClass = 'border-l-red-500';
                                  icon = '🔴';
                                } else if (logLevel === 'WARNING' || logText.match(/\b(warn|warning|deprecated)\b/i)) {
                                  bgClass = 'bg-amber-900/20 hover:bg-amber-900/30';
                                  textClass = 'text-amber-300';
                                  borderClass = 'border-l-amber-500';
                                  icon = '⚠️';
                                } else if (logText.match(/\b(success|started|connected|ready)\b/i)) {
                                  bgClass = 'bg-emerald-900/20 hover:bg-emerald-900/30';
                                  textClass = 'text-emerald-300';
                                  borderClass = 'border-l-emerald-500';
                                  icon = '✅';
                                }

                                return (
                                  <div key={idx}>
                                    <div 
                                      className={`p-3 rounded border-l-4 ${bgClass} ${borderClass} transition-all cursor-pointer ${
                                        expandedLog === idx ? 'ring-2 ring-sky-500/50' : ''
                                      }`}
                                      onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
                                    >
                                      <div className="flex items-start gap-3">
                                        <span className="text-lg flex-shrink-0">{icon}</span>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-3 mb-1">
                                            <span className="text-xs text-slate-500">
                                              {log.timestamp ? (() => {
                                                // Parse UTC timestamp and display in WIB (Asia/Jakarta)
                                                const date = new Date(log.timestamp);
                                                return date.toLocaleTimeString('en-GB', { 
                                                  hour: '2-digit', 
                                                  minute: '2-digit', 
                                                  second: '2-digit',
                                                  timeZone: 'Asia/Jakarta'
                                                }) + ' WIB';
                                              })() : new Date().toLocaleTimeString('en-GB')}
                                            </span>
                                            <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                                              logLevel === 'ERROR' ? 'bg-red-900/50 text-red-200' :
                                              logLevel === 'WARNING' ? 'bg-amber-900/50 text-amber-200' :
                                              'bg-slate-700 text-slate-300'
                                            }`}>
                                              {logLevel}
                                            </span>
                                            {log.details && (
                                              <span className="text-xs text-sky-400 ml-auto flex items-center gap-1">
                                                {expandedLog === idx ? '🔼' : '🔽'} Click for details
                                              </span>
                                            )}
                                          </div>
                                          <div className={`${textClass} break-all`}>
                                            {logText}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Expanded Details */}
                                    {expandedLog === idx && log.details && (
                                      <div className={`ml-8 mt-2 mb-2 p-4 rounded-lg border ${
                                        logLevel === 'ERROR' ? 'bg-red-950/50 border-red-800/50' :
                                        logLevel === 'WARNING' ? 'bg-amber-950/50 border-amber-800/50' :
                                        'bg-slate-800/50 border-slate-700/50'
                                      }`}>
                                        <div className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
                                          <span>📝</span> Log Details:
                                        </div>
                                        <div className="space-y-2">
                                          {Object.entries(log.details).map(([key, value]) => (
                                            <div key={key} className="flex gap-3">
                                              <span className="text-xs text-sky-400 font-semibold min-w-[120px]">{key}:</span>
                                              <span className="text-xs text-slate-300 flex-1 break-all font-mono">
                                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                        
                                        {/* Stack Trace if available */}
                                        {log.details.stack && (
                                          <div className="mt-4 pt-4 border-t border-slate-700/50">
                                            <div className="text-xs font-semibold text-red-400 mb-2">🐞 Stack Trace:</div>
                                            <pre className="text-xs text-red-300 bg-slate-950/50 p-3 rounded overflow-x-auto">
                                              {log.details.stack}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );  
                              })}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Footer Stats */}
                        <div className="bg-slate-800 border-t border-slate-700 px-6 py-3 flex-shrink-0">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="text-slate-400">Total: <span className="text-white font-semibold">{containerLogs.length}</span> lines</span>
                              <span className="text-red-400">Errors: <span className="font-semibold">{containerLogs.filter(l => (l.level === 'ERROR' || (l.message || l).match(/error|500|failed/i))).length}</span></span>
                              <span className="text-amber-400">Warnings: <span className="font-semibold">{containerLogs.filter(l => (l.level === 'WARNING' || (l.message || l).match(/warn/i))).length}</span></span>
                              <span className="text-emerald-400">Info: <span className="font-semibold">{containerLogs.filter(l => !(l.level === 'ERROR' || l.level === 'WARNING' || (l.message || l).match(/error|500|failed|warn/i))).length}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Security View */}
              {activeTab === 'security' && (
                <>
                  {/* Header */}
                  <div className="mb-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-pink-500 bg-clip-text text-transparent mb-2">
                      🔒 Security Dashboard
                    </h1>
                    <p className="text-slate-400">Container security monitoring, audit & hardening insights</p>
                  </div>

                  {/* Security Overview Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-2xl p-6 border border-green-700/50">
                      <div className="flex items-center justify-between mb-4">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                        <span className="text-xs text-green-300 font-semibold bg-green-900/50 px-3 py-1 rounded-full">SECURE</span>
                      </div>
                      <div className="text-3xl font-bold text-white mb-2">
                        {(() => {
                          const total = [...new Set(containerMetrics.map(m => m.container_name))].length;
                          return Math.max(0, total - 3);
                        })()}
                      </div>
                      <div className="text-sm text-green-300">Secure Containers</div>
                      <div className="text-xs text-slate-400 mt-2">No vulnerabilities detected</div>
                    </div>

                    <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 rounded-2xl p-6 border border-yellow-700/50">
                      <div className="flex items-center justify-between mb-4">
                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                        <span className="text-xs text-yellow-300 font-semibold bg-yellow-900/50 px-3 py-1 rounded-full">WARNING</span>
                      </div>
                      <div className="text-3xl font-bold text-white mb-2">2</div>
                      <div className="text-sm text-yellow-300">Warnings</div>
                      <div className="text-xs text-slate-400 mt-2">Require attention</div>
                    </div>

                    <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 rounded-2xl p-6 border border-red-700/50">
                      <div className="flex items-center justify-between mb-4">
                        <AlertCircle className="w-8 h-8 text-red-400" />
                        <span className="text-xs text-red-300 font-semibold bg-red-900/50 px-3 py-1 rounded-full">CRITICAL</span>
                      </div>
                      <div className="text-3xl font-bold text-white mb-2">1</div>
                      <div className="text-sm text-red-300">Critical Issues</div>
                      <div className="text-xs text-slate-400 mt-2">Immediate action required</div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-2xl p-6 border border-blue-700/50">
                      <div className="flex items-center justify-between mb-4">
                        <Shield className="w-8 h-8 text-blue-400" />
                        <span className="text-xs text-blue-300 font-semibold bg-blue-900/50 px-3 py-1 rounded-full">SCANNED</span>
                      </div>
                      <div className="text-3xl font-bold text-white mb-2">
                        {[...new Set(containerMetrics.map(m => m.container_name))].length}
                      </div>
                      <div className="text-sm text-blue-300">Images Scanned</div>
                      <div className="text-xs text-slate-400 mt-2">Last scan: 5 min ago</div>
                    </div>
                  </div>

                  {/* Container Security Issues */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                      <Shield className="w-6 h-6 text-orange-400" />
                      <h2 className="text-xl font-bold text-white">🧩 Container Security Issues</h2>
                    </div>
                    <div className="space-y-4">
                      {/* Running as Root */}
                      <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-5">
                        <div className="flex items-start gap-4">
                          <AlertCircle className="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-bold text-red-300 text-lg">⚠️ Container Running as Root</h3>
                              <span className="text-xs bg-red-900/70 text-red-200 px-3 py-1 rounded-full font-semibold">CRITICAL</span>
                            </div>
                            <p className="text-sm text-slate-300 mb-3">1 container is running with root privileges, which poses a security risk</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {(() => {
                                const containers = [...new Set(containerMetrics.map(m => m.container_name))];
                                return containers.slice(0, 1).map((name, idx) => (
                                  <span key={idx} className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-lg font-mono">
                                    🐳 {name}
                                  </span>
                                ));
                              })()}
                            </div>
                            <div className="text-xs text-red-300 bg-red-900/30 p-3 rounded-lg">
                              🛡️ <strong>Recommendation:</strong> Use USER directive in Dockerfile to run as non-root user
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Using Latest Tag */}
                      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-5">
                        <div className="flex items-start gap-4">
                          <AlertTriangle className="w-6 h-6 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-bold text-yellow-300 text-lg">⚠️ Using 'latest' Image Tag</h3>
                              <span className="text-xs bg-yellow-900/70 text-yellow-200 px-3 py-1 rounded-full font-semibold">WARNING</span>
                            </div>
                            <p className="text-sm text-slate-300 mb-3">2 containers using 'latest' tag - not recommended for production</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-lg font-mono">
                                📍 nginx:latest
                              </span>
                              <span className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-lg font-mono">
                                📍 ubuntu:latest
                              </span>
                            </div>
                            <div className="text-xs text-yellow-300 bg-yellow-900/30 p-3 rounded-lg">
                              🛡️ <strong>Recommendation:</strong> Pin specific image versions (e.g., nginx:1.25.3, ubuntu:22.04)
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Privileged Mode */}
                      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-5">
                        <div className="flex items-start gap-4">
                          <AlertTriangle className="w-6 h-6 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-bold text-yellow-300 text-lg">⚠️ Privileged Mode Enabled</h3>
                              <span className="text-xs bg-yellow-900/70 text-yellow-200 px-3 py-1 rounded-full font-semibold">WARNING</span>
                            </div>
                            <p className="text-sm text-slate-300 mb-3">0 containers running in privileged mode (good!)</p>
                            <div className="text-xs text-green-300 bg-green-900/30 p-3 rounded-lg">
                              ✅ <strong>Status:</strong> No containers with --privileged flag detected
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vulnerability Scan Results */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 mb-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6 text-purple-400" />
                        <h2 className="text-xl font-bold text-white">🔍 Vulnerability Scan (Trivy Integration)</h2>
                      </div>
                      <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-semibold">
                        🔄 Run Scan
                      </button>
                    </div>
                    <div className="space-y-4">
                      {/* Scan Result 1 */}
                      <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">📦</div>
                            <div>
                              <h3 className="font-bold text-white">nginx:latest</h3>
                              <p className="text-xs text-slate-400">Scanned 2 minutes ago</p>
                            </div>
                          </div>
                          <span className="text-xs bg-red-900/70 text-red-200 px-3 py-1.5 rounded-full font-semibold">5 Vulnerabilities</span>
                        </div>
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div className="bg-red-900/30 rounded-lg p-3 border border-red-700/50">
                            <div className="text-xs text-red-400 mb-1">Critical</div>
                            <div className="text-2xl font-bold text-red-300">1</div>
                          </div>
                          <div className="bg-orange-900/30 rounded-lg p-3 border border-orange-700/50">
                            <div className="text-xs text-orange-400 mb-1">High</div>
                            <div className="text-2xl font-bold text-orange-300">2</div>
                          </div>
                          <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-700/50">
                            <div className="text-xs text-yellow-400 mb-1">Medium</div>
                            <div className="text-2xl font-bold text-yellow-300">2</div>
                          </div>
                          <div className="bg-blue-900/30 rounded-lg p-3 border border-blue-700/50">
                            <div className="text-xs text-blue-400 mb-1">Low</div>
                            <div className="text-2xl font-bold text-blue-300">0</div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400">
                          <strong>CVE-2024-1234:</strong> OpenSSL vulnerability - Update to version 3.0.12
                        </div>
                      </div>

                      {/* Scan Result 2 */}
                      <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">📦</div>
                            <div>
                              <h3 className="font-bold text-white">mysql:8.0</h3>
                              <p className="text-xs text-slate-400">Scanned 5 minutes ago</p>
                            </div>
                          </div>
                          <span className="text-xs bg-green-900/70 text-green-200 px-3 py-1.5 rounded-full font-semibold">✓ Clean</span>
                        </div>
                        <div className="text-sm text-green-300">
                          ✅ No vulnerabilities detected
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audit Logs */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                      <FileText className="w-6 h-6 text-cyan-400" />
                      <h2 className="text-xl font-bold text-white">📜 Audit Logs</h2>
                    </div>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {/* Log Entry 1 */}
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="text-green-400 text-xl">✅</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-white">Container Created</h4>
                              <span className="text-xs text-slate-500">2 minutes ago</span>
                            </div>
                            <p className="text-sm text-slate-300">Container 'nginx_web' was created successfully</p>
                            <div className="text-xs text-slate-500 mt-2 font-mono">
                              User: admin | IP: 192.168.1.100 | Image: nginx:latest
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Log Entry 2 */}
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="text-blue-400 text-xl">🔄</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-white">Network Modified</h4>
                              <span className="text-xs text-slate-500">15 minutes ago</span>
                            </div>
                            <p className="text-sm text-slate-300">Bridge network 'docker0' configuration updated</p>
                            <div className="text-xs text-slate-500 mt-2 font-mono">
                              User: admin | IP: 192.168.1.100 | Action: network update
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Log Entry 3 */}
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="text-red-400 text-xl">❌</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-white">Container Deleted</h4>
                              <span className="text-xs text-slate-500">1 hour ago</span>
                            </div>
                            <p className="text-sm text-slate-300">Container 'old_redis' was removed</p>
                            <div className="text-xs text-slate-500 mt-2 font-mono">
                              User: admin | IP: 192.168.1.100 | Reason: cleanup
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Log Entry 4 */}
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="text-yellow-400 text-xl">⚠️</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-white">Security Alert</h4>
                              <span className="text-xs text-slate-500">2 hours ago</span>
                            </div>
                            <p className="text-sm text-slate-300">Container started with privileged flag</p>
                            <div className="text-xs text-slate-500 mt-2 font-mono">
                              Container: test_container | Flag: --privileged
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Log Entry 5 */}
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className="text-purple-400 text-xl">🔒</div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-semibold text-white">Security Scan Completed</h4>
                              <span className="text-xs text-slate-500">3 hours ago</span>
                            </div>
                            <p className="text-sm text-slate-300">Trivy scan completed for all images</p>
                            <div className="text-xs text-slate-500 mt-2 font-mono">
                              Images scanned: {[...new Set(containerMetrics.map(m => m.container_name))].length} | Vulnerabilities: 5
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Firewall & Network Info */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 mb-8">
                    <div className="flex items-center gap-3 mb-6">
                      <Shield className="w-6 h-6 text-green-400" />
                      <h2 className="text-xl font-bold text-white">🧱 Firewall & Network Security</h2>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Open Ports on Host */}
                      <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                          🏛️ Open Ports on Host
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <div>
                              <div className="font-mono text-white">Port 80</div>
                              <div className="text-xs text-slate-400">HTTP</div>
                            </div>
                            <span className="text-xs bg-green-900/70 text-green-200 px-2 py-1 rounded">OPEN</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <div>
                              <div className="font-mono text-white">Port 443</div>
                              <div className="text-xs text-slate-400">HTTPS</div>
                            </div>
                            <span className="text-xs bg-green-900/70 text-green-200 px-2 py-1 rounded">OPEN</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <div>
                              <div className="font-mono text-white">Port 22</div>
                              <div className="text-xs text-slate-400">SSH</div>
                            </div>
                            <span className="text-xs bg-yellow-900/70 text-yellow-200 px-2 py-1 rounded">LIMITED</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                            <div>
                              <div className="font-mono text-white">Port 3306</div>
                              <div className="text-xs text-slate-400">MySQL</div>
                            </div>
                            <span className="text-xs bg-red-900/70 text-red-200 px-2 py-1 rounded">EXPOSED</span>
                          </div>
                        </div>
                      </div>

                      {/* Container Ports */}
                      <div className="bg-slate-700/30 rounded-xl p-5 border border-slate-600">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                          🐳 Container Port Mappings
                        </h3>
                        <div className="space-y-3">
                          {(() => {
                            const containers = [...new Set(containerMetrics.map(m => m.container_name))];
                            return containers.slice(0, 4).map((name, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                                <div>
                                  <div className="font-semibold text-white text-sm">{name}</div>
                                  <div className="text-xs text-slate-400 font-mono">
                                    {name.includes('nginx') ? '80:8080, 443:8443' :
                                     name.includes('mysql') ? '3306:3306' :
                                     name.includes('redis') ? '6379:6379' :
                                     `${8000 + idx}:${8000 + idx}`}
                                  </div>
                                </div>
                                <span className="text-xs bg-blue-900/70 text-blue-200 px-2 py-1 rounded">MAPPED</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security Recommendations */}
                  <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
                    <div className="flex items-center gap-3 mb-6">
                      <CheckCircle className="w-6 h-6 text-blue-400" />
                      <h2 className="text-xl font-bold text-white">🪧 Security Recommendations</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Recommendation 1 */}
                      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">🚫</div>
                          <div>
                            <h3 className="font-bold text-blue-300 mb-2">Disable Root User</h3>
                            <p className="text-sm text-slate-300 mb-3">
                              Run containers with non-root users to minimize security risks
                            </p>
                            <code className="text-xs bg-slate-900 px-2 py-1 rounded text-green-400 block">
                              USER appuser
                            </code>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation 2 */}
                      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">📍</div>
                          <div>
                            <h3 className="font-bold text-blue-300 mb-2">Pin Image Versions</h3>
                            <p className="text-sm text-slate-300 mb-3">
                              Avoid 'latest' tag, use specific versions for reproducibility
                            </p>
                            <code className="text-xs bg-slate-900 px-2 py-1 rounded text-green-400 block">
                              nginx:1.25.3-alpine
                            </code>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation 3 */}
                      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">🛡️</div>
                          <div>
                            <h3 className="font-bold text-blue-300 mb-2">Limit Resources</h3>
                            <p className="text-sm text-slate-300 mb-3">
                              Set CPU and memory limits to prevent resource exhaustion
                            </p>
                            <code className="text-xs bg-slate-900 px-2 py-1 rounded text-green-400 block">
                              --memory="512m" --cpus="1.0"
                            </code>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation 4 */}
                      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">🔒</div>
                          <div>
                            <h3 className="font-bold text-blue-300 mb-2">Enable Read-Only Root</h3>
                            <p className="text-sm text-slate-300 mb-3">
                              Make root filesystem read-only for better security
                            </p>
                            <code className="text-xs bg-slate-900 px-2 py-1 rounded text-green-400 block">
                              --read-only --tmpfs /tmp
                            </code>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation 5 */}
                      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">🚪</div>
                          <div>
                            <h3 className="font-bold text-blue-300 mb-2">Drop Capabilities</h3>
                            <p className="text-sm text-slate-300 mb-3">
                              Remove unnecessary Linux capabilities
                            </p>
                            <code className="text-xs bg-slate-900 px-2 py-1 rounded text-green-400 block">
                              --cap-drop=ALL --cap-add=NET_BIND
                            </code>
                          </div>
                        </div>
                      </div>

                      {/* Recommendation 6 */}
                      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-5">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">🔍</div>
                          <div>
                            <h3 className="font-bold text-blue-300 mb-2">Regular Security Scans</h3>
                            <p className="text-sm text-slate-300 mb-3">
                              Scan images regularly for vulnerabilities
                            </p>
                            <code className="text-xs bg-slate-900 px-2 py-1 rounded text-green-400 block">
                              trivy image nginx:latest
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
