// Shared limits for local editing and files. Private AI output has its own bound.
export const ARTICLE_BODY_LIMIT = 60000;
export const ARTICLE_LIMITS = Object.freeze({ title: 160, excerpt: 300, description: 160, slug: 80, body: ARTICLE_BODY_LIMIT });
export const MAX_IMPORT_BYTES = 512 * 1024;
export const MAX_BACKUP_BYTES = 512 * 1024;
export const MAX_CHECKPOINT_BYTES = 2 * 1024 * 1024;
export const MAX_ZIP_BYTES = 4 * 1024 * 1024;
