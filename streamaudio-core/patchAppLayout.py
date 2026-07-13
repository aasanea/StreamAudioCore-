import os

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

split_str = '  return (\n    <div className="h-screen w-full flex flex-col'
parts = code.split(split_str)

if len(parts) > 1:
    top_part = parts[0]
    if 'import { AppLayout }' not in top_part:
        top_part = top_part.replace(
            "import { TitleBar } from './components/TitleBar';",
            "import { TitleBar } from './components/TitleBar';\nimport { AppLayout } from './components/layout/AppLayout';"
        )

    new_return = '''  return (
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
'''
    with open('src/App.tsx', 'w', encoding='utf-8') as f:
        f.write(top_part + new_return)
    print("Patched App.tsx successfully")
else:
    print("Could not find split string")
