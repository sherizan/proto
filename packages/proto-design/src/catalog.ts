import type { DesignOverrides } from './types.js';

export type DesignProfile = {
  id: string;
  version: string;
  name: string;
  description: string;
  references: string[];
  composition: string[];
  imageTreatment: string;
  motion: { durationMs: number; reduceMotion: 'immediate'; guidance: string };
  defaults: DesignOverrides;
};

const common: DesignOverrides = {
  theme: 'liquidGlass',
  colorScheme: 'system',
  tokens: {
    text: {
      primary: { light: '#202124', dark: '#F5F5F5' },
      secondary: { light: '#5E6268', dark: '#B5BAC2' },
      tertiary: { light: '#666B73', dark: '#A6ABB3' },
    },
  },
};
const surface = (light: string, dark: string) => ({ light, dark });

export const catalog: DesignProfile[] = [
  {
    id: 'warm', version: '1.0.0', name: 'Warm',
    description: 'Approachable discovery, useful product imagery and compact, labelled choices.',
    references: ['Airbnb', 'Tinder', 'Bumble'],
    composition: ['Let one useful image establish context; keep the primary action visible.', 'Group related choices under short labels; avoid a card around every row.', 'Use compact product context once customization begins.'],
    imageTreatment: 'One purposeful photo, consistent crop, visible fallback; avoid decorative stock-image grids.',
    motion: { durationMs: 180, reduceMotion: 'immediate', guidance: 'Subtle state feedback; preserve native navigation and sheet transitions.' },
    defaults: { ...common, accentColor: surface('#9D4328', '#F7AA89'), tokens: { ...common.tokens, surface: { primary: surface('#FAF7F2', '#191715'), secondary: surface('#F0EAE1', '#27231F'), card: surface('#FFFFFF', '#302B26') }, radius: { card: 18, button: 14 }, space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }, typography: { title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.4 }, headline: { fontSize: 21, fontWeight: '600' } } } },
  },
  {
    id: 'utility', version: '1.0.0', name: 'Utility',
    description: 'Clear data hierarchy, compact rows, quick actions and focused input.',
    references: ['Cash App', 'Revolut', 'Notion', 'Todoist', 'Strava', 'ChatGPT'],
    composition: ['Lead with the useful amount, task or conversation, not decorative introductory cards.', 'Align numeric values and expose frequent actions close to their content.', 'Separate task lists, activity and conversation layouts according to purpose.'],
    imageTreatment: 'Use small contextual thumbnails or avatars only where they aid recognition.',
    motion: { durationMs: 140, reduceMotion: 'immediate', guidance: 'Immediate control feedback; animate only a meaningful state change.' },
    defaults: { ...common, accentColor: surface('#245CC5', '#91B7FF'), tokens: { ...common.tokens, surface: { primary: surface('#F8F9FB', '#14171C'), secondary: surface('#EBEEF3', '#232730'), card: surface('#FFFFFF', '#20242C') }, radius: { card: 12, button: 10 }, space: { xs: 4, sm: 8, md: 16, lg: 20, xl: 28 }, typography: { title: { fontSize: 30, fontWeight: '700' }, headline: { fontSize: 20, fontWeight: '600' }, label: { fontSize: 13, fontWeight: '600' } } } },
  },
  {
    id: 'editorial', version: '1.0.0', name: 'Editorial',
    description: 'Readable content, deliberate headline hierarchy, selective imagery and clear sources.',
    references: ['NYTimes', 'Apple News', 'Perplexity'],
    composition: ['Use headline, summary, byline/source and body as distinct roles.', 'Prefer reading flow and separators over nested containers.', 'For sourced AI answers, keep the query, answer and references easy to distinguish.'],
    imageTreatment: 'One contextual lead image; preserve readable line lengths and captions.',
    motion: { durationMs: 160, reduceMotion: 'immediate', guidance: 'Keep reading stable; use native navigation without staggered paragraph entrances.' },
    defaults: { ...common, accentColor: surface('#315A52', '#9ACABD'), tokens: { ...common.tokens, surface: { primary: surface('#FCFBF8', '#191A18'), secondary: surface('#EFEEE9', '#262824'), card: surface('#FCFBF8', '#191A18') }, radius: { card: 6, button: 10 }, space: { xs: 4, sm: 8, md: 20, lg: 28, xl: 36 }, typography: { title: { fontSize: 36, fontWeight: '700', letterSpacing: -0.6 }, headline: { fontSize: 24, fontWeight: '600' }, body: { fontSize: 17, fontWeight: '400', lineHeight: 25 } } } },
  },
  {
    id: 'expressive', version: '1.0.0', name: 'Expressive',
    description: 'Media-led discovery, distinct emphasis, clear progress and purposeful accents.',
    references: ['Instagram', 'TikTok', 'Brawl Stars', 'Clash Royale'],
    composition: ['Let media or the current activity lead; give creation an obvious entry point.', 'Make progress and the next action clear without competing rewards or currencies.', 'Game references require authentic captures; unmatched search results are not evidence.'],
    imageTreatment: 'Use a consistent media format with legible controls; never depend on an image for essential text.',
    motion: { durationMs: 220, reduceMotion: 'immediate', guidance: 'One restrained emphasis on a meaningful completion; no continuous decorative motion.' },
    defaults: { ...common, accentColor: surface('#6941C6', '#C6ADFF'), tokens: { ...common.tokens, surface: { primary: surface('#F8F6FD', '#19151F'), secondary: surface('#EDE7F7', '#2A2335'), card: surface('#FFFFFF', '#30283C') }, radius: { card: 24, button: 16 }, space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 36 }, typography: { title: { fontSize: 36, fontWeight: '800', letterSpacing: -0.6 }, headline: { fontSize: 23, fontWeight: '700' } } } },
  },
];
