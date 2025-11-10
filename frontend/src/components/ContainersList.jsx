import { Container, Play, Square, RotateCw, Trash2, FileText, Clock, Image as ImageIcon } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

const ContainersList = ({ containerMetrics }) => {
  const [selectedContainer, setSelectedContainer] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [allContainers, setAllContainers] = useState([]);

  // Fetch all containers from Docker API
  useEffect(() => {
    fetch('http://localhost:8000/api/containers/all')
      .then(res => res.json())
      .then(data => setAllContainers(data.containers || []))
      .catch(err => console.error('Failed to fetch containers:', err));
  }, []);

  // Merge Docker container info with metrics
  const containerList = useMemo(() => {
    const metricsMap = {};
    containerMetrics.forEach(metric => {
      if (!metricsMap[metric.container_id] || 
          new Date(metric.timestamp) > new Date(metricsMap[metric.container_id].timestamp)) {
        metricsMap[metric.container_id] = metric;
      }
    });

    return allContainers.map(container => ({
      ...container,
      metrics: metricsMap[container.id]
    }));
  }, [allContainers, containerMetrics]);

  const getStatusColor = (status) => {
    if (status === 'running') return 'bg-green-500';
    if (status === 'exited') return 'bg-red-500';
    if (status === 'paused') return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const getStatusText = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const viewLogs = (container) => {
    setSelectedContainer(container);
    setShowLogs(true);
  };

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
              <Container className="w-6 h-6 text-white" />
            </div>
            All Containers
          </h3>
          <p className="text-sm text-slate-400 mt-2 ml-14">Running and stopped containers</p>
        </div>
        
        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 border border-cyan-500/20 rounded-xl px-6 py-3">
          <div className="text-xs text-cyan-400 font-semibold uppercase tracking-wide">Total</div>
          <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            {containerList.length}
          </div>
        </div>
      </div>

      {containerList.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Container className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">No containers found</p>
          <p className="text-sm mt-2">Start some containers to see them here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {containerList.map((container) => (
            <div 
              key={container.container_id} 
              className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 rounded-xl p-5 border border-slate-600 hover:border-slate-500 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(container.status)} ${container.status === 'running' ? 'animate-pulse' : ''}`} />
                    <h4 className="text-lg font-bold text-white">🐳 {container.name}</h4>
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                      container.status === 'running' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500'
                        : 'bg-red-500/20 text-red-400 border border-red-500'
                    }`}>
                      {getStatusText(container.status)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-3 text-sm">
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    <span className="text-slate-300 font-mono">{container.image}</span>
                    <span className="text-xs bg-slate-600 px-2 py-0.5 rounded text-slate-300">
                      ID: {container.id}
                    </span>
                  </div>
                  
                  {container.metrics ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div>
                        <div className="text-xs text-slate-500 uppercase">CPU</div>
                        <div className="text-sm font-bold text-blue-400">{container.metrics.cpu_percent.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase">Memory</div>
                        <div className="text-sm font-bold text-purple-400">{container.metrics.memory_percent.toFixed(2)}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase">RAM Used</div>
                        <div className="text-sm font-bold text-green-400">{container.metrics.memory_used_mb.toFixed(0)} MB</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase">Last Update</div>
                        <div className="text-sm font-bold text-yellow-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(container.metrics.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 italic">No metrics data available</div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  {container.metrics && (
                    <button
                      onClick={() => viewLogs(container)}
                      className="p-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-lg transition-all hover:scale-105"
                      title="View Metrics History"
                    >
                      <FileText className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && selectedContainer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowLogs(false)}>
          <div className="bg-slate-900 rounded-2xl p-8 max-w-4xl w-full max-h-[80vh] overflow-y-auto border border-slate-700" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Container Metrics History</h3>
              <button onClick={() => setShowLogs(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            
            <div className="mb-4">
              <p className="text-slate-300"><strong>Container:</strong> {selectedContainer.name}</p>
              <p className="text-slate-400 text-sm"><strong>ID:</strong> {selectedContainer.id}</p>
              {selectedContainer.image && (
                <p className="text-slate-400 text-sm"><strong>Image:</strong> {selectedContainer.image}</p>
              )}
            </div>

            <div className="bg-slate-800 rounded-lg p-4 font-mono text-sm space-y-2 max-h-96 overflow-y-auto">
              {containerMetrics
                .filter(m => m.container_id === selectedContainer.id || m.container_name === selectedContainer.name)
                .slice(-20)
                .reverse()
                .map((metric, idx) => (
                  <div key={idx} className="text-slate-300 border-b border-slate-700 pb-2">
                    <span className="text-green-400">[{new Date(metric.timestamp).toLocaleString('en-GB', { 
                      year: 'numeric', 
                      month: '2-digit', 
                      day: '2-digit',
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    })}]</span>
                    {' '}CPU: <span className="text-blue-400">{metric.cpu_percent.toFixed(2)}%</span>
                    {' '}| Memory: <span className="text-purple-400">{metric.memory_percent.toFixed(2)}%</span>
                    {' '}({metric.memory_used_mb.toFixed(0)}MB / {metric.memory_limit_mb.toFixed(0)}MB)
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContainersList;
