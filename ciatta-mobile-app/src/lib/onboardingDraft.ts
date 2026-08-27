import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingAnswer } from './onboardingConversation';
import type { PendingHealthDocument } from './onboardingSetup';

const GUEST_ONBOARDING_KEY = 'ciatta.guestOnboarding.v1';

export interface GuestOnboardingDraft {
  name: string;
  dob: string;
  lifeStage: string | null;
  story: string | null;
  concern: string | null;
  height: string;
  weight: string;
  answers: OnboardingAnswer[];
  connectHealthAfterAuth: boolean;
  conversationDone: boolean;
  needsCommit: boolean;
  step: number;
  notifPref?: string;
  sharedHealthRows?: string[];
  pendingHealthNotes?: Record<string, string>;
  pendingDocuments?: PendingHealthDocument[];
  suggestedTests?: string[];
  includeMentalEmotional?: boolean;
  connectCalendarAfterAuth?: boolean;
}

export async function saveGuestOnboardingDraft(draft: GuestOnboardingDraft): Promise<void> {
  await AsyncStorage.setItem(GUEST_ONBOARDING_KEY, JSON.stringify(draft));
}

export async function loadGuestOnboardingDraft(): Promise<GuestOnboardingDraft | null> {
  const raw = await AsyncStorage.getItem(GUEST_ONBOARDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestOnboardingDraft;
  } catch {
    return null;
  }
}

export async function clearGuestOnboardingDraft(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_ONBOARDING_KEY);
}
