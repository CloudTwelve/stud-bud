import { EventEmitter } from "node:events";

const globalEvents = globalThis as typeof globalThis & {
  __studBudEvents?: EventEmitter;
};

export function readingEvents(): EventEmitter {
  globalEvents.__studBudEvents ??= new EventEmitter().setMaxListeners(0);
  return globalEvents.__studBudEvents;
}

export const READING_RECORDED = "reading";
