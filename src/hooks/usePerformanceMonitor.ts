import { useCallback, useRef } from 'react';

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export const usePerformanceMonitor = () => {
  const metricsRef = useRef<Map<string, PerformanceMetric>>(new Map());

  const startTimer = useCallback((name: string) => {
    const startTime = performance.now();
    metricsRef.current.set(name, { name, startTime });
    console.log(`[PERF] ⏱️ Started: ${name}`);
    return startTime;
  }, []);

  const endTimer = useCallback((name: string) => {
    const metric = metricsRef.current.get(name);
    if (!metric) {
      console.warn(`[PERF] ⚠️ Timer '${name}' not found`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;

    // Color code based on performance thresholds
    const getColorCode = (duration: number) => {
      if (duration < 1000) return '🟢'; // Green - Good (<1s)
      if (duration < 2000) return '🟡'; // Yellow - Acceptable (1-2s)
      if (duration < 3000) return '🟠'; // Orange - Slow (2-3s)
      return '🔴'; // Red - Too slow (>3s)
    };

    console.log(`[PERF] ${getColorCode(duration)} ${name}=${duration.toFixed(0)}ms`);
    
    // Alert if critical operations are too slow
    if (name.includes('user-to-response') && duration > 2000) {
      console.error(`[PERF] 🚨 CRITICAL: ${name} took ${(duration/1000).toFixed(1)}s - exceeds 2s target!`);
    } else if (duration > 3000) {
      console.warn(`[PERF] ⚠️ SLOW: ${name} took ${(duration/1000).toFixed(1)}s - exceeds 3s threshold`);
    }

    return duration;
  }, []);

  const logPerf = useCallback((stage: string, duration: number, data?: any) => {
    const getColorCode = (duration: number) => {
      if (duration < 1000) return '🟢';
      if (duration < 2000) return '🟡';
      if (duration < 3000) return '🟠';
      return '🔴';
    };

    console.log(`[PERF] ${getColorCode(duration)} ${stage}=${duration}ms`, data ? JSON.stringify(data) : '');
  }, []);

  const getMetrics = useCallback(() => {
    return Array.from(metricsRef.current.values())
      .filter(m => m.duration !== undefined)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0));
  }, []);

  const resetMetrics = useCallback(() => {
    metricsRef.current.clear();
    console.log('[PERF] 🔄 Metrics reset');
  }, []);

  return {
    startTimer,
    endTimer,
    getMetrics,
    resetMetrics,
    logPerf
  };
};