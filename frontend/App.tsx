import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, ChevronLeft, ChevronRight, Gift, Loader2, LockKeyhole, MailOpen, Share2, Trash2, TreePine, X } from 'lucide-react';
import Scene from './components/Scene';
import Overlay from './components/Overlay';
import TreeOnboarding from './components/TreeOnboarding';
import OrnamentDecorationModal from './components/OrnamentDecorationModal';
import ShareTreeModal from './components/ShareTreeModal';
import TreeProgressIndicator from './components/TreeProgressIndicator';
import GiftPreviewModal from './components/GiftPreviewModal';
import MemoriesPanel from './components/MemoriesPanel';
import { createMemory, createOrnament, deleteMemory, deleteOrnament, fetchApiContext, fetchMemories, fetchOrnaments, fetchOwnerMessages, fetchPremiumGiftMessage, fetchPremiumGifts, hidePremiumGift, TreeApiError, updateMemory } from './api/trees';
import { getMemorySlot, getOrnamentSlot } from './utils/math';
import { ChristmasTreeAccess, ChristmasTreeData, ControlMode, InteractionMode, OrnamentType, PhotoData, PremiumGiftData, PremiumGiftOwnerMessage, SecretTreeMessage, SocialOrnamentData, TreeMemoryData, ZoomLevel } from './types';
import { ORNAMENT_SLOT_COUNT } from './constants';
import { useAudio } from './hooks/useAudio';
import { useRecording } from './hooks/useRecording';
import { useTreeInteraction } from './hooks/useTreeInteraction';
import { prepareMemoryImage } from './utils/memoryImages';
import type { StoryFrameCapture } from './utils/socialSharing';
import type { StoryVideoSceneCapture } from './utils/videoRecording';
import {
  getTreeProgressionFromOrnaments,
  getUnlockedProgressionStage,
  shouldAnimateProgressionUnlock,
} from './utils/treeProgression';
import type { TreeProgressionStage } from './utils/treeProgression';
import { GiftPhotoError, getGiftPhotoMaxBytes, isGiftPreviewEnabled } from './utils/giftTextures';
import { getPremiumGiftTransform } from './utils/premiumGiftLayout';
import { sameOriginTreeUrl } from './utils/sameOriginUrl';
import ChristmasLoadingScreen from './components/ChristmasLoadingScreen';
import { STARTUP_TIMEOUT_MS, canAdvanceStartup, markStartup, measureStartup } from './utils/startup';
import type { StartupPhase } from './utils/startup';
import { getOrnamentNavigation, isEditableNavigationTarget, orderExistingOrnaments } from './utils/ornamentNavigation';
import type { OrnamentNavigationDirection } from './utils/ornamentNavigation';

const initialBootstrap = window.__CHRISTMAS_TREE_BOOTSTRAP__;
const giftPreviewEnabled = isGiftPreviewEnabled(import.meta.env.DEV, import.meta.env.VITE_ENABLE_GIFT_PREVIEW);
const giftPhotoMaxBytes = getGiftPhotoMaxBytes(import.meta.env.VITE_GIFT_PHOTO_MAX_BYTES);
const ornamentTypeLabels: Record<OrnamentType, string> = {
  bauble_red: 'Bolinha vermelha',
  bauble_gold: 'Bolinha dourada',
  bauble_blue: 'Bolinha azul',
  heart: 'Coração',
  star: 'Estrela',
  present: 'Presente',
};
const alreadyDecoratedMessage = 'Você já deixou seu enfeite nesta árvore! ❤️ Agora é só esperar o Natal para que sua mensagem seja revelada.';
markStartup('app_start');
if (initialBootstrap?.tree) {
  markStartup('tree_data_start');
  markStartup('tree_data_ready');
  measureStartup('embedded-tree-data', 'tree_data_start', 'tree_data_ready');
}

const memoryFailureMessage = (caught: unknown, fallback: string): string => {
  if (caught instanceof GiftPhotoError) return caught.message;
  if (caught instanceof TreeApiError) {
    if (caught.code === 'validation_failed' && caught.fields.image?.[0]) return caught.fields.image[0];
    return caught.message;
  }
  return fallback;
};

const reportMemoryFailure = (caught: unknown, operation: 'create' | 'update'): void => {
  if (!import.meta.env.DEV) return;
  console.error('Memory image operation failed', {
    operation,
    stage: caught instanceof GiftPhotoError ? 'local_processing' : caught instanceof TreeApiError ? 'http' : 'unexpected',
    code: caught instanceof TreeApiError ? caught.code : undefined,
    status: caught instanceof TreeApiError ? caught.status : undefined,
    type: caught instanceof Error ? caught.name : typeof caught,
  });
};

