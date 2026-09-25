export const FRONTEND_PRODUCT_SOURCE_ROOTS = [
  'frontend/apps',
  'frontend/packages',
  'frontend/bridges',
] as const;

export const FRONTEND_HANDWRITTEN_SOURCE_ROOTS = [
  ...FRONTEND_PRODUCT_SOURCE_ROOTS,
  'frontend/config',
  'frontend/scripts',
] as const;
