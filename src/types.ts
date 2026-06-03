// Shared types for the Firebase Analytics Agent.

/** One row of the tracking spreadsheet. */
export interface TrackingEvent {
  /** Firebase event name, snake_case. */
  eventName: string;
  /** What it tracks + why it matters (business value). */
  description: string;
  /** Parameters to log, e.g. "listing_id:string, price:int, currency:string". */
  parameters: string;
  /** Where it fires (screen / route / widget). */
  screen: string;
  /** Any clarification for the team. */
  notes: string;
  /** 1 = implement, 0 = skip, undefined = not yet decided. Filled by the user. */
  finalApproval?: number | null;
}

export type StateManagement = "bloc" | "riverpod" | "unknown";

/** Result of the deterministic Flutter project scan. */
export interface DetectResult {
  projectPath: string;
  stateManagement: StateManagement;
  usesGetIt: boolean;
  usesInjectable: boolean;
  /** Entry files found under lib/ (main.dart, main_dev.dart, main_prod.dart, ...). */
  entryFiles: string[];
  /** Env-specific DI init functions found (e.g. configureDevDependencies). */
  diInitFunctions: string[];
  firebase: {
    hasCore: boolean;
    hasAnalytics: boolean;
    optionsFiles: string[];
    initCallSites: string[];
  };
  /** Existing analytics service dir if present, else the recommended target dir. */
  analyticsDir: string;
  /** Whether analyticsDir mirrors an existing sibling (e.g. common/notification). */
  analyticsDirReason: string;
  /** Path:line of an AutoRouterObserver subclass, if found. */
  routerObserver: string | null;
  /** Raw pubspec dependency names (for prompt context). */
  dependencies: string[];
  notes: string[];
}

export type Phase =
  | "analyzed"
  | "asked"
  | "planned"
  | "firebase"
  | "implemented"
  | "promoted";

/** Persisted between CLI runs in <project>/.analytics-agent/session.json. */
export interface SessionState {
  /** Claude Agent SDK session id, used to resume context across runs. */
  sessionId?: string;
  projectPath: string;
  phase?: Phase;
  figmaUrl?: string;
  model?: string;
  branch?: string;
  devProject?: string;
  prodProject?: string;
  updatedAt?: string;
}
