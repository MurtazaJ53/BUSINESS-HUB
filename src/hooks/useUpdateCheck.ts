import { useState, useEffect } from 'react';

const VERSION_URL = 'https://raw.githubusercontent.com/MurtazaJ53/BUSINESS-HUB/main/version.json';
const CURRENT_VERSION = '1.0.0';

export interface UpdateMetadata {
  version: string;
  notes: string;
  downloadUrl: string;
}

export function useUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkVersion() {
      try {
        const response = await fetch(`${VERSION_URL}?t=${Date.now()}`); // Bypass cache
        if (!response.ok) throw new Error('Failed to fetch version metadata');
        
        const data: UpdateMetadata = await response.json();
        
        // Simple version comparison (supports 1.0.0 format)
        if (data.version !== CURRENT_VERSION) {
          setUpdateAvailable(data);
        }
      } catch (err) {
        console.error('Update check failed:', err);
      } finally {
        setLoading(false);
      }
    }

    checkVersion();
  }, []);

  return { updateAvailable, loading };
}
