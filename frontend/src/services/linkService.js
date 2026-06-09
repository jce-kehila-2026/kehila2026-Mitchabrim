// src/services/linkService.js
import { db } from "../firebase";
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy 
} from "firebase/firestore";

const COLLECTION_NAME = "links";

export const getAllLinks = async () => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching links:", error);
    throw error;
  }
};

export const addLink = async (linkData) => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...linkData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { id: docRef.id, ...linkData };
  } catch (error) {
    console.error("Error adding link:", error);
    throw error;
  }
};

export const updateLink = async (id, linkData) => {
  try {
    const linkRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(linkRef, {
      ...linkData,
      updatedAt: new Date(),
    });
    return { id, ...linkData };
  } catch (error) {
    console.error("Error updating link:", error);
    throw error;
  }
};

export const deleteLink = async (id) => {
  try {
    const linkRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(linkRef);
    return id;
  } catch (error) {
    console.error("Error deleting link:", error);
    throw error;
  }
};

export const formatDate = (timestamp) => {
  if (!timestamp) return "";
  if (timestamp.seconds) {
    return new Date(timestamp.seconds * 1000).toLocaleDateString("he-IL");
  }
  if (timestamp.toDate) {
    return timestamp.toDate().toLocaleDateString("he-IL");
  }
  return new Date(timestamp).toLocaleDateString("he-IL");
};

export const normalizeUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return "https://" + url;
};