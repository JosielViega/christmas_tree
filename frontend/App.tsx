import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Gift, Loader2, LockKeyhole, MailOpen, Share2, Trash2, TreePine, X } from 'lucide-react';
import Scene from './components/Scene';
import Overlay from './components/Overlay';
import TreeOnboarding from './components/TreeOnboarding';
import OrnamentDecorationModal from './components/OrnamentDecorationModal';
import ShareTreeModal from './components/ShareTreeModal';
import TreeProgressIndicator from './components/TreeProgressIndicator';
import GiftPreviewModal from './components/GiftPreviewModal';
import { createOrnament, deleteOrnament, fetchApiContext, fetchOrnaments, fetchOwnerMessages, fetchPremiumGifts, hidePremiumGift, TreeApiError } from './api/trees';
import { generatePhotoPositions, getOrnamentSlot } from './utils/math';
import { ChristmasTreeAccess, ChristmasTreeData, ControlMode, InteractionMode, OrnamentType, PhotoData, PremiumGiftData, SecretTreeMessage, SocialOrnamentData, ZoomLevel } from './types';
import { DEFAULT_PHOTOS_COUNT, ORNAMENT_SLOT_COUNT, PLACEHOLDER_TYPES } from './constants';
import { useAudio } from './hooks/useAudio';
import { useRecording } from './hooks/useRecording';
import { useTreeInteraction } from './hooks/useTreeInteraction';
import { processImageWithPadding } from './utils/image';
import type { StoryFrameCapture } from './utils/socialSharing';
import type { StoryVideoSceneCapture } from './utils/videoRecording';
import {
  getTreeProgressionFromOrnaments,
  getUnlockedProgressionStage,
  shouldAnimateProgressionUnlock,
} from './utils/treeProgression';
import type { TreeProgressionStage } from './utils/treeProgression';
import { getGiftPhotoMaxBytes, isGiftPreviewEnabled } from './utils/giftTextures';
import { getPremiumGiftTransform } from './utils/premiumGiftLayout';

const initialBootstrap = window.__CHRISTMAS_TREE_BOOTSTRAP__;
const giftPreviewEnabled = isGiftPreviewEnabled(import.meta.env.DEV, import.meta.env.VITE_ENABLE_GIFT_PREVIEW);
const giftPhotoMaxBytes = getGiftPhotoMaxBytes(import.meta.env.VITE_GIFT_PHOTO_MAX_BYTES);

