export function imageMatchesLibraryTab(image, activeTab) {
  if (activeTab === "gallery") return image?.showInGallery === true;
  if (activeTab === "site") return image?.siteAsset === true;
  return true;
}

export function imageMatchesVisibilityFilter(image, visibilityFilter) {
  if (visibilityFilter === "gallery") return image?.showInGallery === true;
  if (visibilityFilter === "public") {
    return image?.isPublic === true && image?.showInGallery !== true;
  }
  if (visibilityFilter === "private") return image?.isPublic !== true;
  if (visibilityFilter === "legacy") {
    return image?.galleryVisibilityLegacy === true || image?.siteAssetLegacy === true;
  }
  return true;
}
