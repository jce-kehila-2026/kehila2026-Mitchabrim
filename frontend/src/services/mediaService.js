// src/services/mediaService.js
import { db, storage } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// ============================================================
// FOLDERS CRUD
// ============================================================

// Get all folders
export const getFolders = async (parentId = null) => {
  try {
    const q = query(
      collection(db, "images"),
      where("parentId", "==", parentId || null),
      orderBy("name", "asc")
    );
    const snapshot = await getDocs(q);
    const folders = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.type === "folder") {
        folders.push({ id: doc.id, ...data });
      }
    });
    return folders;
  } catch (error) {
    console.error("Error fetching folders:", error);
    return [];
  }
};

// Get all folders (including subfolders)
export const getAllFolders = async () => {
  try {
    const snapshot = await getDocs(collection(db, "images"));
    const folders = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.type === "folder") {
        folders.push({ id: doc.id, ...data });
      }
    });
    return folders;
  } catch (error) {
    console.error("Error fetching all folders:", error);
    return [];
  }
};

// Get folder by ID
export const getFolderById = async (folderId) => {
  try {
    const docRef = doc(db, "images", folderId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching folder:", error);
    return null;
  }
};

// Create folder
export const createFolder = async (folderData) => {
  try {
    const newFolder = {
      ...folderData,
      type: "folder",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      uploadedAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, "images"), newFolder);
    return { id: docRef.id, ...newFolder };
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
};

// Update folder
export const updateFolder = async (folderId, updates) => {
  try {
    const docRef = doc(db, "images", folderId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { id: folderId, ...updates };
  } catch (error) {
    console.error("Error updating folder:", error);
    throw error;
  }
};

// Delete folder and all its contents
export const deleteFolder = async (folderId) => {
  try {
    // Get all items in this folder
    const q = query(collection(db, "images"), where("parentId", "==", folderId));
    const snapshot = await getDocs(q);
    
    // Delete all items in the folder
    const batch = writeBatch(db);
    snapshot.forEach((doc) => {
      const data = doc.data();
      // If it's an image, delete from storage
      if (data.type === "image" && data.url) {
        try {
          const imageRef = ref(storage, data.url);
          deleteObject(imageRef).catch(() => {});
        } catch (e) {}
      }
      batch.delete(doc.ref);
    });
    
    // Delete the folder itself
    const folderRef = doc(db, "images", folderId);
    batch.delete(folderRef);
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error deleting folder:", error);
    throw error;
  }
};

// ============================================================
// IMAGES CRUD
// ============================================================

// Get images by folder
export const getImagesByFolder = async (folderId = null) => {
  try {
    const q = query(
      collection(db, "images"),
      where("type", "==", "image"),
      where("parentId", "==", folderId || null),
      orderBy("uploadedAt", "desc")
    );
    const snapshot = await getDocs(q);
    const images = [];
    snapshot.forEach((doc) => {
      images.push({ id: doc.id, ...doc.data() });
    });
    return images;
  } catch (error) {
    console.error("Error fetching images:", error);
    return [];
  }
};

// Get all images (for search)
export const getAllImages = async () => {
  try {
    const q = query(collection(db, "images"), where("type", "==", "image"));
    const snapshot = await getDocs(q);
    const images = [];
    snapshot.forEach((doc) => {
      images.push({ id: doc.id, ...doc.data() });
    });
    return images;
  } catch (error) {
    console.error("Error fetching all images:", error);
    return [];
  }
};

// Get image by ID
export const getImageById = async (imageId) => {
  try {
    const docRef = doc(db, "images", imageId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
};

// Upload image
export const uploadImage = async (file, imageData) => {
  try {
    // Upload to Storage
    const storageRef = ref(storage, `images/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    // Save to Firestore
    const newImage = {
      ...imageData,
      url: url,
      type: "image",
      uploadedAt: serverTimestamp(),
      displayDate: new Date().toLocaleDateString("he-IL"),
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "images"), newImage);
    return { id: docRef.id, ...newImage, url };
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
};

// Update image
export const updateImage = async (imageId, updates) => {
  try {
    const docRef = doc(db, "images", imageId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { id: imageId, ...updates };
  } catch (error) {
    console.error("Error updating image:", error);
    throw error;
  }
};

// Delete image
export const deleteImage = async (imageId, imageUrl) => {
  try {
    // Delete from Storage
    if (imageUrl) {
      try {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
      } catch (e) {
        console.warn("Could not delete from storage:", e);
      }
    }
    
    // Delete from Firestore
    await deleteDoc(doc(db, "images", imageId));
    return true;
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

// Toggle public status
export const toggleImagePublic = async (imageId, isPublic) => {
  try {
    const docRef = doc(db, "images", imageId);
    await updateDoc(docRef, {
      isPublic: isPublic,
      updatedAt: serverTimestamp(),
    });
    return { id: imageId, isPublic };
  } catch (error) {
    console.error("Error toggling image public status:", error);
    throw error;
  }
};

// Move image to folder
export const moveImage = async (imageId, targetFolderId) => {
  try {
    const docRef = doc(db, "images", imageId);
    await updateDoc(docRef, {
      parentId: targetFolderId || null,
      updatedAt: serverTimestamp(),
    });
    return { id: imageId, parentId: targetFolderId || null };
  } catch (error) {
    console.error("Error moving image:", error);
    throw error;
  }
};

// ============================================================
// SEARCH
// ============================================================

export const searchMedia = async (queryText, filters = {}) => {
  try {
    const allImages = await getAllImages();
    const allFolders = await getAllFolders();
    const allItems = [...allImages, ...allFolders];

    let results = allItems.filter((item) => {
      // Search by name
      const nameMatch = item.name?.toLowerCase().includes(queryText.toLowerCase()) ||
                        item.title?.toLowerCase().includes(queryText.toLowerCase());

      // Search by path
      const pathMatch = item.path?.toLowerCase().includes(queryText.toLowerCase());

      // Search by notes
      const notesMatch = item.notes?.toLowerCase().includes(queryText.toLowerCase());

      let match = nameMatch || pathMatch || notesMatch;

      // Filter by type
      if (filters.type && filters.type !== "all") {
        match = match && item.type === filters.type;
      }

      // Filter by date (if dateFrom and dateTo)
      if (filters.dateFrom && item.displayDate) {
        const itemDate = new Date(item.displayDate.split(".").reverse().join("-"));
        const fromDate = new Date(filters.dateFrom);
        match = match && itemDate >= fromDate;
      }
      if (filters.dateTo && item.displayDate) {
        const itemDate = new Date(item.displayDate.split(".").reverse().join("-"));
        const toDate = new Date(filters.dateTo);
        match = match && itemDate <= toDate;
      }

      // Filter by folder
      if (filters.folderId && filters.folderId !== "all") {
        match = match && item.parentId === filters.folderId;
      }

      return match;
    });

    // Sort results
    results.sort((a, b) => {
      const dateA = a.uploadedAt?.seconds || 0;
      const dateB = b.uploadedAt?.seconds || 0;
      return dateB - dateA;
    });

    return results;
  } catch (error) {
    console.error("Error searching media:", error);
    return [];
  }
};

// ============================================================
// MIGRATION - Convert old images to new format
// ============================================================

export const migrateOldImages = async () => {
  try {
    // Get all images without type field (old format)
    const q = query(collection(db, "images"), where("type", "!=", "folder"));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    let count = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Skip if already migrated (has type field)
      if (data.type === "image") return;

      // Update with new fields
      batch.update(doc.ref, {
        type: "image",
        parentId: null,
        path: "/",
        isPublic: true,
        folderName: data.category || "",
        originalCategory: data.category || "",
        migratedAt: serverTimestamp(),
      });
      count++;
    });

    if (count > 0) {
      await batch.commit();
    }
    return { success: true, count };
  } catch (error) {
    console.error("Error migrating images:", error);
    return { success: false, error: error.message };
  }
};

// Create default folders from categories
export const createDefaultFolders = async () => {
  const categories = ["פרלמנטים", "מתנדבים", "חגים", "שיווק", "כרטיסי ברכה"];
  const created = [];

  try {
    for (const category of categories) {
      // Check if folder already exists
      const q = query(
        collection(db, "images"),
        where("name", "==", category),
        where("type", "==", "folder"),
        where("parentId", "==", null)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Create folder
        const folder = {
          name: category,
          type: "folder",
          parentId: null,
          path: `/${category}`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          uploadedAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, "images"), folder);
        created.push({ id: docRef.id, ...folder });
      }
    }
    return created;
  } catch (error) {
    console.error("Error creating default folders:", error);
    return [];
  }
};