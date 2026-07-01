export const PLATFORM_NAME = 'InstaFlow';
export const PLATFORM_TAGLINE = 'Portal multi-cliente de publicações';

export const LOGOS = {
  squareText: 'https://i.imgur.com/JHF8X7U.png',
  squareMark: 'https://i.imgur.com/wr0z5Xv.png',
  wideText: 'https://i.imgur.com/gxXnYsA.png',
} as const;

export function getClientLogo(logoUrl?: string | null) {
  return logoUrl || LOGOS.squareText;
}
