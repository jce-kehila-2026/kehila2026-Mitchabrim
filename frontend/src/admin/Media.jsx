import { useState, useRef, useEffect } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import { Search, Globe, Copy } from "lucide-react";

// Firestore + Storage access is encapsulated in the images service.
import {
  getImagesPage,
  loadAdminImagePreview,
  uploadImage,
  updateImage,
  deleteImage as deleteImageService,
  toggleImagePublic,
  publishImageToGallery,
  setImageSiteAsset,
  setImageGalleryVisibility,
  createImageDoc,
} from "@/services/imagesService";
import { validateFile } from "@/utils/validation";
import { sanitizeText } from "@/utils/sanitize";
import { GALLERY_IMAGE_MAX_MB } from "@/services/imageStoragePolicy";
import useSettingsCategories from "@/hooks/useSettingsCategories";
import {
  imageMatchesLibraryTab,
  imageMatchesVisibilityFilter,
} from "@/utils/imageLibraryFilters";
import {
  IMAGE_CATEGORIES_TITLE,
} from "@/utils/categorySettings";

const IMAGE_PAGE_SIZE = 24;
const imageMutationErrorMessage = (error, fallback) => {
  const reason = error?.details?.reason || error?.customData?.details?.reason;
  const details = error?.details || error?.customData?.details || {};
  if (reason === "image-in-use") {
    return `לא ניתן לבצע את הפעולה: התמונה בשימוש ב-${details.usageCount || 1} מקומות באתר.`;
  }
  if (reason === "image-in-gallery") {
    return "יש להסיר את התמונה מהגלריה לפני הפעולה.";
  }
  if (reason === "image-is-site-asset") {
    return "יש להסיר תחילה את התמונה מרשימת תמונות האתר. הסיווג מגן עליה ממחיקה ומהפיכה לפרטית.";
  }
  if (reason === "image-not-found") {
    return "התמונה כבר אינה קיימת במאגר. יש לרענן את הרשימה.";
  }
  if (reason === "external-image") {
    return "לא ניתן להפוך קישור חיצוני לתמונה פרטית מנוהלת.";
  }
  if (reason === "image-reference-migration-required") {
    return "פעולות מחיקה והפיכה לפרטית יופעלו לאחר השלמת מיפוי תמונות האתר.";
  }
  const code = String(error?.code || "");
  if (code === "app-check/config-missing") {
    return "App Check אינו מוגדר בבנייה הנוכחית. יש לבנות מחדש עם הגדרת ה-Production המתאימה.";
  }
  if (code.includes("app-check") || code.includes("appCheck")) {
    return "אימות App Check נכשל. יש לרענן את הדף ולוודא שהדומיין וההגדרה של הסביבה מאושרים.";
  }
  if (code.includes("unauthenticated") || code.includes("permission-denied")) {
    return "הפעולה נדחתה. יש לוודא שהחשבון מחובר כמנהל פעיל.";
  }
  if (code.includes("not-found")) {
    return "שירות ניהול התמונות mutateImage אינו זמין בסביבה זו. יש לפרסם את ה-Function לפני שימוש בפעולה.";
  }
  if (code.includes("unavailable") || code.includes("network")) {
    return "לא ניתן להגיע כעת לשירות ניהול התמונות. בדקו את החיבור ונסו שוב.";
  }
  if (code === "images/invalid-callable-response") {
    return "שירות ניהול התמונות החזיר תשובה לא תקינה. יש לוודא שגרסת ה-Function תואמת ל-Hosting.";
  }
  return fallback;
};
const IMAGE_ACTION_COPY = {
  "make-public": {
    title: "הפיכת תמונה לציבורית",
    message: "התמונה תהיה זמינה בקישור ציבורי, אך לא תתווסף לגלריה עד לבחירה נפרדת.",
    confirm: "כן, הפוך לציבורית",
  },
  "make-private": {
    title: "הפיכת תמונה לפרטית",
    message: "התמונה תוסר גם מהגלריה. קישורים קיימים או שימוש ידני בתמונה באתר עלולים להפסיק לעבוד.",
    confirm: "כן, הפוך לפרטית",
  },
  "add-gallery": {
    title: "הוספה לגלריה הציבורית",
    message: "התמונה תופיע בעמוד הבית ובעמוד הגלריה הציבורית.",
    confirm: "כן, הוסף לגלריה",
  },
  "remove-gallery": {
    title: "הסרה מהגלריה",
    message: "התמונה תישאר ציבורית והקישור שלה ימשיך לעבוד, אך היא לא תוצג בגלריה.",
    confirm: "כן, הסר מהגלריה",
  },
  "publish-and-add-gallery": {
    title: "פרסום והוספה לגלריה",
    message: "התמונה פרטית. פעולה זו תהפוך אותה לציבורית ותוסיף אותה לגלריה בפעולה מוגנת אחת.",
    confirm: "כן, פרסם והוסף",
  },
  "add-site-asset": {
    title: "הוספה לתמונות האתר",
    message: "התמונה תסומן כתמונה שמורה לאתר הציבורי. אם היא פרטית, היא תהפוך לציבורית. היא לא תתווסף לגלריה.",
    confirm: "כן, הוסף לתמונות האתר",
  },
  "remove-site-asset": {
    title: "הסרה מתמונות האתר",
    message: "הסיווג יוסר בלבד. התמונה לא תימחק, פרטיותה לא תשתנה והיא לא תתווסף לגלריה.",
    confirm: "כן, הסר מתמונות האתר",
  },
};

