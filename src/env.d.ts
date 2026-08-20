/**
 * Ambient declarations for the handful of globals the inline head scripts pass
 * between each other.
 *
 * These scripts are `is:inline` and deliberately dependency-free (see
 * components/SiteScripts.astro), so `window` is the only channel they have.
 * Declaring them here is what lets `astro check` verify the call sites instead
 * of reporting each one as a possibly-missing property.
 */
declare global {
  interface Window {
    /** Nav progress bar controls, published by SiteScripts. */
    __navProgress?: { start: () => void; done: () => void };
    /**
     * A page's override for when the progress bar is considered done — the home
     * page holds it open until its hero image has decoded. Read fresh on every
     * navigation, never captured. See src/pages/index.astro.
     */
    __navProgressGate?: () => void;

    /** Bind-once guards, so the delegated listeners survive view transitions. */
    __themeBound?: boolean;
    __navBound?: boolean;
    __navProgressBound?: boolean;
    __figureProtectBound?: boolean;
  }
}

export {};
