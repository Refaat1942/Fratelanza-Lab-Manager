import { create } from "zustand";

interface FeaturesState {
  enabledModules: string[];
  moduleStates: Record<string, boolean>;
  loaded: boolean;
  setFeatures: (modules: Record<string, boolean>, enabled: string[]) => void;
  clearFeatures: () => void;
  isModuleEnabled: (key: string) => boolean;
}

export const useFeaturesStore = create<FeaturesState>((set, get) => ({
  enabledModules: [],
  moduleStates: {},
  loaded: false,
  setFeatures: (moduleStates, enabledModules) =>
    set({ moduleStates, enabledModules, loaded: true }),
  clearFeatures: () => set({ enabledModules: [], moduleStates: {}, loaded: false }),
  isModuleEnabled: (key) => {
    const { moduleStates, enabledModules, loaded } = get();
    if (!loaded) return true;
    if (key in moduleStates) return moduleStates[key];
    return enabledModules.includes(key);
  },
}));