const App: React.FC = () => {
  const [controlMode, setControlMode] = useState<ControlMode>(ControlMode.MOUSE);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(InteractionMode.VIEW);
  const [memories, setMemories] = useState<TreeMemoryData[]>([]);
  const [memoriesPanelOpen, setMemoriesPanelOpen] = useState(false);
  const [memoriesBusy, setMemoriesBusy] = useState(false);
  const [tree, setTree] = useState<ChristmasTreeData | null>(initialBootstrap?.tree ?? null);
  const [publicTreeUrl, setPublicTreeUrl] = useState(() => {
    const path = initialBootstrap?.public_path ?? (initialBootstrap?.tree ? `/t/${initialBootstrap.tree.public_id}` : null);
    return path ? sameOriginTreeUrl(path) : '';
  });
  const [isOwner, setIsOwner] = useState(initialBootstrap?.is_owner ?? false);
  const [ownTreePath, setOwnTreePath] = useState(initialBootstrap?.own_tree_path ?? null);
  const [csrfToken, setCsrfToken] = useState(initialBootstrap?.csrf_token ?? '');
  const [initializing, setInitializing] = useState(!initialBootstrap);
  const [startupPhase, setStartupPhase] = useState<StartupPhase>(initialBootstrap?.tree ? 'loading_data' : initialBootstrap ? 'ready' : 'initializing');
  const [loadingVisible, setLoadingVisible] = useState(Boolean(initialBootstrap?.tree) || !initialBootstrap);
  const [receipt, setReceipt] = useState<ChristmasTreeAccess | null>(null);
  const [userName, setUserName] = useState(initialBootstrap?.tree?.owner_name ?? '');
  const [isNameSet, setIsNameSet] = useState(Boolean(initialBootstrap?.tree));
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [ornaments, setOrnaments] = useState<SocialOrnamentData[]>([]);
  const [ornamentCapacity, setOrnamentCapacity] = useState(ORNAMENT_SLOT_COUNT);
  const [ornamentsLoading, setOrnamentsLoading] = useState(false);
  const [ornamentsReady, setOrnamentsReady] = useState(false);
  const [visitorHasDecorated, setVisitorHasDecorated] = useState(false);
  const [ornamentModalOpen, setOrnamentModalOpen] = useState(false);
  const [selectedOrnament, setSelectedOrnament] = useState<SocialOrnamentData | null>(null);
  const [premiumGifts, setPremiumGifts] = useState<PremiumGiftData[]>([]);
  const [premiumGiftPage, setPremiumGiftPage] = useState(0);
  const [premiumGiftLimit, setPremiumGiftLimit] = useState(12);
  const [selectedGift, setSelectedGift] = useState<PremiumGiftData | null>(null);
  const [selectedGiftMessage, setSelectedGiftMessage] = useState<{ giftId: string; value: PremiumGiftOwnerMessage } | null>(null);
  const [giftMessageLoadingFor, setGiftMessageLoadingFor] = useState<string | null>(null);
  const [hidingGift, setHidingGift] = useState(false);
  const [newOrnamentId, setNewOrnamentId] = useState<string | null>(null);
  const [deletingOrnament, setDeletingOrnament] = useState(false);
  const [ownerMessages, setOwnerMessages] = useState<Record<string, SecretTreeMessage>>({});
  const [messageOverview, setMessageOverview] = useState<{ count: number; revealed: boolean; revealAt: string } | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [createOwnTreeOpen, setCreateOwnTreeOpen] = useState(false);
  const [giftPreviewOpen, setGiftPreviewOpen] = useState(false);
  const [unlockedProgressionStage, setUnlockedProgressionStage] = useState<TreeProgressionStage | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const loadedOrnamentsFor = useRef<string | null>(null);
  const loadedMessagesFor = useRef<string | null>(null);
  const loadedMemoriesFor = useRef<string | null>(null);
  const giftMessageRequestSequence = useRef(0);
  const storyCaptureRef = useRef<StoryFrameCapture | null>(null);
  const storyVideoCaptureRef = useRef<StoryVideoSceneCapture | null>(null);
  const progressionDismissTimer = useRef<number | null>(null);

  useEffect(() => {
    markStartup('react_initialized');
    measureStartup('react-bootstrap', 'app_start', 'react_initialized');
  }, []);

  useEffect(() => {
    if (startupPhase === 'ready' || startupPhase === 'error') return;
    const timeout = window.setTimeout(() => setStartupPhase('error'), STARTUP_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [startupPhase]);

  useEffect(() => {
    if (startupPhase !== 'ready') { setLoadingVisible(true); return; }
    const transition = window.setTimeout(() => setLoadingVisible(false), 240);
    return () => window.clearTimeout(transition);
  }, [startupPhase]);

  const advanceStartup = useCallback((next: StartupPhase) => {
    setStartupPhase((current) => canAdvanceStartup(current, next) ? next : current);
  }, []);

  const handleStartupEvent = useCallback((event: 'webgl_ready' | 'scene_prepared' | 'first_frame' | 'ready' | 'error') => {
    if (event === 'error') { setStartupPhase('error'); return; }
    markStartup(event === 'ready' ? 'interactive' : event);
    if (event === 'scene_prepared') advanceStartup('preparing_scene');
    if (event === 'first_frame') advanceStartup('first_frame');
    if (event === 'ready') {
      advanceStartup('ready');
      measureStartup('time-to-interactive', 'app_start', 'interactive');
    }
  }, [advanceStartup]);

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

  const loadPremiumGiftMessage = useCallback(async (treePublicId: string, giftPublicId: string) => {
    const requestSequence = ++giftMessageRequestSequence.current;
    setGiftMessageLoadingFor(giftPublicId);
    try {
      const value = await fetchPremiumGiftMessage(treePublicId, giftPublicId);
      if (requestSequence !== giftMessageRequestSequence.current) return;
      setSelectedGiftMessage({ giftId: giftPublicId, value });
    } catch (caught) {
      if (requestSequence !== giftMessageRequestSequence.current) return;
      setSelectedGiftMessage((current) => current?.giftId === giftPublicId ? null : current);
      if (!(caught instanceof TreeApiError && caught.code === 'gift_message_locked')) {
        showToast('Não foi possível consultar a mensagem deste presente.', 'error');
      }
    } finally {
      if (requestSequence === giftMessageRequestSequence.current) {
        setGiftMessageLoadingFor((current) => current === giftPublicId ? null : current);
      }
    }
  }, [showToast]);

  useEffect(() => {
    if (initialBootstrap) return;
    const controller = new AbortController();
    markStartup('tree_data_start');
    fetchApiContext(controller.signal)
      .then((context) => { setCsrfToken(context.csrf_token); markStartup('tree_data_ready'); advanceStartup('ready'); })
      .catch((caught) => { if ((caught as Error).name !== 'AbortError') setStartupPhase('error'); })
      .finally(() => setInitializing(false));
    return () => controller.abort();
  }, [advanceStartup]);

  const photos = useMemo<PhotoData[]>(() => memories.map((memory) => {
    const slot = getMemorySlot(memory.slot_index, memory.layout_version);
    return {
      id: `memory-${memory.public_id}`,
      memoryPublicId: memory.public_id,
      url: memory.image_url,
      caption: memory.caption,
      position: slot.position,
      rotation: slot.rotation,
    };
  }), [memories]);

  useEffect(() => {
    if (!isOwner) {
      setInteractionMode(InteractionMode.VIEW);
    }
  }, [isOwner]);

  useEffect(() => {
    if (!tree || loadedOrnamentsFor.current === tree.public_id) return;
    const controller = new AbortController();
    loadedOrnamentsFor.current = tree.public_id;
    setOrnamentsLoading(true);
    setOrnamentsReady(false);
    markStartup('ornaments_start');
    fetchOrnaments(tree.public_id, controller.signal)
      .then((collection) => {
        setOrnaments(collection.ornaments);
        setOrnamentCapacity(collection.capacity);
        setVisitorHasDecorated(collection.current_visitor_has_decorated);
        setOrnamentsReady(true);
        markStartup('ornaments_ready');
        measureStartup('ornaments-request', 'ornaments_start', 'ornaments_ready');
        advanceStartup('preparing_scene');
      })
      .catch((caught) => {
        if ((caught as Error).name === 'AbortError') return;
        loadedOrnamentsFor.current = null;
        setStartupPhase('error');
      })
      .finally(() => setOrnamentsLoading(false));
    return () => controller.abort();
  }, [tree, advanceStartup]);

  useEffect(() => {
    if (!tree || loadedMemoriesFor.current === tree.public_id) return;
    const controller = new AbortController();
    loadedMemoriesFor.current = tree.public_id;
    markStartup('memories_start');
    fetchMemories(tree.public_id, controller.signal)
      .then((collection) => { setMemories(collection.memories); markStartup('memories_ready'); measureStartup('memories-request', 'memories_start', 'memories_ready'); })
      .catch((caught) => { if ((caught as Error).name !== 'AbortError') { loadedMemoriesFor.current = null; showToast('Não foi possível carregar as memórias desta árvore.', 'error'); } });
    return () => controller.abort();
  }, [tree, showToast]);

  useEffect(() => {
    if (!tree) { setPremiumGifts([]); return; }
    let active = true;
    const controller = new AbortController();
    const load = () => { markStartup('gifts_start'); return fetchPremiumGifts(tree.public_id, controller.signal).then((collection) => {
      if (!active) return;
      setPremiumGifts(collection.gifts);
      setPremiumGiftLimit(collection.visible_limit);
      setPremiumGiftPage((page) => Math.min(page, Math.max(0, Math.ceil(collection.total / collection.visible_limit) - 1)));
      markStartup('gifts_ready');
      measureStartup('gifts-request', 'gifts_start', 'gifts_ready');
    }).catch(() => undefined); };
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
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

  useEffect(() => {
    const revalidateMessages = () => {
      if (document.visibilityState !== 'visible' || !tree || !isOwner) return;
      void loadOwnerMessages(tree.public_id, true);
      if (selectedGift?.has_message) void loadPremiumGiftMessage(tree.public_id, selectedGift.public_id);
    };
    document.addEventListener('visibilitychange', revalidateMessages);
    return () => document.removeEventListener('visibilitychange', revalidateMessages);
  }, [tree, isOwner, selectedGift, loadOwnerMessages, loadPremiumGiftMessage]);

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
    keyboardNavigationEnabled: !selectedOrnament && !selectedGift,
  });

  const orderedOrnaments = useMemo(() => orderExistingOrnaments(ornaments), [ornaments]);
  const ornamentNavigation = useMemo(
    () => getOrnamentNavigation(orderedOrnaments, selectedOrnament?.public_id ?? null),
    [orderedOrnaments, selectedOrnament?.public_id],
  );

  const handleAccess = (access: ChristmasTreeAccess) => {
    const sameOriginAccess = { ...access, public_url: sameOriginTreeUrl(access.public_path) };
    setTree(access.tree);
    setPublicTreeUrl(sameOriginAccess.public_url);
    setIsOwner(true);
    setOwnTreePath(access.public_path);
    setUserName(access.tree.owner_name);
    setIsNameSet(true);
    setInteractionMode(InteractionMode.VIEW);
    setReceipt(sameOriginAccess);
    setOrnaments([]);
    setOrnamentsReady(false);
    setVisitorHasDecorated(false);
    setStartupPhase('loading_data');
    dismissProgressionUnlock();
    loadedOrnamentsFor.current = null;
    loadedMessagesFor.current = null;
    loadedMemoriesFor.current = null;
    setMemories([]);
    setOwnerMessages({});
    setMessageOverview(null);
    giftMessageRequestSequence.current += 1;
    setSelectedGiftMessage(null);
    setGiftMessageLoadingFor(null);
    setCreateOwnTreeOpen(false);
    setShareModalOpen(false);
    setGiftPreviewOpen(false);
    setMemoriesPanelOpen(false);
    window.history.pushState({}, '', access.public_path);
    void fetchApiContext().then((context) => setCsrfToken(context.csrf_token)).catch(() => undefined);
  };

  const focusOrnament = useCallback((ornament: SocialOrnamentData) => {
    const slot = getOrnamentSlot(ornament.slot_index, ornament.layout_version);
    setSelectedOrnament(ornament);
    setSelectedGift(null);
    giftMessageRequestSequence.current += 1;
    setSelectedGiftMessage(null);
    setGiftMessageLoadingFor(null);
    setFocusedPhoto({
      id: `ornament-${ornament.public_id}`,
      url: '',
      position: slot.position,
      rotation: slot.rotation,
    });
    setZoomLevel(ZoomLevel.ZOOMED_IN);
  }, [setFocusedPhoto, setZoomLevel]);

  const focusPremiumGift = (gift: PremiumGiftData) => {
    const transform = getPremiumGiftTransform(gift.position_index, gift.layout_version);
    setSelectedGift(gift);
    giftMessageRequestSequence.current += 1;
    setSelectedGiftMessage(null);
    if (tree && isOwner && gift.has_message) void loadPremiumGiftMessage(tree.public_id, gift.public_id);
    setSelectedOrnament(null);
    setFocusedPhoto({ id: `premium-gift-${gift.public_id}`, url: '', position: transform.position, rotation: transform.rotation });
    setZoomLevel(ZoomLevel.ZOOMED_IN);
  };

  const closeFocusedItem = useCallback(() => {
    setSelectedGift(null);
    giftMessageRequestSequence.current += 1;
    setSelectedGiftMessage(null);
    setGiftMessageLoadingFor(null);
    setSelectedOrnament(null);
    setFocusedPhoto(null);
    scrollToTop();
  }, [scrollToTop, setFocusedPhoto]);

  const navigateOrnament = useCallback((direction: OrnamentNavigationDirection) => {
    if (!ornamentNavigation || ornamentNavigation.total < 2) return;
    focusOrnament(direction === 'next' ? ornamentNavigation.next : ornamentNavigation.previous);
  }, [focusOrnament, ornamentNavigation]);

  useEffect(() => {
    if (!selectedOrnament || !ornamentsReady) return;
    const current = orderedOrnaments.find((ornament) => ornament.public_id === selectedOrnament.public_id);
    if (!current) {
      closeFocusedItem();
      return;
    }
    if (current !== selectedOrnament) setSelectedOrnament(current);
  }, [closeFocusedItem, orderedOrnaments, ornamentsReady, selectedOrnament]);

  useEffect(() => {
    if (!selectedOrnament || ornamentModalOpen || isRecording) return;
    const handleOrnamentKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableNavigationTarget(event.target)) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateOrnament('next');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateOrnament('previous');
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeFocusedItem();
      }
    };
    window.addEventListener('keydown', handleOrnamentKeyDown);
    return () => window.removeEventListener('keydown', handleOrnamentKeyDown);
  }, [closeFocusedItem, isRecording, navigateOrnament, ornamentModalOpen, selectedOrnament]);

  const selectedMemory = focusedPhoto?.memoryPublicId
    ? memories.find((memory) => memory.public_id === focusedPhoto.memoryPublicId) ?? null
    : null;

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
      setVisitorHasDecorated(response.current_visitor_has_decorated);
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
        if (caught.code === 'visitor_already_decorated') {
          setVisitorHasDecorated(true);
          setOrnamentModalOpen(false);
          showToast(alreadyDecoratedMessage, 'success');
        }
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

  const handleAddMemory = async (file: File, caption: string) => {
    if (!tree || !isOwner) return;
    setMemoriesBusy(true);
    try {
      const prepared = await prepareMemoryImage(file);
      const response = await createMemory(tree.public_id, prepared, caption, csrfToken);
      setMemories((current) => [...current, response.memory].sort((a, b) => a.slot_index - b.slot_index));
      showToast('Memória adicionada à sua árvore.', 'success');
    } catch (caught) {
      reportMemoryFailure(caught, 'create');
      showToast(memoryFailureMessage(caught, 'Não foi possível adicionar a memória.'), 'error');
      throw caught;
    } finally { setMemoriesBusy(false); }
  };

  const handleUpdateMemory = async (memory: TreeMemoryData, file: File | null, caption: string) => {
    if (!tree || !isOwner) return;
    setMemoriesBusy(true);
    try {
      const prepared = file ? await prepareMemoryImage(file) : null;
      const response = await updateMemory(tree.public_id, memory.public_id, prepared, caption, csrfToken);
      setMemories((current) => current.map((item) => item.public_id === memory.public_id ? response.memory : item));
      showToast('Memória atualizada.', 'success');
    } catch (caught) {
      reportMemoryFailure(caught, 'update');
      showToast(memoryFailureMessage(caught, 'Não foi possível atualizar a memória.'), 'error');
      throw caught;
    } finally { setMemoriesBusy(false); }
  };

  const handleDeleteMemory = async (memory: TreeMemoryData) => {
    if (!tree || !isOwner || !window.confirm('Remover esta memória da árvore?')) return;
    setMemoriesBusy(true);
    try {
      await deleteMemory(tree.public_id, memory.public_id, csrfToken);
      setMemories((current) => current.filter((item) => item.public_id !== memory.public_id));
      if (focusedPhoto?.memoryPublicId === memory.public_id) closeFocusedItem();
      showToast('Memória removida.', 'success');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Não foi possível remover a memória.', 'error');
      throw caught;
    } finally { setMemoriesBusy(false); }
  };

  return (
    <div className="relative w-full h-full bg-[#050505]" onDoubleClick={handleDoubleClick}>
      <audio ref={audioRef} src={`${import.meta.env.BASE_URL}assets/music/christmas-song.mp3`} loop preload="metadata" />

      <Scene
        photos={photos}
        onPhotoClick={handlePhotoClick}
        controlMode={controlMode}
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
        paused={giftPreviewOpen || memoriesPanelOpen}
        essentialReady={Boolean(tree && ornamentsReady)}
        onStartupEvent={handleStartupEvent}
      />

      {startupPhase === 'ready' && !selectedOrnament && !selectedGift && !selectedMemory && <Overlay
        isMusicPlaying={isMusicPlaying}
        toggleMusic={toggleMusic}
        userName={userName}
        isRecording={isRecording}
        treeOwnerName={tree?.owner_name ?? null}
        optionsOpen={optionsOpen}
        onOptionsOpenChange={setOptionsOpen}
      />}

      {loadingVisible && <ChristmasLoadingScreen phase={startupPhase} onRetry={() => window.location.reload()} />}

      {!initializing && (!tree || receipt || createOwnTreeOpen) && (
        <TreeOnboarding
          csrfToken={csrfToken}
          receipt={receipt}
          onAccess={handleAccess}
          onCloseReceipt={() => setReceipt(null)}
          onCancel={tree && !receipt ? () => setCreateOwnTreeOpen(false) : undefined}
        />
      )}

      {startupPhase === 'ready' && tree && !receipt && !isRecording && !giftPreviewOpen && !selectedOrnament && !selectedGift && !selectedMemory && (
        <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-[70] grid w-[min(94vw,30rem)] -translate-x-1/2 grid-cols-2 gap-2 px-1 py-1 pointer-events-auto sm:flex sm:w-auto sm:max-w-[calc(100vw-2rem)] sm:justify-center">
          {isOwner ? <>
            <button type="button" onClick={() => { scrollToTop(); setShareModalOpen(true); }} className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#1cbd62] px-4 py-3 text-sm font-semibold text-white shadow-xl hover:bg-[#24cf70] sm:col-auto sm:shrink-0"><Share2 size={17} /> Compartilhar árvore</button>
            <button type="button" onClick={() => setMemoriesPanelOpen(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#fff1a1]/25 bg-[#07120d]/90 px-3 py-3 text-sm font-semibold text-[#fff1a1] shadow-xl backdrop-blur-xl sm:shrink-0 sm:px-4"><Camera size={17} /> Memórias</button>
          </> : <>
            <button type="button" onClick={() => visitorHasDecorated ? showToast(alreadyDecoratedMessage, 'success') : setOrnamentModalOpen(true)} disabled={ornamentsLoading || (!visitorHasDecorated && ornaments.length >= ornamentCapacity)} className="col-span-2 min-h-12 rounded-full bg-[#1cbd62] px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-[#24cf70] disabled:opacity-60 sm:col-auto sm:shrink-0">
              {ornamentsLoading ? 'Carregando…' : visitorHasDecorated ? '✅ Você já decorou esta árvore!' : ornaments.length >= ornamentCapacity ? '🎄 Árvore completa' : '🎄 Decorar esta árvore'}
            </button>
          </>}
          {giftPreviewEnabled ? (
            <button type="button" onClick={() => setGiftPreviewOpen(true)} className="flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-[#fff1a1]/25 bg-black/65 px-3 py-3 text-center text-xs font-semibold text-[#fff1a1] shadow-xl backdrop-blur-xl hover:bg-white/10 sm:shrink-0 sm:px-4 sm:text-sm"><Gift size={17} /> Presente especial</button>
          ) : (
            <button type="button" disabled aria-disabled="true" className="flex min-h-12 cursor-not-allowed items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-3 text-center text-xs font-semibold text-white/55 shadow-xl backdrop-blur-xl sm:shrink-0 sm:px-4 sm:text-sm"><Gift size={17} /> Presentes · Em breve</button>
          )}
          {!isOwner && (ownTreePath ? <a href={ownTreePath} className="flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-[#fff1a1]/25 bg-[#07120d]/90 px-3 py-3 text-center text-xs font-semibold text-[#fff1a1] shadow-xl backdrop-blur-xl sm:shrink-0 sm:px-4 sm:text-sm"><TreePine size={17} /> Minha árvore</a>
            : <button type="button" onClick={() => setCreateOwnTreeOpen(true)} className="flex min-h-12 items-center justify-center gap-1.5 rounded-full border border-[#fff1a1]/25 bg-[#07120d]/90 px-3 py-3 text-center text-xs font-semibold text-[#fff1a1] shadow-xl backdrop-blur-xl sm:shrink-0 sm:px-4 sm:text-sm"><TreePine size={17} /> Criar minha árvore</button>)}
        </div>
      )}

      {premiumGifts.length > premiumGiftLimit && !selectedGift && !selectedOrnament && !selectedMemory && !giftPreviewOpen && (
        <div className="fixed bottom-[max(8.5rem,calc(env(safe-area-inset-bottom)+7.5rem))] left-1/2 z-[69] flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/65 px-4 py-2 text-xs text-white/70 backdrop-blur-xl sm:bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+3.5rem))]">
          <button type="button" disabled={premiumGiftPage === 0} onClick={() => setPremiumGiftPage((page) => Math.max(0, page - 1))} className="disabled:opacity-30">←</button>
          <span>Presentes {premiumGiftPage + 1}/{Math.ceil(premiumGifts.length / premiumGiftLimit)}</span>
          <button type="button" disabled={(premiumGiftPage + 1) * premiumGiftLimit >= premiumGifts.length} onClick={() => setPremiumGiftPage((page) => page + 1)} className="disabled:opacity-30">→</button>
        </div>
      )}

      {tree && !receipt && ornamentsReady && !isRecording && !giftPreviewOpen && !selectedOrnament && !selectedGift && !selectedMemory && (
        <TreeProgressIndicator
          progression={progression}
          isOwner={isOwner}
          unlockedStage={unlockedProgressionStage}
          onDismissUnlock={dismissProgressionUnlock}
          messageOverview={messageOverview}
          messagesLoading={messagesLoading}
          temporarilyHidden={optionsOpen}
        />
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

      {memoriesPanelOpen && tree && isOwner && (
        <MemoriesPanel
          memories={memories}
          busy={memoriesBusy}
          onAdd={handleAddMemory}
          onUpdate={handleUpdateMemory}
          onDelete={handleDeleteMemory}
          onClose={() => setMemoriesPanelOpen(false)}
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

      {selectedMemory && (
        <div className="fixed left-1/2 top-[max(6rem,calc(env(safe-area-inset-top)+5rem))] z-[75] w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl border border-[#fff1a1]/20 bg-black/80 p-5 text-center text-white shadow-2xl backdrop-blur-xl" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={closeFocusedItem} className="absolute right-2 top-2 min-h-11 min-w-11 rounded-full p-2 text-white/60 hover:bg-white/10" aria-label="Voltar à árvore"><X className="mx-auto" size={17} /></button>
          <Camera className="mx-auto text-[#fff1a1]" size={25} />
          <p className="mt-3 font-semibold">Memória de 2026</p>
          {selectedMemory.caption && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{selectedMemory.caption}</p>}
          <button type="button" onClick={closeFocusedItem} className="mt-4 min-h-11 w-full rounded-full border border-white/15 text-sm font-semibold text-[#fff1a1]">Voltar à árvore</button>
        </div>
      )}

      {selectedOrnament && !ornamentModalOpen && (
        <div className="fixed left-1/2 top-[max(6rem,calc(env(safe-area-inset-top)+5rem))] z-[75] flex max-h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] w-[min(92vw,22rem)] -translate-x-1/2 flex-col overflow-hidden animate-in fade-in zoom-in-95 rounded-2xl border border-white/15 bg-black/75 p-4 text-center text-white shadow-2xl backdrop-blur-xl pointer-events-auto motion-reduce:animate-none" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={closeFocusedItem} className="absolute right-2 top-2 z-10 min-h-11 min-w-11 rounded-full p-2 text-white/50 hover:bg-white/10" aria-label="Voltar à árvore"><X className="mx-auto" size={17} /></button>
          <div className="min-h-0 overflow-y-auto px-1">
          {ownerMessages[selectedOrnament.public_id] ? <MailOpen className="mx-auto text-[#fff1a1]" size={25} /> : <Gift className="mx-auto text-[#fff1a1]" size={24} />}
          <p className="mt-2 font-semibold">🎁 Presente de {selectedOrnament.sender_name}</p>
          <p className="mt-1 text-xs text-white/45">Posição {selectedOrnament.slot_index + 1} de {ORNAMENT_SLOT_COUNT}</p>
          <p className="mt-1 text-xs text-white/55">{ornamentTypeLabels[selectedOrnament.ornament_type]}</p>
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
          {ornamentNavigation && ornamentNavigation.total > 1 && (
            <nav aria-label="Navegação entre enfeites" className="mt-3 grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 border-t border-white/10 pt-3">
              <button type="button" onClick={() => navigateOrnament('previous')} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold text-[#fff1a1] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#fff1a1]" aria-label="Enfeite anterior">
                <ChevronLeft aria-hidden="true" size={17} /> <span>Anterior</span>
              </button>
              <span aria-live="polite" className="whitespace-nowrap px-1 text-xs font-semibold tabular-nums text-white/65">{ornamentNavigation.index + 1} de {ornamentNavigation.total}</span>
              <button type="button" onClick={() => navigateOrnament('next')} className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold text-[#fff1a1] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#fff1a1]" aria-label="Próximo enfeite">
                <span>Próximo</span> <ChevronRight aria-hidden="true" size={17} />
              </button>
            </nav>
          )}
        </div>
      )}

      {selectedGift && (
        <div className="fixed left-1/2 top-[max(6rem,calc(env(safe-area-inset-top)+5rem))] z-[75] max-h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] w-[min(92vw,22rem)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-[#fff1a1]/20 bg-black/80 p-5 text-center text-white shadow-2xl backdrop-blur-xl motion-reduce:transition-none" onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" onClick={closeFocusedItem} className="absolute right-2 top-2 rounded-full p-2 text-white/50 hover:bg-white/10" aria-label="Voltar à árvore"><X size={17} /></button>
          <Gift className="mx-auto text-[#fff1a1]" size={26} />
          <p className="mt-2 font-semibold">🎁 Presente especial de {selectedGift.sender_name}</p>
          {!selectedGift.has_message ? (
            <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/55">Este presente não possui mensagem secreta.</p>
          ) : selectedGiftMessage?.giftId === selectedGift.public_id ? (
            <div className="mt-3 rounded-xl border border-[#fff1a1]/20 bg-[#fff1a1]/10 p-4 text-left text-sm leading-relaxed text-white/85">
              <MailOpen className="mx-auto mb-2 text-[#fff1a1]" size={22} />
              <p className="whitespace-pre-wrap">{selectedGiftMessage.value.message}</p>
            </div>
          ) : giftMessageLoadingFor === selectedGift.public_id ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/60"><Loader2 className="mx-auto animate-spin" size={20} /><p className="mt-2">Consultando mensagem…</p></div>
          ) : (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
              <LockKeyhole className="mx-auto mb-2 text-[#fff1a1]/75" size={20} />
              <p className="font-semibold text-white/80">Uma mensagem secreta espera por você!</p>
              <p className="mt-1 text-xs">Disponível em 25 de dezembro.</p>
            </div>
          )}
          {isOwner && <button type="button" onClick={handleHideGift} disabled={hidingGift} className="mt-3 inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-400/10 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-400/20 disabled:opacity-50">
            {hidingGift ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Ocultar presente
          </button>}
          <button type="button" onClick={closeFocusedItem} className="mt-3 block w-full text-xs font-semibold text-[#fff1a1]/75 hover:text-[#fff1a1]">Voltar à árvore</button>
        </div>
      )}

      {toast && !ornamentModalOpen && !shareModalOpen && !memoriesPanelOpen && !giftPreviewOpen && !receipt && !createOwnTreeOpen && (
        <div className="pointer-events-none fixed left-1/2 top-[max(9rem,calc(env(safe-area-inset-top)+8.25rem))] z-[90] w-[min(92vw,26rem)] -translate-x-1/2 animate-in slide-in-from-top-4 fade-in duration-300 sm:left-auto sm:right-6 sm:top-[max(5.5rem,calc(env(safe-area-inset-top)+4.75rem))] sm:translate-x-0">
          <div className={`pointer-events-auto w-full p-4 rounded-2xl shadow-2xl backdrop-blur-xl border ${toast.type === 'error' ? 'bg-red-950/40 border-red-500/30 text-red-100' : 'bg-green-950/40 border-green-500/30 text-green-100'} flex items-start gap-4 relative overflow-hidden group`}>
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
