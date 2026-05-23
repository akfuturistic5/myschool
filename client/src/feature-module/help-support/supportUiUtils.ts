export const TICKET_STATUS_BADGE: Record<string, string> = {
  open: 'badge-soft-primary',
  in_progress: 'badge-soft-info',
  waiting_for_response: 'badge-soft-warning',
  resolved: 'badge-soft-success',
  closed: 'badge-soft-secondary',
};

export const TICKET_PRIORITY_BADGE: Record<string, string> = {
  low: 'badge-soft-secondary',
  medium: 'badge-soft-info',
  high: 'badge-soft-warning',
  critical: 'badge-soft-danger',
};

export function formatStatusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatCategoryLabel(cat: string): string {
  return cat
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