const App: React.FC = () => {
  const [controlMode, setControlMode] = useState<ControlMode>(ControlMode.MOUSE);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(InteractionMode.VIEW);
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [tree, setTree] = useState<ChristmasTreeData | null>(initialBootstrap?.tree ?? null);
  const [publicTreeUrl, setPublicTreeUrl] = useState(initialBootstrap?.public_url ?? '');
  const [isOwner, setIsOwner] = useState(initialBootstrap?.is_owner ?? false);
  const [csrfToken, setCsrfToken] = useState(initialBootstrap?.csrf_token ?? '');
  const [initializing, setInitializing] = useState(!initialBootstrap);
  const [receipt, setReceipt] = useState<ChristmasTreeAccess | null>(null);
  const [userName, setUserName] = useState(initialBootstrap?.tree?.owner_name ?? '');
  const [isNameSet, setIsNameSet] = useState(Boolean(initialBootstrap?.tree));
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [ornaments, setOrnaments] = useState<SocialOrnamentData[]>([]);
  const [ornamentCapacity, setOrnamentCapacity] = useState(ORNAMENT_SLOT_COUNT);
  const [ornamentsLoading, setOrnamentsLoading] = useState(false);
  const [ornamentsReady, setOrnamentsReady] = useState(false);
  const [ornamentModalOpen, setOrnamentModalOpen] = useState(false);
  const [selectedOrnament, setSelectedOrnament] = useState<SocialOrnamentData | null>(null);
  const [premiumGifts, setPremiumGifts] = useState<PremiumGiftData[]>([]);
  const [premiumGiftPage, setPremiumGiftPage] = useState(0);
  const [premiumGiftLimit, setPremiumGiftLimit] = useState(12);
  const [selectedGift, setSelectedGift] = useState<PremiumGiftData | null>(null);
  const [hidingGift, setHidingGift] = useState(false);
  const [newOrnamentId, setNewOrnamentId] = useState<string | null>(null);
  const [deletingOrnament, setDeletingOrnament] = useState(false);
  const [ownerMessages, setOwnerMessages] = useState<Record<string, SecretTreeMessage>>({});
  const [messageOverview, setMessageOverview] = useState<{ count: number; revealed: boolean; revealAt: string } | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createOwnTreeOpen, setCreateOwnTreeOpen] = useState(false);
  const [giftPreviewOpen, setGiftPreviewOpen] = useState(false);
  const [unlockedProgressionStage, setUnlockedProgressionStage] = useState<TreeProgressionStage | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const loadedOrnamentsFor = useRef<string | null>(null);
  const loadedMessagesFor = useRef<string | null>(null);
  const storyCaptureRef = useRef<StoryFrameCapture | null>(null);
  const storyVideoCaptureRef = useRef<StoryVideoSceneCapture | null>(null);
  const progressionDismissTimer = useRef<number | null>(null);

  const registerStoryCapture = useCallback((capture: StoryFrameCapture | null) => {
    storyCaptureRef.current = capture;
  }, []);

  const captureStoryFrame = useCallback(async () => {
    if (!storyCaptureRef.current) throw new Error('A cena 3D ainda não está pronta para captura.');
    return storyCaptureRef.current();
  }, []);

  const registerStoryVideoCapture = useCallback((capture: StoryVideoSceneCapture | null) => {
    storyVideoCaptureRef.current = capture;
  }, []);

  const startStoryVideoCapture: StoryVideoSceneCapture = useCallback(async (options) => {
    if (!storyVideoCaptureRef.current) throw new Error('A cena 3D ainda não está pronta para gravação.');
    return storyVideoCaptureRef.current(options);
  }, []);

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 5000);
  }, []);

  const progression = useMemo(() => getTreeProgressionFromOrnaments(ornaments), [ornaments]);
  const isProgressionCelebrating = shouldAnimateProgressionUnlock(unlockedProgressionStage, reducedMotion);

  const dismissProgressionUnlock = useCallback(() => {
    if (progressionDismissTimer.current !== null) window.clearTimeout(progressionDismissTimer.current);
    progressionDismissTimer.current = null;
    setUnlockedProgressionStage(null);
  }, []);

  const announceProgressionUnlock = useCallback((stage: TreeProgressionStage) => {
    if (progressionDismissTimer.current !== null) window.clearTimeout(progressionDismissTimer.current);
    setUnlockedProgressionStage(stage);
    showToast('🎁 Sua árvore ganhou uma nova surpresa!', 'success');
    progressionDismissTimer.current = window.setTimeout(() => {
      progressionDismissTimer.current = null;
      setUnlockedProgressionStage(null);
    }, 6000);
  }, [showToast]);

  useEffect(() => {
    const preference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!preference) return;
    const updatePreference = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    preference.addEventListener?.('change', updatePreference);
    return () => preference.removeEventListener?.('change', updatePreference);
  }, []);

  useEffect(() => () => {
    if (progressionDismissTimer.current !== null) window.clearTimeout(progressionDismissTimer.current);
  }, []);

  const loadOwnerMessages = useCallback(async (publicId: string, force = false) => {
    if (!force && loadedMessagesFor.current === publicId) return;
    loadedMessagesFor.current = publicId;
    setMessagesLoading(true);
    try {
      const collection = await fetchOwnerMessages(publicId);
      setOwnerMessages(Object.fromEntries(collection.messages.map((message) => [message.ornament_public_id, message])));
      setMessageOverview({ count: collection.message_count, revealed: true, revealAt: collection.reveal_at });
    } catch (caught) {
      if (caught instanceof TreeApiError && caught.code === 'messages_locked') {
        setOwnerMessages({});
        setMessageOverview({
          count: caught.metadata.message_count ?? 0,
          revealed: false,
          revealAt: caught.metadata.reveal_at ?? '2026-12-25T03:00:00Z',
        });
      } else {
        loadedMessagesFor.current = null;
        showToast('Não foi possível consultar suas mensagens especiais.', 'error');
      }
    } finally {
      setMessagesLoading(false);
    }
  }, [showToast]);

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

  useEffect(() => {
    if (!tree || loadedOrnamentsFor.current === tree.public_id) return;
    loadedOrnamentsFor.current = tree.public_id;
    setOrnamentsLoading(true);
    setOrnamentsReady(false);
    fetchOrnaments(tree.public_id)
      .then((collection) => {
        setOrnaments(collection.ornaments);
        setOrnamentCapacity(collection.capacity);
        setOrnamentsReady(true);
      })
      .catch(() => {
        loadedOrnamentsFor.current = null;
        showToast('Não foi possível carregar os enfeites desta árvore.', 'error');
      })
      .finally(() => setOrnamentsLoading(false));
  }, [tree, showToast]);

  useEffect(() => {
    if (!tree) { setPremiumGifts([]); return; }
    let active = true;
    const load = () => fetchPremiumGifts(tree.public_id).then((collection) => {
      if (!active) return;
      setPremiumGifts(collection.gifts);
      setPremiumGiftLimit(collection.visible_limit);
      setPremiumGiftPage((page) => Math.min(page, Math.max(0, Math.ceil(collection.total / collection.visible_limit) - 1)));
    }).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [tree]);

  useEffect(() => {
    if (!tree || !isOwner) {
      loadedMessagesFor.current = null;
      setOwnerMessages({});
      setMessageOverview(null);
      return;
    }
    void loadOwnerMessages(tree.public_id);
  }, [tree, isOwner, loadOwnerMessages]);

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
    setTree(access.tree);
    setPublicTreeUrl(access.public_url);
    setIsOwner(true);
    setUserName(access.tree.owner_name);
    setIsNameSet(true);
    setInteractionMode(InteractionMode.VIEW);
    setReceipt(access);
    setOrnaments([]);
    setOrnamentsReady(false);
    dismissProgressionUnlock();
    loadedOrnamentsFor.current = null;
    loadedMessagesFor.current = null;
    setOwnerMessages({});
    setMessageOverview(null);
    setCreateOwnTreeOpen(false);
    setShareModalOpen(false);
    setGiftPreviewOpen(false);
    window.history.pushState({}, '', access.public_path);
  };

  const focusOrnament = (ornament: SocialOrnamentData) => {
    const slot = getOrnamentSlot(ornament.slot_index, ornament.layout_version);
    setSelectedOrnament(ornament);
    setSelectedGift(null);
    setFocusedPhoto({
      id: `ornament-${ornament.public_id}`,
      url: '',
      position: slot.position,
      rotation: slot.rotation,
    });
    setZoomLevel(ZoomLevel.ZOOMED_IN);
  };

  const focusPremiumGift = (gift: PremiumGiftData) => {
    const transform = getPremiumGiftTransform(gift.position_index, gift.layout_version);
    setSelectedGift(gift);
    setSelectedOrnament(null);
    setFocusedPhoto({ id: `premium-gift-${gift.public_id}`, url: '', position: transform.position, rotation: transform.rotation });
    setZoomLevel(ZoomLevel.ZOOMED_IN);
  };

  const closeFocusedItem = () => {
    setSelectedGift(null);
    setSelectedOrnament(null);
    setFocusedPhoto(null);
    scrollToTop();
  };

  const handleHideGift = async () => {
    if (!tree || !selectedGift || !isOwner || hidingGift) return;
    if (!window.confirm(`Ocultar o presente enviado por ${selectedGift.sender_name}? O pagamento e o histórico serão preservados.`)) return;
    setHidingGift(true);
    try {
      await hidePremiumGift(tree.public_id, selectedGift.public_id, csrfToken);
      setPremiumGifts((current) => current.filter((gift) => gift.public_id !== selectedGift.public_id));
      closeFocusedItem();
      showToast('Presente ocultado. O registro financeiro foi preservado.', 'success');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Não foi possível ocultar o presente.', 'error');
    } finally { setHidingGift(false); }
  };

  const handleCreateOrnament = async (type: OrnamentType, senderName: string, message: string, idempotencyKey: string) => {
    if (!tree) throw new Error('Árvore não encontrada.');
    try {
      const response = await createOrnament(tree.public_id, type, senderName, message, csrfToken, idempotencyKey);
      setOrnamentCapacity(response.capacity);
      const alreadyPersisted = ornaments.some((item) => item.public_id === response.ornament.public_id);
      const unlockedStage = alreadyPersisted
        ? null
        : getUnlockedProgressionStage(ornaments.length, ornaments.length + 1, 'persisted-addition');
      setOrnaments((current) => current.some((item) => item.public_id === response.ornament.public_id) ? current : [...current, response.ornament]);
      setOrnamentsReady(true);
      if (unlockedStage) announceProgressionUnlock(unlockedStage);
      setNewOrnamentId(response.ornament.public_id);
      window.setTimeout(() => setNewOrnamentId(null), 5000);
      focusOrnament(response.ornament);
      if (isOwner) void loadOwnerMessages(tree.public_id, true);
      return response.ornament;
    } catch (caught) {
      if (caught instanceof TreeApiError) {
        throw new Error(caught.fields.message?.[0] ?? caught.fields.sender_name?.[0] ?? caught.fields.ornament_type?.[0] ?? caught.message);
      }
      throw caught;
    }
  };

  const handleDeleteOrnament = async () => {
    if (!tree || !selectedOrnament || !isOwner || deletingOrnament) return;
    if (!window.confirm(`Remover o enfeite deixado por ${selectedOrnament.sender_name}?`)) return;
    setDeletingOrnament(true);
    try {
      await deleteOrnament(tree.public_id, selectedOrnament.public_id, csrfToken);
      setOrnaments((current) => current.filter((item) => item.public_id !== selectedOrnament.public_id));
      setOwnerMessages((current) => {
        const next = { ...current };
        delete next[selectedOrnament.public_id];
        return next;
      });
      if (selectedOrnament.has_message) {
        setMessageOverview((current) => current ? { ...current, count: Math.max(0, current.count - 1) } : current);
      }
      setSelectedOrnament(null);
      setFocusedPhoto(null);
      scrollToTop();
      showToast('Enfeite removido.', 'success');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Não foi possível remover o enfeite.', 'error');
    } finally {
      setDeletingOrnament(false);
    }
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
        ornaments={ornaments}
        newOrnamentId={newOrnamentId}
        onOrnamentSelect={focusOrnament}
        premiumGifts={premiumGifts.slice(premiumGiftPage * premiumGiftLimit, (premiumGiftPage + 1) * premiumGiftLimit)}
        onPremiumGiftSelect={focusPremiumGift}
        onStoryCaptureReady={registerStoryCapture}
        onStoryVideoCaptureReady={registerStoryVideoCapture}
        progressionEffects={progression.stage.effects}
        isProgressionCelebrating={isProgressionCelebrating}
        reducedMotion={reducedMotion}
        paused={giftPreviewOpen}
      />

      {!selectedOrnament && !selectedGift && <Overlay
        controlMode={controlMode}
        setControlMode={setControlMode}
        interactionMode={interactionMode}
        setInteractionMode={setInteractionMode}
        onBulkUpload={handleBulkUpload}
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
        canEdit={isOwner}
        treeOwnerName={tree?.owner_name ?? null}
      />}

      {initializing && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 text-[#fff1a1]">
          <Loader2 className="animate-spin" size={30} aria-label="Carregando" />
        </div>
      )}

      {!initializing && (!tree || receipt || createOwnTreeOpen) && (
        <TreeOnboarding
          csrfToken={csrfToken}
          receipt={receipt}
          onAccess={handleAccess}
          onCloseReceipt={() => setReceipt(null)}
          onCancel={tree && !receipt ? () => setCreateOwnTreeOpen(false) : undefined}
        />
      )}

      {tree && !receipt && !isRecording && !giftPreviewOpen && !selectedOrnament && !selectedGift && (
        <div className="fixed bottom-32 left-1/2 z-[70] flex w-[min(94vw,48rem)] -translate-x-1/2 flex-wrap justify-center gap-2 pointer-events-auto md:bottom-28">
          <button
            type="button"
            onClick={() => setOrnamentModalOpen(true)}
            disabled={ornamentsLoading || ornaments.length >= ornamentCapacity}
            className="min-h-12 rounded-full bg-[#1cbd62] px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-[#24cf70] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ornamentsLoading ? 'Carregando enfeites…' : ornaments.length >= ornamentCapacity ? '🎄 Árvore completa' : '🎄 Decorar gratuitamente'}
          </button>
          {isOwner ? (
            <button type="button" onClick={() => { scrollToTop(); setSelectedOrnament(null); setFocusedPhoto(null); setZoomLevel(ZoomLevel.FULL_TREE); setShareModalOpen(true); }} className="flex min-h-12 items-center gap-2 rounded-full border border-[#fff1a1]/30 bg-[#07120d]/90 px-5 py-3 text-sm font-semibold text-[#fff1a1] shadow-xl backdrop-blur-xl hover:bg-[#10271c]"><Share2 size={17} /> Compartilhar minha árvore 🎄</button>
          ) : (
            <button type="button" onClick={() => setCreateOwnTreeOpen(true)} className="flex min-h-12 items-center gap-2 rounded-full border border-[#fff1a1]/25 bg-[#07120d]/90 px-5 py-3 text-sm font-semibold text-[#fff1a1] shadow-xl backdrop-blur-xl hover:bg-[#10271c]"><TreePine size={17} /> Criar minha árvore</button>
          )}
          {giftPreviewEnabled && (
            <button type="button" onClick={() => setGiftPreviewOpen(true)} className="flex min-h-12 items-center gap-2 rounded-full border border-white/15 bg-black/55 px-5 py-3 text-sm font-semibold text-white/75 shadow-xl backdrop-blur-xl hover:bg-white/10"><Gift size={17} /> Enviar presente especial</button>
          )}
        </div>
      )}

      {premiumGifts.length > premiumGiftLimit && !selectedGift && !selectedOrnament && !giftPreviewOpen && (
        <div className="fixed bottom-20 left-1/2 z-[69] flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/65 px-4 py-2 text-xs text-white/70 backdrop-blur-xl">
          <button type="button" disabled={premiumGiftPage === 0} onClick={() => setPremiumGiftPage((page) => Math.max(0, page - 1))} className="disabled:opacity-30">←</button>
          <span>Presentes {premiumGiftPage + 1}/{Math.ceil(premiumGifts.length / premiumGiftLimit)}</span>
          <button type="button" disabled={(premiumGiftPage + 1) * premiumGiftLimit >= premiumGifts.length} onClick={() => setPremiumGiftPage((page) => page + 1)} className="disabled:opacity-30">→</button>
        </div>
      )}

      {tree && !receipt && ornamentsReady && !isRecording && !giftPreviewOpen && !selectedOrnament && !selectedGift && (
        <TreeProgressIndicator
          progression={progression}
          isOwner={isOwner}
          unlockedStage={unlockedProgressionStage}
          onDismissUnlock={dismissProgressionUnlock}
        />
      )}

      {tree && isOwner && messageOverview && !receipt && !selectedOrnament && !selectedGift && (
        <div className="fixed right-3 top-24 z-[65] max-w-[min(80vw,19rem)] rounded-2xl border border-[#fff1a1]/20 bg-[#07120d]/80 px-4 py-3 text-right text-white shadow-xl backdrop-blur-xl pointer-events-none">
          <p className="text-xs font-semibold text-[#fff1a1]">🎁 Você recebeu {messageOverview.count} {messageOverview.count === 1 ? 'mensagem especial' : 'mensagens especiais'}!</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/50">
            {messagesLoading ? 'Consultando presentes…' : messageOverview.revealed ? 'Seus presentes de Natal estão disponíveis!' : 'Suas mensagens serão reveladas em 25 de dezembro.'}
          </p>
        </div>
      )}

      {ornamentModalOpen && tree && (
        <OrnamentDecorationModal
          treeOwnerName={tree.owner_name}
          remaining={Math.max(0, ornamentCapacity - ornaments.length)}
          onClose={() => setOrnamentModalOpen(false)}
          onSubmit={handleCreateOrnament}
          onCreateOwnTree={() => { setOrnamentModalOpen(false); setCreateOwnTreeOpen(true); }}
        />
      )}

      {shareModalOpen && tree && isOwner && (
        <ShareTreeModal
          ownerName={tree.owner_name}
          ornamentCount={ornaments.length}
          publicUrl={publicTreeUrl}
          captureFrame={captureStoryFrame}
          startVideoCapture={startStoryVideoCapture}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {giftPreviewEnabled && giftPreviewOpen && (
        <GiftPreviewModal
          maxPhotoBytes={giftPhotoMaxBytes}
          treePublicId={tree?.public_id ?? ''}
          csrfToken={csrfToken}
          onClose={() => setGiftPreviewOpen(false)}
        />
      )}

      {selectedOrnament && !ornamentModalOpen && (
        <div className="fixed left-1/2 top-24 z-[75] w-[min(92vw,22rem)] -translate-x-1/2 animate-in fade-in zoom-in-95 rounded-2xl border border-white/15 bg-black/75 p-4 text-center text-white shadow-2xl backdrop-blur-xl pointer-events-auto motion-reduce:animate-none" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={closeFocusedItem} className="absolute right-2 top-2 rounded-full p-2 text-white/50 hover:bg-white/10" aria-label="Voltar à árvore"><X size={17} /></button>
          {ownerMessages[selectedOrnament.public_id] ? <MailOpen className="mx-auto text-[#fff1a1]" size={25} /> : <Gift className="mx-auto text-[#fff1a1]" size={24} />}
          <p className="mt-2 font-semibold">🎁 Presente de {selectedOrnament.sender_name}</p>
          <p className="mt-1 text-xs text-white/45">Posição {selectedOrnament.slot_index + 1} de {ORNAMENT_SLOT_COUNT}</p>
          {!selectedOrnament.has_message ? (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/55">Este enfeite foi criado antes das mensagens secretas.</p>
          ) : ownerMessages[selectedOrnament.public_id] ? (
            <p className="mt-3 whitespace-pre-wrap rounded-xl border border-[#fff1a1]/20 bg-[#fff1a1]/10 p-4 text-left text-sm leading-relaxed text-white/85">{ownerMessages[selectedOrnament.public_id].message}</p>
          ) : (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
              <LockKeyhole className="mx-auto mb-2 text-[#fff1a1]/70" size={20} />
              <p className="font-semibold text-white/75">Mensagem secreta</p>
              <p className="mt-1 text-xs">Esta mensagem será revelada em 25 de dezembro.</p>
            </div>
          )}
          {isOwner && (
            <button type="button" onClick={handleDeleteOrnament} disabled={deletingOrnament} className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-400/10 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-400/20 disabled:opacity-50">
              {deletingOrnament ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remover enfeite
            </button>
          )}
        </div>
      )}

      {selectedGift && (
        <div className="fixed left-1/2 top-24 z-[75] w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl border border-[#fff1a1]/20 bg-black/80 p-5 text-center text-white shadow-2xl backdrop-blur-xl motion-reduce:transition-none" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={closeFocusedItem} className="absolute right-2 top-2 rounded-full p-2 text-white/50 hover:bg-white/10" aria-label="Voltar à árvore"><X size={17} /></button>
          <Gift className="mx-auto text-[#fff1a1]" size={26} />
          <p className="mt-2 font-semibold">🎁 Presente especial de {selectedGift.sender_name}</p>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
            <LockKeyhole className="mx-auto mb-2 text-[#fff1a1]/75" size={20} />
            <p className="font-semibold text-white/80">Uma mensagem secreta espera por você!</p>
            <p className="mt-1 text-xs">Disponível em 25 de dezembro.</p>
          </div>
          {isOwner && <button type="button" onClick={handleHideGift} disabled={hidingGift} className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-400/10 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-400/20 disabled:opacity-50">
            {hidingGift ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Ocultar presente
          </button>}
          <button type="button" onClick={closeFocusedItem} className="mt-3 block w-full text-xs font-semibold text-[#fff1a1]/75 hover:text-[#fff1a1]">Voltar à árvore</button>
        </div>
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
