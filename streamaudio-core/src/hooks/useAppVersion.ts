import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

export function useAppVersion() {
  const [version, setVersion] = useState<string>('v1.0.0');

  useEffect(() => {
    getVersion().then(v => setVersion('v' + v)).catch(console.error);
  }, []);

  return version;
}
