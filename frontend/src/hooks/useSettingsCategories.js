import { useEffect, useState } from "react";
import { getSettingsCategoryItems } from "@/services/settingsService";
import {
  DEFAULT_IMAGE_CATEGORIES,
  DEFAULT_LINK_CATEGORIES,
  IMAGE_CATEGORIES_TITLE,
} from "@/utils/categorySettings";

const fallbackFor = (groupTitle) => (
  groupTitle === IMAGE_CATEGORIES_TITLE
    ? DEFAULT_IMAGE_CATEGORIES
    : DEFAULT_LINK_CATEGORIES
);

export default function useSettingsCategories(groupTitle) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getSettingsCategoryItems(groupTitle)
      .then((items) => {
        if (active) setCategories(items);
      })
      .catch((error) => {
        // Keep safe defaults when settings are temporarily unavailable.
        console.warn("Unable to load category settings:", error?.code || error?.message);
        if (active) setCategories(fallbackFor(groupTitle));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [groupTitle]);

  return { categories, loading };
}
