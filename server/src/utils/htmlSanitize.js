const sanitizeHtml = require('sanitize-html');

const NOTICE_OPTIONS = {
  allowedTags: ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li'],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

/** Help center article content — headings, lists, notes, warnings */
const HELP_CONTENT_OPTIONS = {
  allowedTags: [
    'b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li',
    'h2', 'h3', 'h4', 'blockquote', 'pre', 'code', 'div', 'span',
  ],
  allowedAttributes: {
    div: ['class'],
    span: ['class'],
    p: ['class'],
  },
  allowedClasses: {
    div: ['alert', 'alert-info', 'alert-warning', 'alert-danger', 'alert-success'],
    span: ['badge', 'text-muted'],
    p: ['text-muted'],
  },
  disallowedTagsMode: 'discard',
};

const CHAT_TEXT_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

function sanitizeNoticeContent(input) {
  const s = String(input ?? '');
  return sanitizeHtml(s, NOTICE_OPTIONS).trim();
}

/** Plain-text style chat: strip all HTML. */
function sanitizeChatText(input) {
  const s = String(input ?? '');
  return sanitizeHtml(s, CHAT_TEXT_OPTIONS).trim();
}

function sanitizeNoticeTitle(input) {
  const s = String(input ?? '').trim();
  return sanitizeHtml(s, CHAT_TEXT_OPTIONS).trim().slice(0, 500);
}

function sanitizeHelpContent(input) {
  const s = String(input ?? '');
  return sanitizeHtml(s, HELP_CONTENT_OPTIONS).trim();
}

module.exports = {
  sanitizeNoticeContent,
  sanitizeChatText,
  sanitizeNoticeTitle,
  sanitizeHelpContent,
};
