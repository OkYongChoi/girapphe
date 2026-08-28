// Shared constants, API types, and utilities for web, mobile, and xr apps
// Add shared code here as the project grows

export const APP_NAME = 'Girapphe';

export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  LOCALE_META,
  SUPPORTED_LOCALES,
  getLocaleDirection,
  getLocaleFromPathname,
  isSupportedLocale,
  localizePathname,
  parseAcceptLanguage,
  resolveLocale,
  stripLocaleFromPathname,
  type Locale,
  type LocaleDirection,
} from './locale';

export {
  DOMAIN_NAMES,
  localizeDomain,
  localizeLevel,
  localizeType,
} from './taxonomy';

export {
  KNOWLEDGE_BUNDLE_SCHEMA_VERSION,
  KNOWLEDGE_BUNDLE_TYPES,
  createEmptyKnowledgeBundleContent,
  isKnowledgeBundleType,
  projectKnowledgeBundleContent,
  type ClaimEvidenceBundleContent,
  type ComparisonBundleContent,
  type ConceptBundleContent,
  type KnowledgeBundleContent,
  type KnowledgeBundleType,
  type KnowledgeBundleV1,
  type MechanismBundleContent,
  type ProcedureBundleContent,
  type StructureBundleContent,
} from './knowledge-bundles';
