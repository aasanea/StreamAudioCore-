import { useState, useEffect } from "react";
import * as cloudService from "../services/cloudService";
import * as dialogService from "../services/dialogService";
import { CommunityPack, SyncReport } from "../types";

export function useCloudSync(
  fetchConfig: () => Promise<void>,
  showAlert: (msg: string, title?: string) => void
) {
  const [dropboxCode, setDropboxCode] = useState("");
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [communityPacks, setCommunityPacks] = useState<CommunityPack[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [publishingPack, setPublishingPack] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishDesc, setPublishDesc] = useState("");
  const [selectedSoundsForPack, setSelectedSoundsForPack] = useState<Record<string, boolean>>({});

  const fetchCommunityPacks = async () => {
    setLoadingPacks(true);
    try {
      const packs = await cloudService.getCommunityPacks();
      setCommunityPacks(packs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPacks(false);
    }
  };

  useEffect(() => {
    fetchCommunityPacks();
  }, []);

  const handleGetAuthCode = async () => {
    try {
      const url = await cloudService.generateAuthUrl();
      // Open default browser
      window.open(url, "_blank");
    } catch (err) {
      showAlert(`Failed to generate Auth URL: ${err}`);
    }
  };

  const handleExchangeCode = async () => {
    if (!dropboxCode) return;
    try {
      const msg = await cloudService.exchangeCode(dropboxCode.trim());
      showAlert(msg);
      fetchConfig();
      setDropboxCode("");
    } catch (err) {
      showAlert(`OAuth exchange failed: ${err}`);
    }
  };

  const handleUnlinkDropbox = async () => {
    try {
      const msg = await cloudService.cloudUnlink("dropbox");
      showAlert(msg);
      fetchConfig();
    } catch (err) {
      showAlert(`Unlink failed: ${err}`);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncReport(null);
    try {
      const report = await cloudService.cloudSyncNow();
      setSyncReport(report);
    } catch (err) {
      showAlert(`Sync failed: ${err}`);
    } finally {
      setSyncing(false);
    }
  };

  const handlePublishPack = async () => {
    if (!publishTitle || !publishDesc) {
      showAlert("يرجى ملء تفاصيل عنوان وصف الحزمة.");
      return;
    }

    const soundIds = Object.keys(selectedSoundsForPack).filter(k => selectedSoundsForPack[k]);
    if (soundIds.length === 0) {
      showAlert("يرجى تحديد مؤثر صوتي واحد على الأقل للمشاركة.");
      return;
    }

    setPublishingPack(true);
    try {
      const msg = await cloudService.publishPack(publishTitle.trim(), publishDesc.trim(), soundIds);
      showAlert(msg);
      setPublishTitle("");
      setPublishDesc("");
      setSelectedSoundsForPack({});
      fetchCommunityPacks();
    } catch (err) {
      showAlert(`Publish error: ${err}`);
    } finally {
      setPublishingPack(false);
    }
  };

  const handleRatePack = async (packId: string, rating: number) => {
    try {
      await cloudService.rateCommunityPack(packId, rating);
      fetchCommunityPacks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleImportPack = async () => {
    try {
      const path = await dialogService.selectPackFile();
      if (!path) return;
      const msg = await cloudService.importSoundPack(path);
      showAlert(msg);
      fetchConfig();
    } catch (err) {
      showAlert(`Import error: ${err}`);
    }
  };

  const handleInstallCommunityPack = async (url: string) => {
    try {
      const msg = await cloudService.downloadAndImportCommunityPack(url);
      showAlert(msg);
      fetchConfig();
    } catch (err) {
      showAlert(`Failed to install pack: ${err}`);
    }
  };

  return {
    dropboxCode,
    setDropboxCode,
    syncReport,
    syncing,
    communityPacks,
    loadingPacks,
    publishingPack,
    publishTitle,
    setPublishTitle,
    publishDesc,
    setPublishDesc,
    selectedSoundsForPack,
    setSelectedSoundsForPack,
    handleGetAuthCode,
    handleExchangeCode,
    handleUnlinkDropbox,
    handleSyncNow,
    handlePublishPack,
    handleRatePack,
    handleImportPack,
    handleInstallCommunityPack,
    fetchCommunityPacks
  };
}