export default function Media() {
  const { categories } = useSettingsCategories(IMAGE_CATEGORIES_TITLE);
  const [imagesList, setImagesList] = useState([]);
  const fileInputRef = useRef(null);
  const previewGenerationRef = useRef(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [dateSort, setDateSort] = useState("newest");
  const [pageCursor, setPageCursor] = useState(null);
  const [hasMoreImages, setHasMoreImages] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingImageIds, setPendingImageIds] = useState(() => new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    notes: "",
    isPublic: false,
    showInGallery: false,
  });

  const [toastMessage, setToastMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, image: null });
  const [actionConfirm, setActionConfirm] = useState({ isOpen: false, type: "", image: null });

  // State for Image Details/Edit Modal
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, image: null });
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const generation = ++previewGenerationRef.current;
    setIsLoadingImages(true);
    setImagesList([]);
    setPageCursor(null);
    setHasMoreImages(false);

    const loadPreview = async (image) => {
      if (image.isPublic) return;
      const preview = await loadAdminImagePreview(image);
      if (generation !== previewGenerationRef.current || !preview.previewIsTemporary) return;
      setImagesList((current) => current.map((item) => (
        item.id === image.id && item.storagePath === image.storagePath && !item.isPublic
          ? preview
          : item
      )));
    };

    const fetchImages = async () => {
      try {
        const page = await getImagesPage({
          pageSize: IMAGE_PAGE_SIZE,
          tab: activeTab,
        });
        if (generation !== previewGenerationRef.current) return;
        setImagesList(page.images);
        setPageCursor(page.cursor);
        setHasMoreImages(page.hasMore);
        page.images.forEach((image) => { void loadPreview(image); });
      } catch (error) {
        console.error("Error fetching images:", error);
        showToast("לא ניתן לטעון את מאגר התמונות.");
      } finally {
        if (generation === previewGenerationRef.current) setIsLoadingImages(false);
      }
    };
    fetchImages();
    return () => {
      if (generation === previewGenerationRef.current) previewGenerationRef.current += 1;
    };
  }, [activeTab]);

  const loadPreviewIntoList = async (image) => {
    if (image.isPublic) return image;
    const preview = await loadAdminImagePreview(image);
    if (!preview.previewIsTemporary) return image;
    setImagesList((current) => current.map((item) => (
      item.id === image.id && item.storagePath === image.storagePath && !item.isPublic
        ? preview
        : item
    )));
    return preview;
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const setImagePending = (imageId, pending) => {
    setPendingImageIds((current) => {
      const next = new Set(current);
      if (pending) next.add(imageId);
      else next.delete(imageId);
      return next;
    });
  };

  const loadMoreImages = async () => {
    if (!hasMoreImages || isLoadingMore || !pageCursor) return;
    setIsLoadingMore(true);
    try {
      const page = await getImagesPage({
        pageSize: IMAGE_PAGE_SIZE,
        cursor: pageCursor,
        tab: activeTab,
      });
      setImagesList((current) => {
        const knownIds = new Set(current.map((image) => image.id));
        return [...current, ...page.images.filter((image) => !knownIds.has(image.id))];
      });
      setPageCursor(page.cursor);
      setHasMoreImages(page.hasMore);
      page.images.forEach((image) => { void loadPreviewIntoList(image); });
    } catch (error) {
      console.error("Error loading more images:", error);
      showToast("לא ניתן לטעון תמונות נוספות.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleOpenModal = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFormData({
      title: "",
      category: "",
      notes: "",
      isPublic: false,
      showInGallery: false,
    });
    setIsModalOpen(true);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileErr = validateFile(file, { maxMB: GALLERY_IMAGE_MAX_MB, types: ["image/"] });
    if (fileErr) {
      showToast(fileErr);
      event.target.value = "";
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result);
    };
    reader.readAsDataURL(file);

    setFormData((prev) => ({
      ...prev,
      title: file.name.split(".").pop() ? file.name.replace(/\.[^/.]+$/, "") : file.name,
    }));
  };

  const handleFinalUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast("אנא בחר קובץ תמונה");
      return;
    }
    const fileErr = validateFile(selectedFile, { maxMB: GALLERY_IMAGE_MAX_MB, types: ["image/"] });
    if (fileErr) { showToast(fileErr); return; }
    const cleanTitle = sanitizeText(formData.title, 200);
    if (!cleanTitle) {
      showToast("אנא הזן שם לתמונה");
      return;
    }
    if (!formData.category) {
      showToast("אנא בחר קטגוריה");
      return;
    }

    setIsUploading(true);

    try {
      const cleanNotes = sanitizeText(formData.notes, 1000);
      const created = await uploadImage({
        file: selectedFile,
        title: cleanTitle,
        category: formData.category,
        notes: cleanNotes,
        isPublic: formData.isPublic || false,
        showInGallery: formData.isPublic && formData.showInGallery,
      });
      setImagesList((prevList) => [...prevList, created]);
      void loadPreviewIntoList(created);

      showToast("התמונה הועלתה ונשמרה בהצלחה!");
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error during upload:", error);
      showToast("אירעה שגיאה בזמן ההעלאה. אנא נסה שוב.");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerDeleteConfirm = (e, img) => {
    e.stopPropagation();
    if (img.usageCount > 0) {
      showToast(`לא ניתן למחוק: התמונה בשימוש ב-${img.usageCount} מקומות באתר.`);
      setDetailsModal({ isOpen: true, image: { ...img } });
      return;
    }
    if (img.siteAsset) {
      showToast("לא ניתן למחוק תמונת אתר. יש להסיר תחילה את הסיווג 'תמונת אתר'.");
      return;
    }
    if (img.showInGallery) {
      showToast("יש להסיר את התמונה מהגלריה לפני המחיקה.");
      return;
    }
    setDeleteConfirm({ isOpen: true, image: img });
  };

  const executeDelete = async () => {
    const imageToDelete = deleteConfirm.image;
    if (!imageToDelete) return;

    if (pendingImageIds.has(imageToDelete.id)) return;
    setImagePending(imageToDelete.id, true);
    try {
      await deleteImageService(imageToDelete);

      setImagesList((prevList) => prevList.filter((img) => img.id !== imageToDelete.id));

      if (detailsModal.image && detailsModal.image.id === imageToDelete.id) {
        setDetailsModal({ isOpen: false, image: null });
      }

      showToast("התמונה נמחקה בהצלחה!");
    } catch (error) {
      console.error("Error deleting image:", error);
      showToast(imageMutationErrorMessage(error, "שגיאה במחיקת התמונה."));
    } finally {
      setImagePending(imageToDelete.id, false);
      setDeleteConfirm({ isOpen: false, image: null });
    }
  };

  const requestImageAction = (e, type, img) => {
    e.stopPropagation();
    if (pendingImageIds.has(img.id)) return;
    if (type === "make-private" && img.usageCount > 0) {
      showToast(`לא ניתן להפוך לפרטית: התמונה בשימוש ב-${img.usageCount} מקומות באתר.`);
      setDetailsModal({ isOpen: true, image: { ...img } });
      return;
    }
    if (type === "make-private" && img.siteAsset) {
      showToast("לא ניתן להפוך תמונת אתר לפרטית. יש להסיר תחילה את הסיווג 'תמונת אתר'.");
      return;
    }
    if (type === "make-private" && img.showInGallery) {
      showToast("יש להסיר את התמונה מהגלריה לפני הפיכתה לפרטית.");
      return;
    }
    if (type === "remove-site-asset" && img.usageCount > 0) {
      const places = img.usageRefs
        .map((usage) => usage.label || usage.field)
        .filter(Boolean)
        .join(", ");
      showToast(
        places
          ? `לא ניתן להסיר: התמונה בשימוש ב-${places}.`
          : `לא ניתן להסיר: התמונה בשימוש ב-${img.usageCount} מקומות באתר.`,
      );
      setDetailsModal({ isOpen: true, image: { ...img } });
      return;
    }
    setActionConfirm({ isOpen: true, type, image: img });
  };

  const executeImageAction = async () => {
    const { image, type } = actionConfirm;
    if (!image || pendingImageIds.has(image.id)) return;
    setImagePending(image.id, true);
    try {
      let updated;
      if (type === "make-public") updated = await toggleImagePublic(image, true);
      else if (type === "make-private") updated = await toggleImagePublic(image, false);
      else if (type === "publish-and-add-gallery") updated = await publishImageToGallery(image);
      else if (type === "add-site-asset") updated = await setImageSiteAsset(image, true);
      else if (type === "remove-site-asset") updated = await setImageSiteAsset(image, false);
      else if (type === "add-gallery") updated = await setImageGalleryVisibility(image, true);
      else if (type === "remove-gallery") updated = await setImageGalleryVisibility(image, false);
      else throw new Error("Unknown image action");

      setImagesList((prevList) =>
        prevList.map((item) => (item.id === image.id ? updated : item))
      );
      setDetailsModal((current) => (
        current.image?.id === image.id
          ? { isOpen: true, image: updated }
          : current
      ));
      void loadPreviewIntoList(updated);
      const successMessages = {
        "make-public": "התמונה הפכה לציבורית. היא לא נוספה לגלריה.",
        "make-private": "התמונה הפכה לפרטית והוסרה מהגלריה.",
        "add-gallery": "התמונה נוספה לגלריה הציבורית.",
        "remove-gallery": "התמונה הוסרה מהגלריה.",
        "publish-and-add-gallery": "התמונה פורסמה ונוספה לגלריה הציבורית.",
        "add-site-asset": "התמונה נוספה לתמונות האתר. מצב הגלריה לא השתנה.",
        "remove-site-asset": "התמונה הוסרה מתמונות האתר. היא לא נמחקה.",
      };
      showToast(successMessages[type]);
    } catch (error) {
      console.error("Error updating image visibility:", error);
      showToast(imageMutationErrorMessage(error, "לא ניתן לעדכן את מצב התמונה."));
    } finally {
      setImagePending(image.id, false);
      setActionConfirm({ isOpen: false, type: "", image: null });
    }
  };

  const copyPublicImageUrl = async (e, image) => {
    e.stopPropagation();
    if (!image?.isPublic || !image.url) {
      showToast("אין קישור ציבורי זמין לתמונה זו");
      return;
    }
    try {
      await navigator.clipboard.writeText(image.url);
      showToast("קישור התמונה הועתק");
    } catch (error) {
      console.error("Unable to copy public image URL:", error);
      showToast("לא ניתן להעתיק את הקישור בדפדפן זה");
    }
  };

  const handleOpenDetails = (img) => {
    setDetailsModal({ isOpen: true, image: { ...img } });
  };

  const handleUpdateImageDetails = async () => {
    if (!detailsModal.image) return;
    setIsUpdating(true);
    const cleanTitle = sanitizeText(detailsModal.image.title, 200);
    const cleanNotes = sanitizeText(detailsModal.image.notes, 1000);
    if (!cleanTitle) { showToast("אנא הזן שם לתמונה"); setIsUpdating(false); return; }
    try {
      const updated = await updateImage(detailsModal.image.id, {
        title: cleanTitle,
        category: detailsModal.image.category,
        notes: cleanNotes,
      });

      setImagesList((prevList) =>
        prevList.map((img) =>
          img.id === detailsModal.image.id
            ? updated
            : img,
        ),
      );

      setDetailsModal({ isOpen: true, image: updated });
      void loadPreviewIntoList(updated);

      showToast("פרטי התמונה עודכנו בהצלחה!");
    } catch (error) {
      console.error("Error updating image details:", error);
      showToast("שגיאה בעדכון פרטי התמונה.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSeedMockImages = async () => {
    if (!window.confirm("האם אתה בטוח שברצונך להוסיף 35 תמונות לדוגמה (7 לכל קטגוריה) למאגר?")) return;
    
    showToast("מתחיל להוסיף תמונות לדוגמה...");
    let addedCount = 0;
    
    const mock_urls = {
      "פרלמנטים": [
        "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80"
      ],
      "מתנדבים": [
        "https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&auto=format&fit=crop&q=80"
      ],
      "חגים": [
        "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1513507804186-01a60f249e47?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1482862549707-f63cb32c5fd9?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1507504038482-76210374c27f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512418490979-92798cec1380?w=800&auto=format&fit=crop&q=80"
      ],
      "שיווק": [
        "https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1533750516457-a7f992034fec?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80"
      ],
      "כרטיסי ברכה": [
        "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1512909006721-3d6018887383?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&auto=format&fit=crop&q=80"
      ]
    };

    try {
      const addedDocs = [];
      for (const category of categories) {
        const urls = mock_urls[category];
        if (!Array.isArray(urls)) continue;
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          const today = new Date();
          today.setDate(today.getDate() - i);
          const displayDate = today.toLocaleDateString("he-IL");
          
          const created = await createImageDoc({
            title: `${category} - תמונה לדוגמה ${i + 1}`,
            category: category,
            notes: `תמונת תרגול עבור קטגוריית ${category}.`,
            url: url,
            displayDate: displayDate,
            isPublic: true,
            showInGallery: true,
          });
          addedDocs.push({
            ...created,
            uploadedAt: { seconds: Math.floor(today.getTime() / 1000) },
          });
          addedCount++;
        }
      }
      
      setImagesList((prevList) => [...prevList, ...addedDocs]);
      showToast(`בהצלחה! נוספו ${addedCount} תמונות לדוגמה.`);
    } catch (error) {
      console.error("Error seeding mock images:", error);
      showToast("שגיאה בהוספת תמונות לדוגמה.");
    }
  };

  const parseDate = (dateString) => {
    if (!dateString) return 0;
    const [day, month, year] = dateString.split(".");
    return new Date(`${year}-${month}-${day}`).getTime();
  };

  const displayedImages = imagesList
    .filter((img) => {
      const matchesSearch = (img.title || "").toLowerCase().includes((searchQuery || "").toLowerCase());
      const matchesCategory = selectedCategory === "" || img.category === selectedCategory;
      const matchesVisibility = imageMatchesVisibilityFilter(img, visibilityFilter);
      const matchesTab = imageMatchesLibraryTab(img, activeTab);
      return matchesSearch && matchesCategory && matchesVisibility && matchesTab;
    })
    .sort((a, b) => {
      if (dateSort === "newest") {
        return parseDate(b.displayDate) - parseDate(a.displayDate);
      } else {
        return parseDate(a.displayDate) - parseDate(b.displayDate);
      }
    });

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #ced4da",
    outline: "none",
    fontFamily: "inherit",
    direction: "rtl",
    fontSize: "14px",
  };

  return (
    <AdminPageLayout heroImage="/admin-heroes/gallery_hero.webp"
      title="ניהול תמונות"
      subtitle="ניהול תמונות האתר, גלריות ותמונות מוצגות"
      actions={
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="action-btn-primary" onClick={handleOpenModal}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            העלאת תמונה
          </button>
          
          
        </div>
      }
    >
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; transition: background 0.2s; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .modal-form-select {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: left 12px center;
            padding-left: 40px !important;
        }

        .image-card-container {
            border-radius: 12px;
            overflow: hidden;
            background: #fff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            position: relative;
            cursor: pointer;
        }
        .image-card-container:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 16px rgba(139,44,44,0.1);
            border-color: #cbd5e1;
        }

        .text-truncate {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
        }
        
        .notes-truncate {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .media-status-row, .media-card-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
        }
        .media-status-badge {
            display: inline-flex;
            align-items: center;
            min-height: 26px;
            padding: 3px 9px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            border: 1px solid transparent;
        }
        .media-status-public { color: #1f6b3a; background: #edf8f0; border-color: #b9dfc4; }
        .media-status-private { color: #4b5563; background: #f1f5f9; border-color: #cbd5e1; }
        .media-status-gallery { color: #7f1d1d; background: #fff1f2; border-color: #fecdd3; }
        .media-status-legacy { color: #854d0e; background: #fefce8; border-color: #fde68a; }
        .media-status-site { color: #1e3a8a; background: #eff6ff; border-color: #bfdbfe; }
        .media-status-site-asset { color: #075985; background: #ecfeff; border-color: #a5f3fc; }
        .media-library-tabs {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            direction: rtl;
            margin-bottom: 16px;
        }
        .media-library-tab {
            min-height: 44px;
            padding: 9px 18px;
            border: 1px solid #d8dee5;
            border-radius: 999px;
            background: #fff;
            color: #475569;
            font: inherit;
            font-weight: 700;
            cursor: pointer;
        }
        .media-library-tab.is-active {
            color: #fff;
            border-color: #8b2c2c;
            background: #8b2c2c;
        }
        .media-usage-list {
            margin: 8px 0 0;
            padding: 8px 24px 8px 8px;
            border-radius: 10px;
            background: #eff6ff;
            color: #1e3a8a;
            font-size: 12px;
            line-height: 1.6;
        }
        .media-card-actions {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #edf0f2;
        }
        .media-action-button {
            min-height: 38px;
            padding: 7px 10px;
            border-radius: 9px;
            border: 1px solid #d8dee5;
            background: #fff;
            color: #334155;
            cursor: pointer;
            font: inherit;
            font-size: 11px;
            font-weight: 700;
            flex: 1 1 112px;
        }
        .media-action-button:hover:not(:disabled) { border-color: #8b2c2c; color: #8b2c2c; }
        .media-action-button:disabled { cursor: wait; opacity: .55; }
        .media-action-danger { color: #b42318; border-color: #fecaca; background: #fff7f7; }
        @media (max-width: 640px) {
            .media-action-button { flex-basis: 100%; min-height: 44px; }
        }
      `}</style>

      {toastMessage && (
        <div className="admin-toast">
          <span className="admin-toast-check">✓</span>
          {toastMessage}
        </div>
      )}

      <div className="media-library-tabs" role="tablist" aria-label="סוגי תמונות">
        {[
          { id: "all", label: "כל התמונות" },
          { id: "gallery", label: "תמונות הגלריה" },
          { id: "site", label: "תמונות האתר" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`media-library-tab ${activeTab === tab.id ? "is-active" : ""}`}
            onClick={() => {
              setActiveTab(tab.id);
              setVisibilityFilter("all");
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SectionCard>
        <div
          style={{
            backgroundColor: "#fdfbf7",
            padding: "20px",
            borderRadius: "12px",
            border: "1px solid #e2d8c9",
            marginBottom: "24px",
            direction: "rtl",
          }}
        >
          <div style={{ marginBottom: "16px", position: "relative", maxWidth: "100%" }}>
            <span
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#adb5bd",
                display: "flex",
                alignItems: "center"
              }}
            >
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="חיפוש תמונה לפי שם..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              dir="rtl"
              style={{
                ...inputStyle,
                padding: "12px 40px 12px 16px",
                borderRadius: "30px",
                backgroundColor: "#fff",
                border: "1px solid #ced4da",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "#8b2c2c",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
                סינון:
              </span>
              <select
                className="modal-form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                dir="rtl"
                style={{
                  ...inputStyle,
                  padding: "10px 16px",
                  borderRadius: "30px",
                  minWidth: "160px",
                  backgroundColor: "#fff",
                }}
              >
                <option value="">קטגוריה: הכל</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
              <span style={{ color: "#8b2c2c", fontWeight: "bold", fontSize: "14px" }}>מיון לפי:</span>
              <select
                className="modal-form-select"
                value={dateSort}
                onChange={(e) => setDateSort(e.target.value)}
                dir="rtl"
                style={{
                  ...inputStyle,
                  padding: "10px 16px",
                  borderRadius: "30px",
                  minWidth: "160px",
                  backgroundColor: "#fff",
                }}
              >
                <option value="newest">החדש ביותר</option>
                <option value="oldest">הישן ביותר</option>
              </select>
            </div>

            {activeTab === "all" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
              <span style={{ color: "#8b2c2c", fontWeight: "bold", fontSize: "14px" }}>מצב:</span>
              <select
                className="modal-form-select"
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value)}
                dir="rtl"
                style={{
                  ...inputStyle,
                  padding: "10px 16px",
                  borderRadius: "30px",
                  minWidth: "190px",
                  backgroundColor: "#fff",
                }}
              >
                <option value="all">כל המצבים</option>
                <option value="gallery">מוצגות בגלריה</option>
                <option value="public">ציבוריות מחוץ לגלריה</option>
                <option value="private">פרטיות</option>
                <option value="legacy">דורשות השלמת הסבה</option>
              </select>
            </div>
            )}
          </div>
          <div style={{ marginTop: 12, color: "#64748b", fontSize: 12 }}>
            נטענו {imagesList.length} תמונות. החיפוש והסינון חלים על התמונות שנטענו.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 16,
            direction: "rtl",
          }}
        >
          {displayedImages.map((img) => (
            <div key={img.id} className="image-card-container" onClick={() => handleOpenDetails(img)}>
              <div
                style={{
                  aspectRatio: "4/3",
                  backgroundColor: "#f8f9fa",
                  borderBottom: "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                <img
                  src={img.url}
                  alt={img.title || ""}
                  loading="lazy"
                  decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>

              <div style={{ padding: "12px" }}>
                <div className="media-status-row" style={{ marginBottom: 9 }}>
                  <span className={`media-status-badge ${img.isPublic ? "media-status-public" : "media-status-private"}`}>
                    {img.isPublic ? "ציבורית" : "פרטית"}
                  </span>
                  {img.showInGallery && (
                    <span className="media-status-badge media-status-gallery">מוצגת בגלריה</span>
                  )}
                  {img.siteAsset && (
                    <span className="media-status-badge media-status-site-asset">תמונת אתר</span>
                  )}
                  {img.usageCount > 0 && (
                    <span className="media-status-badge media-status-site">
                      בשימוש באתר · {img.usageCount}
                    </span>
                  )}
                  {img.galleryVisibilityLegacy && (
                    <span className="media-status-badge media-status-legacy">מצב ישן — טרם הוסב</span>
                  )}
                </div>
                <div
                  className="text-truncate"
                  style={{ fontWeight: 700, color: "#343a40", fontSize: "13.5px" }}
                  title={img.title}
                >
                  {img.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#6c757d",
                    marginTop: 4,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategory(img.category);
                    }}
                    title={`סנן לפי קטגוריה: ${img.category}`}
                    style={{
                      backgroundColor: "#fdfbf7",
                      padding: "2px 6px",
                      borderRadius: "10px",
                      border: "1px solid #e2d8c9",
                      fontWeight: "600",
                      color: "#8b2c2c",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#8b2c2c";
                      e.currentTarget.style.color = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#fdfbf7";
                      e.currentTarget.style.color = "#8b2c2c";
                    }}
                  >
                    {img.category}
                  </span>
                  <span>{img.displayDate}</span>
                </div>
                {img.notes && (
                  <div
                    className="notes-truncate"
                    style={{
                      fontSize: 11,
                      color: "#6c757d",
                      marginTop: 8,
                      fontStyle: "italic",
                      borderTop: "1px dashed #e2e8f0",
                      paddingTop: "6px",
                      lineHeight: "1.4",
                    }}
                    title={img.notes}
                  >
                    {img.notes}
                  </div>
                )}
                {img.usageCount > 0 && (
                  <ul className="media-usage-list">
                    {img.usageRefs.slice(0, 2).map((usage) => (
                      <li key={usage.key}>{usage.label || usage.field}</li>
                    ))}
                    {img.usageCount > 2 && <li>ועוד {img.usageCount - 2} מקומות</li>}
                  </ul>
                )}
                <div className="media-card-actions">
                  <button
                    type="button"
                    className="media-action-button"
                    disabled={pendingImageIds.has(img.id)}
                    onClick={(e) => requestImageAction(
                      e,
                      img.isPublic ? "make-private" : "make-public",
                      img,
                    )}
                  >
                    {pendingImageIds.has(img.id)
                      ? "מעדכן..."
                      : img.isPublic ? "הפוך לפרטית" : "הפוך לציבורית"}
                  </button>
                  <button
                    type="button"
                    className="media-action-button"
                    disabled={pendingImageIds.has(img.id)}
                    onClick={(e) => requestImageAction(
                      e,
                      img.showInGallery
                        ? "remove-gallery"
                        : (img.isPublic ? "add-gallery" : "publish-and-add-gallery"),
                      img,
                    )}
                  >
                    {img.showInGallery
                      ? "הסר מהגלריה"
                      : (img.isPublic ? "הוסף לגלריה" : "פרסם והוסף לגלריה")}
                  </button>
                  <button
                    type="button"
                    className="media-action-button"
                    disabled={pendingImageIds.has(img.id)}
                    onClick={(e) => requestImageAction(
                      e,
                      img.siteAsset ? "remove-site-asset" : "add-site-asset",
                      img,
                    )}
                  >
                    {img.siteAsset ? "הסר מתמונות האתר" : "הוסף לתמונות האתר"}
                  </button>
                  {img.isPublic && img.url && (
                    <button
                      type="button"
                      className="media-action-button"
                      disabled={pendingImageIds.has(img.id)}
                      onClick={(e) => copyPublicImageUrl(e, img)}
                      title="העתקת קישור התמונה"
                      aria-label={`העתקת קישור: ${img.title || "תמונה"}`}
                    >
                      <Copy size={14} aria-hidden /> העתק קישור
                    </button>
                  )}
                  <button
                    type="button"
                    className="media-action-button media-action-danger"
                    disabled={pendingImageIds.has(img.id)}
                    onClick={(e) => triggerDeleteConfirm(e, img)}
                  >
                    מחיקה
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!isLoadingImages && displayedImages.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px", color: "#adb5bd" }}>
              לא נמצאו תמונות התואמות לחיפוש שלך.
            </div>
          )}
          {isLoadingImages && (
            <div role="status" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px", color: "#64748b" }}>
              טוען תמונות...
            </div>
          )}
        </div>
        {hasMoreImages && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <button
              type="button"
              className="btn"
              onClick={loadMoreImages}
              disabled={isLoadingMore}
              style={{ minWidth: 180 }}
            >
              {isLoadingMore ? "טוען..." : "טען תמונות נוספות"}
            </button>
          </div>
        )}
      </SectionCard>

      {/* 1. Upload Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(15,23,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4000,
            direction: "rtl",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "20px",
              width: "90%",
              maxWidth: "680px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
            }}
          >
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid #e2d8c9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <h3 style={{ margin: 0, color: "#343a40", fontSize: "1.5rem", fontWeight: "bold" }}>העלאת תמונה חדשה</h3>
              <button
                onClick={() => !isUploading && setIsModalOpen(false)}
                style={{
                  background: "#f8f9fa",
                  border: "1px solid #e2d8c9",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#6c757d",
                  transition: "0.2s",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="custom-scroll" style={{ padding: "32px", overflowY: "auto", flexGrow: 1 }}>
              <form id="upload-image-form" onSubmit={handleFinalUpload}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "16px",
                    marginBottom: "24px",
                  }}
                >
                  {filePreview ? (
                    <img
                      src={filePreview}
                      alt="Preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "200px",
                        objectFit: "contain",
                        borderRadius: "12px",
                        border: "1px solid #ced4da",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    />
                  ) : (
                    <div
                      onClick={() => fileInputRef.current.click()}
                      style={{
                        height: "120px",
                        width: "100%",
                        border: "2px dashed #ced4da",
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#6c757d",
                        backgroundColor: "#faf8f5",
                        cursor: "pointer",
                        transition: "0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#8b2c2c")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#ced4da")}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ marginBottom: "8px" }}
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      לחץ כאן לבחירת תמונה מהמחשב
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    style={{ display: "none" }}
                  />
                  {filePreview && (
                    <button
                      type="button"
                      style={{
                        fontSize: "13px",
                        backgroundColor: "#fff",
                        border: "1px solid #ced4da",
                        color: "#495057",
                        padding: "6px 20px",
                        borderRadius: "30px",
                        cursor: "pointer",
                        fontWeight: "600",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                      }}
                      onClick={() => fileInputRef.current.click()}
                    >
                      החלף תמונה
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "600",
                        fontSize: "13.5px",
                        color: "#495057",
                      }}
                    >
                      שם התמונה <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="לדוגמה: פעילות התנדבות"
                      value={formData.title}
                      onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid #ced4da",
                        outline: "none",
                        boxSizing: "border-box",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontWeight: "600",
                        fontSize: "13.5px",
                        color: "#495057",
                      }}
                    >
                      קטגוריה <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <select
                      className="modal-form-select"
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))}
                      style={{ backgroundColor: "#fff" }}
                    >
                      <option value="">-- בחר נושא --</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "600",
                      fontSize: "13.5px",
                      color: "#495057",
                    }}
                  >
                    הערות / תיאור
                  </label>
                  <textarea
                    placeholder="פרטים נוספים על התמונה..."
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #ced4da",
                      outline: "none",
                      resize: "none",
                      boxSizing: "border-box",
                      fontSize: "14px",
                    }}
                  ></textarea>
                  <div style={{ marginTop: 16, padding: 14, border: "1px solid #e2d8c9", borderRadius: 12, background: "#fffaf5" }}>
                    <label style={{ margin: 0, fontWeight: "700", fontSize: "13.5px", color: "#495057", display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={formData.isPublic || false}
                        onChange={(e) => setFormData((current) => ({
                          ...current,
                          isPublic: e.target.checked,
                          showInGallery: e.target.checked ? current.showInGallery : false,
                        }))}
                        style={{ width: "20px", height: "20px", accentColor: "#8B0000", cursor: "pointer" }}
                      />
                      <Globe size={16} /> תמונה ציבורית — מאפשרת קישור ציבורי
                    </label>
                    <label style={{ margin: "12px 0 0", fontWeight: "700", fontSize: "13.5px", color: formData.isPublic ? "#495057" : "#94a3b8", display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={formData.showInGallery || false}
                        disabled={!formData.isPublic}
                        onChange={(e) => setFormData((current) => ({
                          ...current,
                          showInGallery: e.target.checked,
                        }))}
                        style={{ width: "20px", height: "20px", accentColor: "#8B0000", cursor: formData.isPublic ? "pointer" : "not-allowed" }}
                      />
                      הצג בגלריה הציבורית
                    </label>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                      הוספה לגלריה אפשרית רק לאחר שהחלטת להפוך את התמונה לציבורית.
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div
              style={{
                padding: "20px 32px",
                borderTop: "1px solid #e2d8c9",
                backgroundColor: "#faf8f5",
                borderBottomLeftRadius: "20px",
                borderBottomRightRadius: "20px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => !isUploading && setIsModalOpen(false)}
                disabled={isUploading}
                style={{
                  padding: "12px 32px",
                  borderRadius: "30px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  color: "#495057",
                }}
              >
                ביטול
              </button>
              <button
                type="submit"
                form="upload-image-form"
                disabled={isUploading}
                style={{
                  padding: "12px 32px",
                  borderRadius: "30px",
                  border: "none",
                  backgroundColor: "#8b2c2c",
                  color: "white",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(139,44,44,0.2)",
                }}
              >
                {isUploading ? "מעלה ושומר..." : "שמור תמונה למאגר"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Image Details & Edit Modal (Lightbox) */}
      {detailsModal.isOpen && detailsModal.image && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(15,23,42,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 4000,
            direction: "rtl",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setIsUpdating(false) || setDetailsModal({ isOpen: false, image: null })}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderRadius: "20px",
              width: "95%",
              maxWidth: "900px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              maxHeight: "95vh",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 32px",
                borderBottom: "1px solid #e2d8c9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#fff",
              }}
            >
              <h3 style={{ margin: 0, color: "#343a40", fontSize: "1.4rem", fontWeight: "bold" }}>פרטי תמונה</h3>
              <div style={{ display: "flex", gap: "12px" }}>
                <a
                  href={detailsModal.image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: "#f8f9fa",
                    border: "1px solid #e2d8c9",
                    borderRadius: "30px",
                    padding: "6px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    color: "#495057",
                    textDecoration: "none",
                    fontSize: "13px",
                    fontWeight: "600",
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  פתח בגודל מלא
                </a>
                <button
                  onClick={() => setDetailsModal({ isOpen: false, image: null })}
                  style={{
                    background: "#f8f9fa",
                    border: "1px solid #e2d8c9",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#6c757d",
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>

            <div
              className="custom-scroll"
              style={{ display: "flex", flexWrap: "wrap", overflowY: "auto", flexGrow: 1, backgroundColor: "#faf8f5" }}
            >
              <div
                style={{
                  flex: "1 1 50%",
                  minWidth: "300px",
                  padding: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#e9ecef",
                }}
              >
                <img
                  src={detailsModal.image.url}
                  alt={detailsModal.image.title}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "500px",
                    objectFit: "contain",
                    borderRadius: "12px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  }}
                />
              </div>

              <div
                style={{
                  flex: "1 1 50%",
                  minWidth: "300px",
                  padding: "32px",
                  backgroundColor: "#fff",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ marginBottom: "24px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#495057",
                    }}
                  >
                    שם התמונה
                  </label>
                  <input
                    type="text"
                    value={detailsModal.image.title}
                    onChange={(e) =>
                      setDetailsModal((prev) => ({ isOpen: true, image: { ...prev.image, title: e.target.value } }))
                    }
                    placeholder="לדוגמה: פעילות התנדבות"
                    style={{
                      ...inputStyle,
                      fontSize: "16px",
                      fontWeight: "bold",
                      backgroundColor: "#fff",
                      color: "#0f172a",
                      border: "1px solid #ced4da",
                    }}
                  />

                  {/* التعديل المعماري هنا: تنسيق جديد للقائمة المنسدلة لتبدو كشارة أنيقة ومصغرة */}
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      alignItems: "center",
                      color: "#6c757d",
                      fontSize: "14px",
                      marginTop: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <label
                        style={{
                          whiteSpace: "nowrap",
                          fontWeight: "600",
                          fontSize: "14px",
                          color: "#495057",
                          margin: 0,
                        }}
                      >
                        קטגוריה:
                      </label>
                      <select
                        className="modal-form-select"
                        value={detailsModal.image.category}
                        onChange={(e) =>
                          setDetailsModal((prev) => ({
                            isOpen: true,
                            image: {
                              ...prev.image,
                              category: e.target.value,
                            },
                          }))
                        }
                        style={{
                          ...inputStyle,
                          width: "auto",
                          minWidth: "140px",
                          backgroundColor: "#fdfbf7",
                          padding: "6px 12px",
                          paddingLeft: "35px",
                          borderRadius: "20px",
                          border: "1px solid #e2d8c9",
                          fontWeight: "600",
                          color: "#8b2c2c",
                          fontSize: "13.5px",
                          margin: 0,
                          cursor: "pointer",
                        }}
                      >
                        <option value="">בחר נושא</option>
                        {[
                          ...categories,
                          ...(detailsModal.image.category && !categories.includes(detailsModal.image.category)
                            ? [detailsModal.image.category]
                            : []),
                        ].map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span style={{ borderRight: "1px solid #ced4da", paddingRight: "16px" }}>
                      הועלה ב: {detailsModal.image.displayDate}
                    </span>
                  </div>
                </div>

                <div style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#495057",
                    }}
                  >
                    הערות ותיאור
                  </label>
                  <textarea
                    value={detailsModal.image.notes}
                    onChange={(e) =>
                      setDetailsModal((prev) => ({ isOpen: true, image: { ...prev.image, notes: e.target.value } }))
                    }
                    style={{
                      width: "100%",
                      flexGrow: 1,
                      minHeight: "150px",
                      padding: "16px",
                      borderRadius: "12px",
                      border: "1px solid #ced4da",
                      outline: "none",
                      resize: "none",
                      boxSizing: "border-box",
                      fontSize: "15px",
                      lineHeight: "1.6",
                      backgroundColor: "#fdfbf7",
                    }}
                    placeholder="הוסף הערות או תיאור לתמונה זו..."
                  ></textarea>

                  <div style={{ marginTop: "16px", padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div className="media-status-row">
                      <span className={`media-status-badge ${detailsModal.image.isPublic ? "media-status-public" : "media-status-private"}`}>
                        {detailsModal.image.isPublic ? "ציבורית" : "פרטית"}
                      </span>
                  {detailsModal.image.showInGallery && (
                    <span className="media-status-badge media-status-gallery">מוצגת בגלריה</span>
                  )}
                  {detailsModal.image.siteAsset && (
                    <span className="media-status-badge media-status-site-asset">תמונת אתר</span>
                  )}
                  {detailsModal.image.usageCount > 0 && (
                        <span className="media-status-badge media-status-site">
                          בשימוש באתר · {detailsModal.image.usageCount}
                        </span>
                      )}
                      {detailsModal.image.galleryVisibilityLegacy && (
                        <span className="media-status-badge media-status-legacy">מצב ישן — טרם הוסב</span>
                      )}
                    </div>
                    {detailsModal.image.usageCount > 0 && (
                      <ul className="media-usage-list">
                        {detailsModal.image.usageRefs.map((usage) => (
                          <li key={usage.key}>{usage.label || usage.field}</li>
                        ))}
                      </ul>
                    )}
                    <div className="media-card-actions">
                      <button
                        type="button"
                        className="media-action-button"
                        disabled={pendingImageIds.has(detailsModal.image.id)}
                        onClick={(e) => requestImageAction(
                          e,
                          detailsModal.image.isPublic ? "make-private" : "make-public",
                          detailsModal.image,
                        )}
                      >
                        {detailsModal.image.isPublic ? "הפוך לפרטית" : "הפוך לציבורית"}
                      </button>
                      <button
                        type="button"
                        className="media-action-button"
                        disabled={pendingImageIds.has(detailsModal.image.id)}
                        onClick={(e) => requestImageAction(
                          e,
                          detailsModal.image.showInGallery
                            ? "remove-gallery"
                            : (detailsModal.image.isPublic ? "add-gallery" : "publish-and-add-gallery"),
                          detailsModal.image,
                        )}
                      >
                        {detailsModal.image.showInGallery
                          ? "הסר מהגלריה"
                          : (detailsModal.image.isPublic ? "הוסף לגלריה" : "פרסם והוסף לגלריה")}
                      </button>
                      <button
                        type="button"
                        className="media-action-button"
                        disabled={pendingImageIds.has(detailsModal.image.id)}
                        onClick={(e) => requestImageAction(
                          e,
                          detailsModal.image.siteAsset ? "remove-site-asset" : "add-site-asset",
                          detailsModal.image,
                        )}
                      >
                        {detailsModal.image.siteAsset ? "הסר מתמונות האתר" : "הוסף לתמונות האתר"}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                  <button
                    onClick={handleUpdateImageDetails}
                    disabled={isUpdating}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "30px",
                      border: "none",
                      backgroundColor: "#8b2c2c",
                      color: "white",
                      cursor: isUpdating ? "not-allowed" : "pointer",
                      fontWeight: "600",
                      fontSize: "15px",
                      boxShadow: "0 4px 12px rgba(139,44,44,0.2)",
                      transition: "0.2s",
                    }}
                  >
                    {isUpdating ? "שומר שינויים..." : "שמור שינויים בפרטים"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {actionConfirm.isOpen && actionConfirm.image && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15,23,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5100,
            direction: "rtl",
            padding: 20,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="image-action-confirm-title"
            style={{
              backgroundColor: "#fff",
              padding: 28,
              borderRadius: 20,
              width: "100%",
              maxWidth: 440,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <h4 id="image-action-confirm-title" style={{ color: "#343a40", margin: "0 0 12px", fontSize: "1.2rem" }}>
              {IMAGE_ACTION_COPY[actionConfirm.type]?.title}
            </h4>
            <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.65, margin: "0 0 8px" }}>
              <strong>{actionConfirm.image.title}</strong>
            </p>
            <p style={{ color: "#64748b", fontSize: 14, lineHeight: 1.65, margin: "0 0 24px" }}>
              {IMAGE_ACTION_COPY[actionConfirm.type]?.message}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn"
                disabled={pendingImageIds.has(actionConfirm.image.id)}
                onClick={() => setActionConfirm({ isOpen: false, type: "", image: null })}
                style={{ flex: "1 1 140px" }}
              >
                ביטול
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={pendingImageIds.has(actionConfirm.image.id)}
                onClick={executeImageAction}
                style={{ flex: "1 1 180px" }}
              >
                {pendingImageIds.has(actionConfirm.image.id)
                  ? "מעדכן..."
                  : IMAGE_ACTION_COPY[actionConfirm.type]?.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Custom Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(15,23,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 5000,
            direction: "rtl",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "32px",
              borderRadius: "20px",
              textAlign: "center",
              width: "90%",
              maxWidth: "400px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                backgroundColor: "#fdecec",
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px auto",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc3545"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h4 style={{ color: "#343a40", fontWeight: "bold", margin: "0 0 12px 0", fontSize: "1.2rem" }}>
              מחיקת תמונה
            </h4>
            <p style={{ color: "#6c757d", fontSize: "14px", margin: "0 0 30px 0", lineHeight: "1.5" }}>
              האם אתה בטוח שברצונך למחוק את התמונה <strong>"{deleteConfirm.image?.title}"</strong>? לא ניתן יהיה לשחזר
              אותה לאחר מכן.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, image: null })}
                disabled={pendingImageIds.has(deleteConfirm.image?.id)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "30px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontWeight: "600",
                  color: "#475569",
                  transition: "all 0.2s",
                }}
              >
                ביטול
              </button>
              <button
                onClick={executeDelete}
                disabled={pendingImageIds.has(deleteConfirm.image?.id)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "30px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  boxShadow: "0 4px 12px rgba(220,53,69,0.2)",
                }}
              >
                {pendingImageIds.has(deleteConfirm.image?.id) ? "מוחק..." : "כן, מחק לחלוטין"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}
