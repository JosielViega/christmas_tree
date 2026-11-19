import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import Scene from './components/Scene';
import Overlay from './components/Overlay';
import TreeOnboarding from './components/TreeOnboarding';
import { fetchApiContext } from './api/trees';
import { generatePhotoPositions } from './utils/math';
import { ChristmasTreeAccess, ChristmasTreeData, ControlMode, InteractionMode, PhotoData } from './types';
import { DEFAULT_PHOTOS_COUNT, PLACEHOLDER_TYPES } from './constants';
import { useAudio } from './hooks/useAudio';
import { useRecording } from './hooks/useRecording';
import { useTreeInteraction } from './hooks/useTreeInteraction';
import { processImageWithPadding } from './utils/image';

const initialBootstrap = window.__CHRISTMAS_TREE_BOOTSTRAP__;

const App: React.FC = () => {
  const [controlMode, setControlMode] = useState<ControlMode>(ControlMode.MOUSE);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(InteractionMode.VIEW);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [tree, setTree] = useState<ChristmasTreeData | null>(initialBootstrap?.tree ?? null);
  const [isOwner, setIsOwner] = useState(initialBootstrap?.is_owner ?? false);
  const [csrfToken, setCsrfToken] = useState(initialBootstrap?.csrf_token ?? '');
  const [initializing, setInitializing] = useState(!initialBootstrap);
  const [receipt, setReceipt] = useState<ChristmasTreeAccess | null>(null);
  const [userName, setUserName] = useState(initialBootstrap?.tree?.owner_name ?? '');
  const [isNameSet, setIsNameSet] = useState(Boolean(initialBootstrap?.tree));
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    if (initialBootstrap) return;

    fetchApiContext()
      .then((context) => setCsrfToken(context.csrf_token))
      .catch(() => showToast('Não foi possível iniciar a sessão. Recarregue a página.', 'error'))
      .finally(() => setInitializing(false));
  }, [showToast]);

  useEffect(() => {
    const positions = generatePhotoPositions(DEFAULT_PHOTOS_COUNT);
    const types = Object.values(PLACEHOLDER_TYPES);
    setPhotos(positions.map((pos, index) => ({
      id: `photo-${index}`,
      url: '',
      placeholderType: types[index % types.length],
      position: pos.position,
      rotation: pos.rotation,
    })));
  }, []);

  useEffect(() => {
    if (!isOwner) {
      setInteractionMode(InteractionMode.VIEW);
    }
  }, [isOwner]);

  const { isMusicPlaying, toggleMusic, audioRef } = useAudio();
  const { isRecording, recordingType, handleRecordVideo } = useRecording(photos, (message) => showToast(message, 'error'));
  const {
    zoomLevel,
    setZoomLevel,
    focusedPhoto,
    setFocusedPhoto,
    isExploded,
    panOffset,
    handlePhotoClick,
    handleNextPhoto,
    handlePrevPhoto,
    scrollToTop,
  } = useTreeInteraction({
    photos,
    interactionMode,
    isInstaModalOpen: false,
    isRecording,
  });

  const handleAccess = (access: ChristmasTreeAccess) => {
    const normalizedAccess = {
      ...access,
      public_url: new URL(access.public_path, window.location.origin).toString(),
    };
    setTree(access.tree);
    setIsOwner(true);
    setUserName(access.tree.owner_name);
    setIsNameSet(true);
    setInteractionMode(InteractionMode.VIEW);
    setReceipt(normalizedAccess);
    window.history.pushState({}, '', access.public_path);
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) return;
    scrollToTop();
  };

  const handleSingleUpload = async (id: string, file: File) => {
    if (!isOwner) return;

    const rawUrl = URL.createObjectURL(file);
    const url = await processImageWithPadding(rawUrl);
    if (url !== rawUrl) URL.revokeObjectURL(rawUrl);

    const photoToUpdate = photos.find((photo) => photo.id === id);
    if (!photoToUpdate) return;

    const updatedPhoto = { ...photoToUpdate, url };
    setPhotos((current) => current.map((photo) => photo.id === id ? updatedPhoto : photo));
    setInteractionMode(InteractionMode.VIEW);
    handlePhotoClick(updatedPhoto);
  };

  const handleBulkUpload = async (files: FileList) => {
    if (!isOwner) return;

    const newFiles = Array.from(files);
    const newPhotos = [...photos];
    const sortedIndices = newPhotos
      .map((photo, index) => ({ y: photo.position[1], index }))
      .sort((first, second) => second.y - first.y)
      .map((item) => item.index);
    let fileIndex = 0;
    let lastAddedPhoto: PhotoData | null = null;

    for (const index of sortedIndices) {
      if (fileIndex >= newFiles.length) break;
      const rawUrl = URL.createObjectURL(newFiles[fileIndex]);
      const url = await processImageWithPadding(rawUrl);
      if (url !== rawUrl) URL.revokeObjectURL(rawUrl);
      newPhotos[index] = { ...newPhotos[index], url };
      lastAddedPhoto = newPhotos[index];
      fileIndex++;
    }

    setPhotos(newPhotos);
    if (lastAddedPhoto) {
      setInteractionMode(InteractionMode.VIEW);
      handlePhotoClick(lastAddedPhoto);
    }
  };

  const handleDeletePhoto = (id: string) => {
    if (!isOwner) return;
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    if (focusedPhoto?.id === id) setFocusedPhoto(null);
  };

  return (
    <div className="relative w-full h-full bg-[#050505]" onDoubleClick={handleDoubleClick}>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}assets/music/christmas-song.mp3`} loop preload="metadata" />

      <Scene
        photos={photos}
        onUpload={handleSingleUpload}
        onPhotoClick={handlePhotoClick}
        onDelete={handleDeletePhoto}
        controlMode={controlMode}
        interactionMode={isOwner ? interactionMode : InteractionMode.VIEW}
        zoomLevel={zoomLevel}
        panOffset={panOffset}
        focusedPhoto={focusedPhoto}
        isExploded={isExploded}
        isRecording={isRecording}
        recordingType={recordingType}
        userName={userName}
      />

      <Overlay
        controlMode={controlMode}
        setControlMode={setControlMode}
        interactionMode={interactionMode}
        setInteractionMode={setInteractionMode}
        onBulkUpload={handleBulkUpload}
        onOpenInstagram={() => undefined}
        onNext={handleNextPhoto}
        onPrev={handlePrevPhoto}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        isHandReady={false}
        isMusicPlaying={isMusicPlaying}
        toggleMusic={toggleMusic}
        userName={userName}
        setUserName={setUserName}
        isNameSet={isNameSet}
        setIsNameSet={setIsNameSet}
        onRecordVideo={handleRecordVideo}
        isRecording={isRecording}
        isExploded={isExploded}
        visitCount={0}
        canEdit={isOwner}
        treeOwnerName={tree?.owner_name ?? null}
      />

      {initializing && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 text-[#fff1a1]">
          <Loader2 className="animate-spin" size={30} aria-label="Carregando" />
        </div>
      )}

      {!initializing && (!tree || receipt) && (
        <TreeOnboarding csrfToken={csrfToken} receipt={receipt} onAccess={handleAccess} onCloseReceipt={() => setReceipt(null)} />
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-8 fade-in duration-300">
          <div className={`min-w-[300px] max-w-md p-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${toast.type === 'error' ? 'bg-red-950/40 border-red-500/30 text-red-100' : 'bg-green-950/40 border-green-500/30 text-green-100'} flex items-start gap-4 relative overflow-hidden group`}>
            <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full" />
            <div className={`absolute bottom-0 left-0 h-1 ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'} animate-[shrink_5s_linear_forwards]`} />
            <div className={`p-2 rounded-xl ${toast.type === 'error' ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-400" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
            </div>
            <div className="flex-1 pt-0.5">
              <h4 className="text-sm font-bold tracking-tight mb-1">{toast.type === 'error' ? 'Não foi possível concluir' : 'Tudo certo!'}</h4>
              <p className="text-xs text-white/70 leading-relaxed font-medium">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white" aria-label="Fechar aviso">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
