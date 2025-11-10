import { HardDrive, FileText, Cpu, MemoryStick, ArrowDown, ArrowUp, Server } from 'lucide-react';

const HostMetricsSummary = ({ hostMetrics }) => {
  // Get latest host metrics
  const latest = hostMetrics.length > 0 ? hostMetrics[hostMetrics.length - 1] : null;

  if (!latest) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-slate-700 text-center">
        <p className="text-slate-400">No host metrics available</p>
      </div>
    );
  }

  const metrics = [
    {
      title: 'CPU Usage',
      value: latest.cpu_percent.toFixed(2),
      unit: '%',
      max: '100',
      icon: Cpu,
      gradient: 'from-orange-500 to-red-600',
      bgGradient: 'from-orange-500/10 to-red-600/10',
      borderColor: 'border-orange-500/20'
    },
    {
      title: 'Memory Usage',
      value: latest.memory_used_mb.toFixed(0),
      unit: 'MiB',
      max: `${latest.memory_total_mb.toFixed(0)} MiB`,
      percentage: latest.memory_percent.toFixed(1),
      icon: MemoryStick,
      gradient: 'from-green-500 to-emerald-600',
      bgGradient: 'from-green-500/10 to-emerald-600/10',
      borderColor: 'border-green-500/20'
    },
    {
      title: 'Disk Read',
      value: (latest.disk_read_kb || 0).toFixed(2),
      unit: 'KiB/s',
      max: 'Real-time',
      icon: HardDrive,
      gradient: 'from-blue-500 to-cyan-600',
      bgGradient: 'from-blue-500/10 to-cyan-600/10',
      borderColor: 'border-blue-500/20'
    },
    {
      title: 'Disk Write',
      value: (latest.disk_write_mb || 0).toFixed(2),
      unit: 'MiB/s',
      max: 'Real-time',
      icon: FileText,
      gradient: 'from-purple-500 to-pink-600',
      bgGradient: 'from-purple-500/10 to-pink-600/10',
      borderColor: 'border-purple-500/20'
    },
    {
      title: 'Network In',
      value: (latest.network_in_mbit || 0).toFixed(2),
      unit: 'Mbit/s',
      max: 'Real-time',
      icon: ArrowDown,
      gradient: 'from-indigo-500 to-blue-600',
      bgGradient: 'from-indigo-500/10 to-blue-600/10',
      borderColor: 'border-indigo-500/20'
    },
    {
      title: 'Network Out',
      value: (latest.network_out_mbit || 0).toFixed(2),
      unit: 'Mbit/s',
      max: 'Real-time',
      icon: ArrowUp,
      gradient: 'from-pink-500 to-rose-600',
      bgGradient: 'from-pink-500/10 to-rose-600/10',
      borderColor: 'border-pink-500/20'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Server className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Host System Resources</h2>
            <p className="text-sm text-slate-400">Real-time system metrics and resource utilization</p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div
              key={idx}
              className={`bg-gradient-to-br ${metric.bgGradient} border ${metric.borderColor} rounded-2xl p-6 hover:scale-105 transition-transform duration-300`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="text-sm text-slate-400 font-semibold uppercase tracking-wide mb-2">{metric.title}</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className={`text-4xl font-bold bg-gradient-to-r ${metric.gradient} bg-clip-text text-transparent`}>
                      {metric.value}
                    </h3>
                    <span className="text-lg text-slate-400 font-semibold">{metric.unit}</span>
                  </div>
                  {metric.percentage && (
                    <p className="text-xs text-slate-500 mt-2">
                      {metric.percentage}% of total
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Max: {metric.max}
                  </p>
                </div>
                <div className={`p-2 bg-gradient-to-br ${metric.gradient} rounded-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>

              {/* Progress Bar for CPU and Memory */}
              {(metric.title === 'CPU Usage' || metric.title === 'Memory Usage') && (
                <div className="w-full bg-slate-700/50 rounded-full h-2 mt-3">
                  <div 
                    className={`bg-gradient-to-r ${metric.gradient} h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${metric.title === 'CPU Usage' ? latest.cpu_percent : latest.memory_percent}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HostMetricsSummary;
