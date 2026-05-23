/** Help & Support module constants */

const TICKET_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'critical']);

const TICKET_STATUSES = Object.freeze([
  'open',
  'in_progress',
  'waiting_for_response',
  'resolved',
  'closed',
]);

const TICKET_CATEGORIES = Object.freeze([
  'technical_issue',
  'bug_report',
  'payment_issue',
  'feature_request',
  'account_issue',
  'data_problem',
  'performance_issue',
  'other',
]);

const TICKET_CATEGORY_LABELS = Object.freeze({
  technical_issue: 'Technical Issue',
  bug_report: 'Bug Report',
  payment_issue: 'Payment Issue',
  feature_request: 'Feature Request',
  account_issue: 'Account Issue',
  data_problem: 'Data Problem',
  performance_issue: 'Performance Issue',
  other: 'Other',
});

const TICKET_PRIORITY_LABELS = Object.freeze({
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
});

const TICKET_STATUS_LABELS = Object.freeze({
  open: 'Open',
  in_progress: 'In Progress',
  waiting_for_response: 'Waiting for Response',
  resolved: 'Resolved',
  closed: 'Closed',
});

const HELP_ARTICLE_STATUSES = Object.freeze(['draft', 'published', 'archived']);

module.exports = {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  HELP_ARTICLE_STATUSES,
};
