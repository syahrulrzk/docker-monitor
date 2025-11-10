import { Activity, RefreshCw, Bell } from 'lucide-react';
import { useState } from 'react';

const TopBar = ({ onRefresh, lastUpdate, activeTab, hostMetrics, containerMetrics }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  // Check for alerts (CPU/RAM > 75%)
  const alerts = [];
  
  // Host metrics alerts
  if (hostMetrics && hostMetrics.length > 0) {
    const latest = hostMetrics[hostMetrics.length - 1];
    if (latest.cpu_percent > 75) {
      alerts.push({
        type: 'warning',
        title: 'High CPU Usage',
        message: `Host CPU usage is ${latest.cpu_percent.toFixed(1)}%`,
        icon: '⚠️'
      });
    }
    if (latest.memory_percent > 75) {
      alerts.push({
        type: 'warning',
        title: 'High Memory Usage',
        message: `Host RAM usage is ${latest.memory_percent.toFixed(1)}%`,
        icon: '⚠️'
      });
    }
  }

  // Container metrics alerts
  if (containerMetrics && containerMetrics.length > 0) {
    const latestContainers = {};
    containerMetrics.forEach(m => {
      if (!latestContainers[m.container_name] || new Date(m.timestamp) > new Date(latestContainers[m.container_name].timestamp)) {
        latestContainers[m.container_name] = m;
      }
    });
    
    Object.values(latestContainers).forEach(container => {
      if (container.cpu_percent > 75) {
        alerts.push({
          type: 'warning',
          title: `Container: ${container.container_name}`,
          message: `CPU usage is ${container.cpu_percent.toFixed(1)}%`,
          icon: '🐳'
        });
      }
      if (container.memory_percent > 75) {
        alerts.push({
          type: 'warning',
          title: `Container: ${container.container_name}`,
          message: `RAM usage is ${container.memory_percent.toFixed(1)}%`,
          icon: '🐳'
        });
      }
    });
  }

  const getTitle = () => {
    switch(activeTab) {
      case 'dashboard':
        return 'System Overview';
      case 'host':
        return 'Host Metrics';
      case 'containers':
        return 'Containers Management';
      case 'security':
        return 'Security Dashboard';
      default:
        return 'System Overview';
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div 
      className="border-b border-dashed border-slate-700 px-8 py-4 relative z-10"
      style={{
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">{getTitle()}</h2>
          <p className="text-sm text-slate-400 mt-1">
            Last updated: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Loading...'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <div className="relative">
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className="relative flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-md text-slate-300 hover:text-white text-sm font-medium transition-colors"
            >
              <Bell className="w-4 h-4" />
              {alerts.length > 0 && (
                <>
                  <span className="text-xs">{alerts.length}</span>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                </>
              )}
            </button>

            {/* Alerts Dropdown */}
            {showAlerts && (
              <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Alerts ({alerts.length})
                  </h3>
                </div>
                
                {alerts.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    <div className="text-4xl mb-2">✅</div>
                    <p className="text-sm">No alerts</p>
                    <p className="text-xs mt-1">All systems normal</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700">
                    {alerts.map((alert, idx) => (
                      <div key={idx} className="p-4 hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{alert.icon}</span>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-white mb-1">{alert.title}</h4>
                            <p className="text-xs text-slate-400">{alert.message}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-xs bg-amber-900/50 text-amber-200 px-2 py-0.5 rounded">WARNING</span>
                              <span className="text-xs text-slate-500">Threshold: 75%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center p-2 bg-sky-500 hover:bg-sky-600 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={isRefreshing ? 'Refreshing...' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
