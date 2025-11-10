import { Cpu, MemoryStick, TrendingUp } from 'lucide-react';

const TopTables = ({ containerMetrics }) => {
  // Get latest metrics per container
  const latestContainers = {};
  containerMetrics.forEach(metric => {
    if (!latestContainers[metric.container_name] || 
        new Date(metric.timestamp) > new Date(latestContainers[metric.container_name].timestamp)) {
      latestContainers[metric.container_name] = metric;
    }
  });

  const containers = Object.values(latestContainers);

  // Sort by CPU (top 5)
  const topByCPU = [...containers].sort((a, b) => b.cpu_percent - a.cpu_percent).slice(0, 5);

  // Sort by RAM (top 5)
  const topByRAM = [...containers].sort((a, b) => b.memory_used_mb - a.memory_used_mb).slice(0, 5);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top by CPU */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Top by CPU</h3>
            <p className="text-sm text-slate-400">Highest CPU consumers</p>
          </div>
        </div>

        <div className="space-y-3">
          {topByCPU.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No container data available</p>
            </div>
          ) : (
            topByCPU.map((container, idx) => (
              <div
                key={container.container_id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-xl border border-slate-600 hover:border-slate-500 transition-all"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-2 h-12 rounded-full"
                    style={{ backgroundColor: colors[idx % colors.length] }}
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-white">{container.container_name}</p>
                    <p className="text-xs text-slate-400">ID: {container.container_id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: colors[idx % colors.length] }}>
                    {container.cpu_percent.toFixed(2)}%
                  </p>
                  <p className="text-xs text-slate-400">CPU Usage</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top by RAM */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
            <MemoryStick className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Top by RAM</h3>
            <p className="text-sm text-slate-400">Highest memory consumers</p>
          </div>
        </div>

        <div className="space-y-3">
          {topByRAM.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p>No container data available</p>
            </div>
          ) : (
            topByRAM.map((container, idx) => (
              <div
                key={container.container_id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-700/50 to-slate-800/50 rounded-xl border border-slate-600 hover:border-slate-500 transition-all"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-2 h-12 rounded-full"
                    style={{ backgroundColor: colors[idx % colors.length] }}
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-white">{container.container_name}</p>
                    <p className="text-xs text-slate-400">ID: {container.container_id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: colors[idx % colors.length] }}>
                    {container.memory_used_mb.toFixed(0)} MiB
                  </p>
                  <p className="text-xs text-slate-400">
                    {container.memory_percent.toFixed(1)}% of limit
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TopTables;
