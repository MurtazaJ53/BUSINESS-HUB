import { useState, useEffect, useCallback, useRef } from 'react';

const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION || '1.3.6';
const BACKGROUND_POLL_INTERVAL = 1000 * 60 * 60 * 4; // 4 Hours

const REMOTE_VERSION_URL = import.meta.env.VITE_UPDATE_URL || 'https://raw.githubusercontent.com/MurtazaJ53/BUSINESS-HUB/main/version.json';

const getVersionUrls = (): string[] => {
  const localVersionUrl = new URL('./version.json', window.location.href).toString();
  return Array.from(new Set([localVersionUrl, REMOTE_VERSION_URL].filter(Boolean)));
};

export interface UpdateMetadata {
  version: string;
  notes: string;
  downloadUrl: string;
  mandatory?: boolean;
  releaseDate?: string;
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'error';

const isNewerVersion = (local: string, remote: string): boolean => {
  const cleanLocal = local.replace(/[^0-9.]/g, '').split('.').map(Number);
  const cleanRemote = remote.replace(/[^0-9.]/g, '').split('.').map(Number);
  
  const maxLength = Math.max(cleanLocal.length, cleanRemote.length);
  
  for (let i = 0; i < maxLength; i++) {
    const lVal = cleanLocal[i] || 0;
    const rVal = cleanRemote[i] || 0;
    if (rVal > lVal) return true;
    if (rVal < lVal) return false;
  }
  return false;
};

export function useUpdateCheck(autoPoll = true) {
  const [updateData, setUpdateData] = useState<UpdateMetadata | null>(null);
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  
  const isCheckingRef = useRef(false);

  const checkForUpdates = useCallback(async (silent = false) => {
    if (isCheckingRef.current) return;
    
    isCheckingRef.current = true;
    if (!silent) setStatus('checking');

    try {
      let data: UpdateMetadata | null = null;
      let lastError: unknown = null;

      for (const url of getVersionUrls()) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            },
            signal: controller.signal
          });

          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }

          data = await response.json();
          break;
        } catch (err: unknown) {
          lastError = err;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      if (!data) throw lastError ?? new Error('Unable to load version metadata.');
      
      if (isNewerVersion(CURRENT_VERSION, data.version)) {
        setUpdateData(data);
        setStatus('available');
      } else {
        setStatus('up-to-date');
      }

      setLastChecked(new Date());
    } catch (err: unknown) {
      if (!silent) {
        console.error('[Update Monitor] Version check failed:', err);
      }
      if (!silent) setStatus('error');
    } finally {
      isCheckingRef.current = false;
    }
  }, []);

  useEffect(() => {
    checkForUpdates(true);

    let intervalId: NodeJS.Timeout;
    if (autoPoll) {
      intervalId = setInterval(() => {
        checkForUpdates(true);
      }, BACKGROUND_POLL_INTERVAL);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [checkForUpdates, autoPoll]);

  return { 
    updateData, 
    status, 
    lastChecked,
    updateAvailable: updateData, // Alias for backward compatibility
    isUpdateAvailable: status === 'available',
    isChecking: status === 'checking',
    checkForUpdates
  };
}
