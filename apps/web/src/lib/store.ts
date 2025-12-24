import { createStore } from "jotai";

/**
 * Global Jotai store instance.
 * Enables accessing/mutating atom state outside of React components.
 *
 * @see https://jotai.org/docs/guides/using-store-outside-react
 */
export const store = createStore();
