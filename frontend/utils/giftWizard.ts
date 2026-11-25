export const GIFT_WIZARD_STEPS = [
  { id: 1, label: 'Escolha' },
  { id: 2, label: 'Personalize' },
  { id: 3, label: 'Mensagem' },
  { id: 4, label: 'Confira' },
  { id: 5, label: 'Pix' },
  { id: 6, label: 'Confirmação' },
] as const;

export type GiftWizardStep = (typeof GIFT_WIZARD_STEPS)[number]['id'];
export type GiftPreviewMode = 'hidden' | 'compact' | 'full';

export const getGiftPreviewMode = (
  step: GiftWizardStep,
  isMobile: boolean,
  expanded = false,
): GiftPreviewMode => {
  if (!isMobile) return 'full';
  if (step === 2) return 'full';
  if (step === 3) return expanded ? 'full' : 'hidden';
  if (step === 4) return expanded ? 'full' : 'compact';
  return 'hidden';
};

export interface GiftWizardInput {
  productSelected: boolean;
  photoSelected: boolean;
  senderName: string;
  message: string;
  consent: boolean;
}

export const canAdvanceGiftWizard = (step: GiftWizardStep, input: GiftWizardInput): boolean => {
  if (step === 1) return input.productSelected;
  if (step === 2) return input.photoSelected;
  if (step === 3) return input.senderName.trim().length >= 2
    && input.message.trim().length >= 2
    && input.consent;
  return step === 4;
};

export const previousGiftWizardStep = (step: GiftWizardStep): GiftWizardStep => {
  if (step <= 1 || step >= 5) return step;
  return (step - 1) as GiftWizardStep;
};

export const nextGiftWizardStep = (step: GiftWizardStep, input: GiftWizardInput): GiftWizardStep => {
  if (!canAdvanceGiftWizard(step, input) || step >= 4) return step;
  return (step + 1) as GiftWizardStep;
};
