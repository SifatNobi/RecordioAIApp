import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingState, AppSettings, AIAgent, Conversation, Customer, DisputeDetails } from '@/types';

interface AppState {
  onboarding: OnboardingState;
  settings: AppSettings;
  agents: AIAgent[];
  conversations: Conversation[];
  customers: Customer[];
  disputes: DisputeDetails[];
  activeAgentId: string | null;
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;
}

interface AppActions {
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addAgent: (agent: AIAgent) => void;
  updateAgent: (id: string, updates: Partial<AIAgent>) => void;
  removeAgent: (id: string) => void;
  setActiveAgent: (id: string | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  addDispute: (dispute: DisputeDetails) => void;
  addDisputes: (disputes: DisputeDetails[]) => void;
  updateDispute: (id: string, updates: Partial<DisputeDetails>) => void;
  removeDispute: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initializeStores: () => void;
}

const defaultOnboarding: OnboardingState = {
  completed: false,
  currentStep: 0,
  seenSteps: [],
};

const defaultSettings: AppSettings = {
  theme: 'dark',
  notifications: true,
  autoSync: true,
  dataRetentionDays: 365,
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      onboarding: defaultOnboarding,
      settings: defaultSettings,
      agents: [],
      conversations: [],
      customers: [],
      disputes: [],
      activeAgentId: null,
      activeConversationId: null,
      isLoading: false,
      error: null,
      hasHydrated: false,

      setOnboardingStep: (step) =>
        set((state) => ({
          onboarding: {
            ...state.onboarding,
            currentStep: step,
            seenSteps: [...new Set([...state.onboarding.seenSteps, step])],
          },
        })),

      completeOnboarding: () =>
        set({ onboarding: { ...get().onboarding, completed: true } }),

      resetOnboarding: () =>
        set({ onboarding: defaultOnboarding }),

      updateSettings: (settings) =>
        set((state) => ({ settings: { ...state.settings, ...settings } })),

      addAgent: (agent) =>
        set((state) => ({ agents: [...state.agents, agent] })),

      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        })),

      removeAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((a) => a.id !== id),
          activeAgentId: state.activeAgentId === id ? null : state.activeAgentId,
        })),

      setActiveAgent: (id) => set({ activeAgentId: id }),

      addConversation: (conversation) =>
        set((state) => ({ conversations: [conversation, ...state.conversations] })),

      updateConversation: (id, updates) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      removeConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        })),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      addCustomer: (customer) =>
        set((state) => ({ customers: [...state.customers, customer] })),

      updateCustomer: (id, updates) =>
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      addDispute: (dispute) => set((state) => ({ disputes: [dispute, ...state.disputes] })),

      addDisputes: (disputes) =>
        set((state) => ({ disputes: [...disputes, ...state.disputes] })),

      updateDispute: (id, updates) =>
        set((state) => ({
          disputes: state.disputes.map((dispute) =>
            dispute.id === id
              ? { ...dispute, ...updates, updatedAt: new Date().toISOString() }
              : dispute
          ),
        })),

      removeDispute: (id) =>
        set((state) => ({ disputes: state.disputes.filter((dispute) => dispute.id !== id) })),

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),
      initializeStores: () => {
        // Initialization logic can go here if needed
      },
    }),
    {
      name: 'recordioai-app-storage',
      storage: createJSONStorage(() =>
        Platform.OS === 'web' ? localStorage : AsyncStorage
      ),
      partialize: (state) => ({
        onboarding: state.onboarding,
        settings: state.settings,
        agents: state.agents,
        conversations: state.conversations,
        customers: state.customers,
        disputes: state.disputes,
      }),
      onRehydrateStorage: () => (state) => {
        useAppStore.setState({ hasHydrated: true });
      },
    }
  )
);