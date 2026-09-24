export interface NavigationEntry {
  label: string;
  href: string;
  group: 'site' | 'admin';
}

export const navigation: NavigationEntry[] = [
  { label: 'Dashboard', href: '/', group: 'site' },
  { label: 'Players', href: '/players', group: 'site' },
  { label: 'Bosses', href: '/bosses', group: 'site' },
  { label: 'Raids', href: '/raids', group: 'site' },
  { label: 'World', href: '/world', group: 'site' },
  { label: 'Structures', href: '/structures', group: 'site' },
  { label: 'Comfort', href: '/comfort', group: 'site' },
  { label: 'Chat', href: '/chat', group: 'site' },
  { label: 'Activity', href: '/activity', group: 'site' },
  { label: 'Admin', href: '/admin', group: 'admin' }
];

export function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
