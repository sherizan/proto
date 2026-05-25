import { vi } from 'vitest';

vi.mock('expo-linking', () => ({
  openURL: vi.fn(async () => true),
}));
