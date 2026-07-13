const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Find the main return statement. It is right after const publishStateMemo = useMemo...
const splitStr = '  return (\n    <div className="h-screen w-full flex flex-col';
const parts = code.split(splitStr);

if (parts.length > 1) {
  let topPart = parts[0];
  
  // We need to add the import for AppLayout
  if (!topPart.includes('AppLayout')) {
    topPart = topPart.replace(
      "import { TitleBar } from './components/TitleBar';",
      "import { TitleBar } from './components/TitleBar';\nimport { AppLayout } from './components/layout/AppLayout';"
    );
  }

  const newReturn =   return (
    <AppLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab as any} 
      isSidebarCollapsed={isSidebarCollapsed} 
      setIsSidebarCollapsed={setIsSidebarCollapsed}
      globalOutputDevice={globalOutputDevice}
    >
      <AnimatePresence mode="wait">
        {activeTab === "library" && (
          <motion.div 
            key="library"
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="p-8 h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar"
          >
            <LibraryView
              isDraggingFile={isDraggingFile}
              newSoundName={newSoundName}
              setNewSoundName={setNewSoundName}
              newSoundPath={newSoundPath}
              setNewSoundPath={setNewSoundPath}
              newSoundTags={newSoundTags}
              setNewSoundTags={setNewSoundTags}
              isPreviewPlaying={isPreviewPlaying}
              filteredSounds={filteredSoundsMemo}
              playingStates={playingStates}
              togglePlayPause={togglePlayPause}
              handleStopAll={handleStopAll}
              handleRemoveSound={handleRemoveSound}
              setAssigningSoundIdForPads={setAssigningSoundIdForPads}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              config={config}
              saveConfig={saveConfig}
              showAlert={showAlert}
            />
          </motion.div>
        )}

        {activeTab === "sampler" && (
          <motion.div 
            key="sampler"
            initial={{ opacity: 0, scale: 0.98 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.98 }}
            className="p-8 h-full flex flex-col items-center overflow-y-auto custom-scrollbar"
          >
            <SamplerView
              pagination={paginationMemo}
              padInteractions={padInteractionsMemo}
              deviceOutputState={deviceOutputStateMemo}
              config={config}
              playingStates={playingStates}
            />
          </motion.div>
        )}

        {activeTab === "cloud" && (
          <motion.div 
            key="cloud"
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="p-8 h-full flex flex-col overflow-y-auto custom-scrollbar"
          >
            <CloudView
              cloudData={cloudDataMemo}
              cloudActions={cloudActionsMemo}
              syncState={syncStateMemo}
              publishState={publishStateMemo}
            />
          </motion.div>
        )}

        {activeTab === "downloader" && (
          <motion.div 
            key="downloader"
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="h-full w-full"
          >
            <DownloaderTab />
          </motion.div>
        )}
      </AnimatePresence>

      <AssignSoundModal 
        assignState={assignStateMemo}
        assignActions={assignActionsMemo}
        modalPage={modalPage}
        setModalPage={setModalPage}
        setAssigningSoundIdForPads={setAssigningSoundIdForPads}
        assigningSoundIdForPads={assigningSoundIdForPads}
      />

      <PadEditModal 
        padSettingsState={padSettingsStateMemo}
        padSettingsActions={padSettingsActionsMemo}
        deviceOutputState={deviceOutputStateMemo}
      />
    </AppLayout>
  );
}

export default App;
;

  fs.writeFileSync('src/App.tsx', topPart + newReturn);
  console.log("Patched App.tsx successfully!");
} else {
  console.log("Could not find the split string in App.tsx!");
}
