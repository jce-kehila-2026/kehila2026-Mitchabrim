import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function createJoinRequest(data) {
  const requestData = {
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    requestType: data.requestType,
    reason: data.reason,
    status: "new",
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "joinRequests"), requestData);
  return docRef.id;
}