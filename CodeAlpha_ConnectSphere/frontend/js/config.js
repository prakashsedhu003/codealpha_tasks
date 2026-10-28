/* ConnectSphere – configuration
 * The Express server serves this frontend, so API calls use a relative path
 * and work on http://localhost:3000 without any CORS setup.
 */
// ConnectSphere backend API URL

const API_BASE_URL = 'http://localhost:3000/api';

// Client-side limits (the server should still enforce its own rules).
const MIN_PASSWORD_LENGTH = 8;
const MAX_POST_LENGTH = 1000;
const MAX_BIO_LENGTH = 160;

// Names of the keys we use in the browser's storage.
const STORAGE = Object.freeze({
  token: 'cs_token',          // auth token returned by POST /api/auth/login (localStorage)
  user: 'cs_user',            // basic user info returned by login (localStorage)
  session: 'cs_session',      // 'cookie' when the server uses a cookie session instead of a token
  saved: 'cs_saved',          // bookmarked post ids – stored on this device only
  theme: 'cs_theme',          // 'light' | 'dark'
  localPosts: 'cs_local_posts', // local-only post previews (sessionStorage)
  unread: 'cs_unread',        // cached unread notification info (sessionStorage)
  seenStories: 'cs_seen_stories', // stories already viewed (sessionStorage)
  justPosted: 'cs_just_posted'    // post returned by the server right after creation (sessionStorage)
});
