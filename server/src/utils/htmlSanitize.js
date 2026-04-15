const sanitizeHtml = require('sanitize-html');

const NOTICE_OPTIONS = {
  allowedTags: ['b', 'i', 'em', 'strong', 'br', 'p', 'ul', 'ol', 'li'],
  allowedAttributes: {},
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

module.exports = {
  sanitizeNoticeContent,
  sanitizeChatText,
  sanitizeNoticeTitle,
};
