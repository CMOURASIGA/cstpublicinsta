export const PLATFORM_NAME = 'Consult Flow';
export const PLATFORM_TAGLINE = 'Portal multi-cliente de publicações';

export const LOGOS = {
  squareText: 'https://i.imgur.com/CP6yIjh.png',
  squareMark: 'https://i.imgur.com/CP6yIjh.png',
  wideText: 'https://i.imgur.com/CP6yIjh.png',
} as const;

export function getClientLogo(logoUrl?: string | null) {
  return logoUrl || LOGOS.squareText;
}
