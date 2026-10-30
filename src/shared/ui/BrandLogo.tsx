import brandLogoUrl from '@/shared/assets/brand-logo.svg?no-inline';
import { BRAND_NAME } from '@/shared/constants';

type BrandLogoProps = { className?: string };

/** Used by sidebar, auth, and settings to render the same terminal-and-cursor brand mark. */
export function BrandLogo({ className = 'h-8 w-8' }: BrandLogoProps) {
  return <img src={brandLogoUrl} alt={BRAND_NAME} className={className} width={64} height={64} />;
}
