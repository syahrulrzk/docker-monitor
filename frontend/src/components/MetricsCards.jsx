import { HardDrive, FileText, Cpu, MemoryStick, ArrowDown, ArrowUp } from 'lucide-react';

const MetricsCards = ({ hostMetrics, containerMetrics }) => {
  // Calculate totals from latest metrics
  const latestHost = hostMetrics.length > 0 ? hostMetrics[hostMetrics.length - 1] : null;
  
  const latestContainers = {};
  containerMetrics.forEach(metric => {
    if (!latestContainers[metric.container_name] || 
        new Date(metric.timestamp) > new Date(latestContainers[metric.container_name].timestamp)) {
      latestContainers[metric.container_name] = metric;
    }
  });

  const totalCPU = Object.values(latestContainers).reduce((sum, c) => sum + c.cpu_percent, 0);
  const totalRAM = Object.values(latestContainers).reduce((sum, c) => sum + c.memory_used_mb, 0);
  const hostCPU = latestHost ? latestHost.cpu_percent : 0;
  const hostRAM = latestHost ? latestHost.memory_used_mb : 0;

  const metrics = [
    {
      title: 'Total Disk Reads',
      value: latestHost ? '0.00' : '0.00',
      unit: 'KiB/s',
      icon: HardDrive,
      gradient: 'from-blue-500 to-cyan-600',
      bgGradient: 'from-blue-500/10 to-cyan-600/10',
      borderColor: 'border-blue-500/20'
    },
    {
      title: 'Total Disk Writes',
      value: latestHost ? '0.00' : '0.00',
      unit: 'MiB/s',
      icon: FileText,
      gradient: 'from-purple-500 to-pink-600',
      bgGradient: 'from-purple-500/10 to-pink-600/10',
      borderColor: 'border-purple-500/20'
    },
    {
      title: 'Total CPU Usage',
      value: (hostCPU + totalCPU).toFixed(2),
      unit: '%',
      icon: Cpu,
      gradient: 'from-orange-500 to-red-600',
      bgGradient: 'from-orange-500/10 to-red-600/10',
      borderColor: 'border-orange-500/20'
    },
    {
      title: 'Total RAM Usage',
      value: (hostRAM + totalRAM).toFixed(0),
      unit: 'MiB',
      icon: MemoryStick,
      gradient: 'from-green-500 to-emerald-600',
      bgGradient: 'from-green-500/10 to-emerald-600/10',
      borderColor: 'border-green-500/20'
    },
    {
      title: 'Total Network Inbound',
      value: '0.00',
      unit: 'Mbit/s',
      icon: ArrowDown,
      gradient: 'from-indigo-500 to-blue-600',
      bgGradient: 'from-indigo-500/10 to-blue-600/10',
      borderColor: 'border-indigo-500/20'
    },
    {
      title: 'Total Network Outbound',
      value: '0.00',
      unit: 'Mbit/s',
      icon: ArrowUp,
      gradient: 'from-pink-500 to-rose-600',
      bgGradient: 'from-pink-500/10 to-rose-600/10',
      borderColor: 'border-pink-500/20'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {metrics.map((metric, idx) => {
        const Icon = metric.icon;
        return (
          <div
            key={idx}
            className={`bg-gradient-to-br ${metric.bgGradient} border ${metric.borderColor} rounded-2xl p-6 hover:scale-105 transition-transform duration-300`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-slate-400 font-semibold uppercase tracking-wide">{metric.title}</p>
              </div>
              <div className={`p-2 bg-gradient-to-br ${metric.gradient} rounded-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <h3 className={`text-4xl font-bold bg-gradient-to-r ${metric.gradient} bg-clip-text text-transparent`}>
                {metric.value}
              </h3>
              <span className="text-lg text-slate-400 font-semibold">{metric.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MetricsCards;
