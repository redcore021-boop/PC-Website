/**
 * Minimal change notification: repositories emit a topic after writing,
 * and `useDbQuery` re-runs any query that depends on that topic.
 */
export type Topic = 'diary' | 'foods' | 'settings' | 'water' | 'weight';

type Listener = (topic: Topic) => void;
const listeners = new Set<Listener>();

export function emit(...topics: Topic[]): void {
  for (const t of topics) listeners.forEach((l) => l(t));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
