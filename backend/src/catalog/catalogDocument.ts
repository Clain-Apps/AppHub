export type CatalogApplicationOverlay = {
  displayName?: string;
  imageFileName?: string;
};

export type CatalogDocument = {
  applications: Record<string, CatalogApplicationOverlay>;
};

export function emptyCatalogDocument(): CatalogDocument {
  return { applications: {} };
}
