import { useEffect, useState } from "react";
import { EllipsisVertical, Search } from "lucide-react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";

// Firebase imports
import { auth } from "../firebase";

// Services
import {
  listAllowedUsers,
  inviteUser,
  updateAllowedUser,
  deleteAllowedUser,
  sendPasswordSetupEmail,
} from "@/services/allowedUsersService";
import { getVolunteers } from "@/services/volunteersService";
import {
  backupStatusErrorMessage,
  getBackupStatus,
  getSettingsGeneral,
  locationSettingsErrorMessage,
  saveSettingsGeneral,
  updateLocationSettings,
} from "@/services/settingsService";
import {
  isProtectedCategory,
  normalizeCategoryGroups,
} from "@/utils/categorySettings";
import {
  locationNameKey,
  normalizeLocationName,
  updateAreasModel,
} from "@/utils/elderlyFormModel";
import { createSubmissionGuard } from "@/utils/submissionGuard";

const ROLE_LABEL = { admin: "מנהל", volunteer: "מתנדב" };

// --- Golden Feature: Auto Sorting Helpers ---
const sortAreas = (areasArray) => {
  return [...areasArray]
    .sort((a, b) => a.area.localeCompare(b.area, 'he'))
    .map(a => ({ ...a, neighborhoods: [...a.neighborhoods].sort((n1, n2) => n1.localeCompare(n2, 'he')) }));
};

const sortCategories = (catsArray) => {
  return [...catsArray]
    .sort((a, b) => a.title.localeCompare(b.title, 'he'))
    .map(c => ({ ...c, items: [...c.items].sort((i1, i2) => i1.localeCompare(i2, 'he')) }));
};

const formatBackupDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(date);
};

const backupStateLabel = (state) => ({
  READY: "מוכן",
  CREATING: "בתהליך",
  NOT_AVAILABLE: "לא זמין",
}[state] || state || "—");

function LocationMenuButton({
  menuKey,
  openKey,
  setOpenKey,
  actions,
  compact = false,
}) {
  const isOpen = openKey === menuKey;
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label="אפשרויות"
        aria-expanded={isOpen}
        onClick={() => setOpenKey(isOpen ? "" : menuKey)}
        style={{
          width: compact ? 22 : 28,
          height: compact ? 22 : 28,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: "50%",
          background: isOpen ? "#f3e7df" : "transparent",
          color: "#7b312d",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <EllipsisVertical size={compact ? 14 : 17} />
      </button>
      {isOpen && (
        <span
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 5px)",
            left: 0,
            zIndex: 30,
            minWidth: 112,
            padding: 5,
            background: "#fff",
            border: "1px solid #e2d8c9",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(44, 31, 24, 0.14)",
          }}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpenKey("");
                action.onClick();
              }}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 10px",
                border: 0,
                borderRadius: 7,
                background: "transparent",
                color: action.danger ? "#c0392b" : "#493c35",
                textAlign: "right",
                fontFamily: "inherit",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {action.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

export default function Settings() {
  // ==========================================
  // STATE: 1. Organization Details
  // ==========================================
  const [orgName, setOrgName] = useState("");
  const [address, setAddress] = useState("");
  const [emails, setEmails] = useState([""]); 
  const [phones, setPhones] = useState([""]); 
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // ==========================================
  // STATE: 2. System Users
  // ==========================================
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [activeTab, setActiveTab] = useState("admin"); 
  const [userForm, setUserForm] = useState({ displayName: "", email: "", linkedVolunteerId: "" });
  const [allVolunteers, setAllVolunteers] = useState([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [resendingId, setResendingId] = useState("");
  const [userSearchTerm, setUserSearchTerm] = useState(""); // Search Feature State

  // ==========================================
  // STATE: 3. Areas & Neighborhoods
  // ==========================================
  const [areas, setAreas] = useState([]);
  const [newAreaName, setNewAreaName] = useState("");
  const [newNeighborhoodInputs, setNewNeighborhoodInputs] = useState({});
  const [editAreaInputs, setEditAreaInputs] = useState({});
  const [editNeighborhoodInputs, setEditNeighborhoodInputs] = useState({});
  const [openLocationMenu, setOpenLocationMenu] = useState("");
  const [editingLocation, setEditingLocation] = useState("");
  const [movingNeighborhood, setMovingNeighborhood] = useState("");

  // ==========================================
  // STATE: 4. Categories (Now fully dynamic)
  // ==========================================
  const [categories, setCategories] = useState(() => (
    sortCategories(normalizeCategoryGroups(undefined))
  ));
  const [newCategoryGroupName, setNewCategoryGroupName] = useState("");
  const [newCategoryInputs, setNewCategoryInputs] = useState({});

  // ==========================================
  // STATE: 5. UI / Modals / Toasts
  // ==========================================
  const [toastMessage, setToastMessage] = useState("");
  const [roleConfirm, setRoleConfirm] = useState({ isOpen: false, user: null, newRole: "" });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, user: null });
  const [statusConfirm, setStatusConfirm] = useState({ isOpen: false, user: null });
  const [passwordConfirm, setPasswordConfirm] = useState({ isOpen: false, user: null });
  const [genericConfirm, setGenericConfirm] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "כן, המשך",
    onConfirm: null,
  });
  const [isLocationChangePending, setIsLocationChangePending] = useState(false);
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupLoadState, setBackupLoadState] = useState("loading");
  const [backupError, setBackupError] = useState("");

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const refreshBackupStatus = async () => {
    setBackupLoadState("loading");
    setBackupError("");
    try {
      const status = await getBackupStatus();
      setBackupStatus(status);
      setBackupLoadState(status?.available && status?.enabled ? "success" : "unavailable");
    } catch (error) {
      console.error("Backup status load failed", {
        code: error?.code || "unknown",
        message: error?.message || "Unknown backup status error",
      });
      setBackupStatus(null);
      const code = String(error?.code || "");
      setBackupLoadState(code.includes("not-found") ? "unavailable" : "failure");
      setBackupError(backupStatusErrorMessage(error));
    }
  };

  // ==========================================
  // FETCH DATA
  // ==========================================
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await getSettingsGeneral();
        if (data) {
          setOrgName(data?.orgName || "");
          setAddress(data?.address || "");
          
          const dbEmails = data?.emails;
          setEmails(Array.isArray(dbEmails) && dbEmails.length > 0 ? dbEmails : [""]);
          
          const dbPhones = data?.phones;
          setPhones(Array.isArray(dbPhones) && dbPhones.length > 0 ? dbPhones : [""]);
          
          const dbAreas = data?.areas;
          const loadedAreas = Array.isArray(dbAreas) ? dbAreas : [
            { area: "מרכז ירושלים", neighborhoods: ["רחביה", "טלביה", "ימין משה"] },
            { area: "דרום העיר", neighborhoods: ["גילה", "עיר גנים", "קטמון"] },
            { area: "מערב העיר", neighborhoods: ["בית הכרם", "רוממה", "קריית משה"] }
          ];
          setAreas(sortAreas(loadedAreas));

          setCategories(sortCategories(normalizeCategoryGroups(data?.categories)));

        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await listAllowedUsers();
        if (res?.success && Array.isArray(res?.users)) {
          setUsers(res.users);
        } else {
          showToast(res?.error || "שגיאה בטעינת משתמשים");
        }
      } catch (error) {
        showToast("שגיאת תקשורת בטעינת המשתמשים");
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchSettings();
    fetchUsers();
    refreshBackupStatus();
  }, []);

  const refreshUsers = async () => {
    try {
      const res = await listAllowedUsers();
      if (res?.success && Array.isArray(res?.users)) setUsers(res.users);
    } catch (error) {
      console.error("Failed to refresh users", error);
    }
  };

  const refreshVolunteers = async () => {
    try {
      const list = await getVolunteers();
      setAllVolunteers(list || []);
    } catch (err) {
      console.error("Failed to load volunteers", err);
    }
  };

  useEffect(() => { refreshVolunteers(); }, []);

  // ==========================================
  // LOGIC: Save Global Configuration
  // ==========================================
  const saveGlobalConfig = async (updatedAreas, updatedCategories) => {
    try {
      await saveSettingsGeneral({
        areas: updatedAreas || areas,
        categories: normalizeCategoryGroups(updatedCategories || categories)
      });
      showToast("השינויים נשמרו בהצלחה!");
    } catch (error) {
      showToast("שגיאה בשמירת הנתונים.");
    }
  };

  // ==========================================
  // LOGIC: Areas & Neighborhoods
  // ==========================================
  const handleAddArea = (e) => {
    e.preventDefault();
    if (!newAreaName?.trim()) return;
    const normalized = normalizeLocationName(newAreaName);
    if (areas.some((area) => locationNameKey(area.area) === locationNameKey(normalized))) {
      showToast("שם האזור כבר קיים");
      return;
    }
    const updatedAreas = sortAreas([...areas, { area: normalized, neighborhoods: [] }]);
    setAreas(updatedAreas);
    setNewAreaName("");
    saveGlobalConfig(updatedAreas, null);
  };

  const handleAddNeighborhood = (e, areaIndex) => {
    e.preventDefault();
    const nbName = newNeighborhoodInputs[areaIndex];
    if (!nbName || !nbName.trim()) return;
    
    const updatedAreas = [...areas];
    const targetArea = { ...updatedAreas[areaIndex] };
    
    const normalized = normalizeLocationName(nbName);
    const exists = areas.some((area) => area.neighborhoods.some(
      (name) => locationNameKey(name) === locationNameKey(normalized),
    ));
    if (!exists) {
      targetArea.neighborhoods = [...targetArea.neighborhoods, normalized];
      updatedAreas[areaIndex] = targetArea;
      const sortedAreas = sortAreas(updatedAreas);
      setAreas(sortedAreas);
      saveGlobalConfig(sortedAreas, null);
    } else showToast("שם השכונה כבר קיים");
    setNewNeighborhoodInputs({ ...newNeighborhoodInputs, [areaIndex]: "" });
  };

  const requestLocationChange = (change, title, message) => {
    let preview;
    try {
      preview = updateAreasModel(areas, change);
    } catch (error) {
      showToast(error.message);
      return;
    }
    const submissionGuard = createSubmissionGuard();
    setGenericConfirm({
      isOpen: true,
      title,
      message,
      confirmLabel: "כן, המשך",
      onConfirm: async () => {
        if (!submissionGuard.tryAcquire()) return;
        setIsLocationChangePending(true);
        try {
          const result = await updateLocationSettings(change);
          setAreas(sortAreas(result?.areas || preview));
          setEditAreaInputs({});
          setEditNeighborhoodInputs({});
          setEditingLocation("");
          setMovingNeighborhood("");
          setOpenLocationMenu("");
          showToast(`השינוי נשמר ועודכנו ${result?.updatedReferences || 0} הפניות`);
        } catch (error) {
          console.error("Location update failed", {
            code: error?.code || "unknown",
            message: error?.message || "Unknown location update error",
            details: error?.details || null,
          });
          showToast(locationSettingsErrorMessage(error));
        } finally {
          setIsLocationChangePending(false);
          setGenericConfirm({ isOpen: false });
        }
      },
    });
  };

  const requestRenameArea = (area) => {
    const newArea = normalizeLocationName(editAreaInputs[area.area]);
    requestLocationChange(
      { type: "renameArea", oldArea: area.area, newArea },
      "שינוי שם אזור",
      `שינוי שם האזור יעדכן גם רשומות המקושרות ל"${area.area}". להמשיך?`,
    );
  };

  const requestRenameNeighborhood = (area, neighborhood) => {
    const inputKey = `${area.area}::${neighborhood}`;
    const newNeighborhood = normalizeLocationName(editNeighborhoodInputs[inputKey]);
    requestLocationChange(
      { type: "renameNeighborhood", oldArea: area.area, oldNeighborhood: neighborhood, newNeighborhood },
      "שינוי שם שכונה",
      `שינוי שם השכונה יעדכן גם רשומות המקושרות ל"${neighborhood}". להמשיך?`,
    );
  };

  const requestMoveNeighborhood = (area, neighborhood, targetArea) => {
    requestLocationChange(
      { type: "moveNeighborhood", oldArea: area.area, oldNeighborhood: neighborhood, targetArea },
      "העברת שכונה",
      `העברת "${neighborhood}" אל "${targetArea}" תעדכן את האזור בכל הרשומות המקושרות. להמשיך?`,
    );
  };

  const requestDeleteArea = (areaIndex) => {
    const area = areas[areaIndex];
    if (!area) return;
    requestLocationChange(
      { type: "deleteArea", oldArea: area.area },
      "מחיקת אזור",
      `מחיקת "${area.area}" תתאפשר רק אם אין רשומות המקושרות לאזור או לשכונותיו. להמשיך?`,
    );
  };

  const requestDeleteNeighborhood = (areaIndex, nbIndex) => {
    const area = areas[areaIndex];
    const neighborhood = area?.neighborhoods[nbIndex];
    if (!area || !neighborhood) return;
    requestLocationChange(
      { type: "deleteNeighborhood", oldArea: area.area, oldNeighborhood: neighborhood },
      "מחיקת שכונה",
      `מחיקת "${neighborhood}" תתאפשר רק אם אין רשומות המקושרות לשכונה. להמשיך?`,
    );
  };

  // ==========================================
  // LOGIC: Categories (Fully Dynamic Now)
  // ==========================================
  const handleAddCategoryGroup = (e) => {
    e.preventDefault();
    if (!newCategoryGroupName?.trim()) return;
    const updatedCats = sortCategories([...categories, { title: newCategoryGroupName.trim(), items: [] }]);
    setCategories(updatedCats);
    setNewCategoryGroupName("");
    saveGlobalConfig(null, updatedCats);
  };

  const handleAddCategoryItem = (e, groupIndex) => {
    e.preventDefault();
    const itemName = newCategoryInputs[groupIndex];
    if (!itemName || !itemName.trim()) return;
    
    const updatedCats = [...categories];
    const targetGroup = { ...updatedCats[groupIndex] };
    
    if (!targetGroup.items.includes(itemName.trim())) {
      targetGroup.items = [...targetGroup.items, itemName.trim()];
      updatedCats[groupIndex] = targetGroup;
      const sortedCats = sortCategories(updatedCats);
      setCategories(sortedCats);
      saveGlobalConfig(null, sortedCats);
    }
    setNewCategoryInputs({ ...newCategoryInputs, [groupIndex]: "" });
  };

  const requestDeleteCategoryGroup = (groupIndex) => {
    setGenericConfirm({
      isOpen: true,
      title: "מחיקת קבוצת קטגוריות",
      message: `האם אתה בטוח שברצונך למחוק את הקבוצה "${categories[groupIndex]?.title}" וכל הקטגוריות שבה?`,
      confirmLabel: "כן, למחוק",
      onConfirm: () => {
        const updatedCats = categories.filter((_, i) => i !== groupIndex);
        setCategories(updatedCats);
        saveGlobalConfig(null, updatedCats);
        setGenericConfirm({ isOpen: false });
      }
    });
  };

  const requestDeleteCategoryItem = (groupIndex, itemIndex) => {
    const itemName = categories[groupIndex]?.items[itemIndex];
    if (isProtectedCategory(categories[groupIndex]?.title, itemName)) {
      showToast("לא ניתן למחוק את קטגוריית תמונות אתר פרסומי");
      return;
    }
    setGenericConfirm({
      isOpen: true,
      title: "מחיקת קטגוריה",
      message: `האם אתה בטוח שברצונך למחוק את הקטגוריה "${itemName}"?`,
      confirmLabel: "כן, למחוק",
      onConfirm: () => {
        const updatedCats = [...categories];
        const targetGroup = { ...updatedCats[groupIndex] };
        targetGroup.items = targetGroup.items.filter((_, j) => j !== itemIndex);
        updatedCats[groupIndex] = targetGroup;
        setCategories(updatedCats);
        saveGlobalConfig(null, updatedCats);
        setGenericConfirm({ isOpen: false });
      }
    });
  };

  // ==========================================
  // LOGIC: Users & Org
  // ==========================================
  const handleArrayChange = (index, value, type) => {
    if (type === "email") {
      const newEmails = [...emails]; newEmails[index] = value; setEmails(newEmails);
    } else {
      const newPhones = [...phones]; newPhones[index] = value; setPhones(newPhones);
    }
  };

  const handleAddField = (type) => {
    if (type === "email") setEmails([...emails, ""]);
    if (type === "phone") setPhones([...phones, ""]);
  };

  const handleRemoveField = (index, type) => {
    if (type === "email") {
      if (emails.length === 1) return;
      setEmails(emails.filter((_, i) => i !== index));
    } else {
      if (phones.length === 1) return;
      setPhones(phones.filter((_, i) => i !== index));
    }
  };

  const handleSaveOrganizationDetails = async () => {
    setIsSavingOrg(true);
    try {
      const cleanEmails = emails.filter(e => e?.trim() !== "");
      const cleanPhones = phones.filter(p => p?.trim() !== "");
      await saveSettingsGeneral({
        orgName: orgName?.trim() || "", 
        address: address?.trim() || "", 
        emails: cleanEmails, 
        phones: cleanPhones
      });
      if (cleanEmails.length > 0) setEmails(cleanEmails);
      if (cleanPhones.length > 0) setPhones(cleanPhones);
      showToast("פרטי הארגון נשמרו בהצלחה!");
    } catch (error) {
      showToast("שגיאה בשמירת פרטי הארגון.");
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const emailVal = userForm?.email?.trim();

    if (!emailVal) {
      showToast("יש למלא אימייל");
      return;
    }

    // Email Regex Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
      showToast("נא להזין כתובת אימייל תקינה");
      return;
    }

    if (activeTab === "volunteer" && !userForm?.linkedVolunteerId) {
      showToast("יש לבחור פרופיל מתנדב לקישור החשבון");
      return;
    }

    // Derive displayName: from linked volunteer for volunteers, or email prefix for admins
    let displayName = userForm?.displayName?.trim() || "";
    if (activeTab === "volunteer" && userForm?.linkedVolunteerId) {
      const linkedVol = allVolunteers.find((v) => v.id === userForm.linkedVolunteerId);
      displayName =
        linkedVol?.name ||
        linkedVol?.fullName ||
        [linkedVol?.firstName, linkedVol?.lastName].filter(Boolean).join(" ").trim() ||
        displayName;
    }
    if (!displayName) {
      displayName = emailVal.split("@")[0];
    }

    setIsAddingUser(true);
    try {
      const res = await inviteUser({
        displayName,
        email: emailVal,
        role: activeTab,
        active: true,
        linkedVolunteerId: activeTab === "volunteer" ? userForm.linkedVolunteerId : null,
      });
      if (!res?.success) {
        showToast(res?.error || "שגיאה בהוספת המשתמש");
        return;
      }
      showToast(`ה${ROLE_LABEL[activeTab]} נוסף בהצלחה ונשלחה הודעה!`);
      setUserForm({ displayName: "", email: "", linkedVolunteerId: "" });
      await refreshUsers();
      await refreshVolunteers();
    } catch (error) {
      showToast("אירעה שגיאה חמורה בעת הוספת משתמש");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleStatusClick = (u) => {
    if (!u) return; 
    const loggedInEmail = auth?.currentUser?.email || "omaraqel253@gmail.com"; 
    if (u?.email === loggedInEmail && u?.status === "active") {
      showToast("אינך יכול להשבית את עצמך מהמערכת!");
      return;
    }
    setStatusConfirm({ isOpen: true, user: u });
  };

  const executeToggleStatus = async () => {
    try {
      const { user } = statusConfirm;
      if (!user?.id) throw new Error("Missing user ID");
      const result = await updateAllowedUser(user.id, {
        status: user.status === "active" ? "inactive" : "active",
      });
      if (!result?.success) throw new Error(result?.error || "Status update failed");
      showToast(`סטטוס המשתמש עודכן בהצלחה`);
      await refreshUsers();
    } catch (error) {
      showToast("שגיאה בעדכון סטטוס המשתמש");
    } finally {
      setStatusConfirm({ isOpen: false, user: null });
    }
  };

  const handleRoleDropdownChange = (u, newRole) => {
    if (!u || u.role === newRole) return;
    setRoleConfirm({ isOpen: true, user: u, newRole });
  };

  const executeRoleChange = async () => {
    try {
      const { user, newRole } = roleConfirm;
      if (!user?.id) throw new Error("Missing user ID");
      await updateAllowedUser(user.id, { role: newRole });
      showToast(`תפקיד המשתמש שונה בהצלחה`);
      await refreshUsers();
    } catch (error) {
      showToast("שגיאה בעדכון תפקיד המשתמש");
    } finally {
      setRoleConfirm({ isOpen: false, user: null, newRole: "" });
    }
  };

  const handlePasswordClick = (u) => {
    if (!u) return;
    setPasswordConfirm({ isOpen: true, user: u });
  };

  const executeResendPassword = async () => {
    try {
      const { user } = passwordConfirm;
      if (!user?.id) return;
      setResendingId(user.id);
      const res = await sendPasswordSetupEmail(user.email);
      if (res?.success) showToast(res.message);
      else showToast(res?.error || "שגיאה בשליחת הקישור");
    } catch (error) {
       showToast("שגיאת שרת בשליחת הקישור");
    } finally {
      setResendingId("");
      setPasswordConfirm({ isOpen: false, user: null });
    }
  };

  const handleDeleteClick = (u) => {
    if (!u) return;
    setDeleteConfirm({ isOpen: true, user: u });
  };

  const executeDeleteUser = async () => {
    try {
      const { user } = deleteConfirm;
      if (!user?.id) throw new Error("Missing user ID");
      const result = await deleteAllowedUser(user.id, user.linkedVolunteerId || null);
      if (!result?.success) throw new Error(result?.error || "User deletion failed");
      showToast("המשתמש נמחק בהצלחה");
      await refreshUsers();
    } catch (error) {
      showToast("שגיאה במחיקת המשתמש");
    } finally {
      setDeleteConfirm({ isOpen: false, user: null });
    }
  };

  // Safe Users Search & Filter
  const safeUsers = Array.isArray(users) ? users : [];
  const displayedUsers = safeUsers.filter((u) => {
    if (!u) return false; 
    const matchesTab = activeTab === "admin" ? u.role === "admin" : (u.role === "volunteer" || !u.role);
    const matchesSearch = (u.displayName || "").toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                          (u.email || "").toLowerCase().includes(userSearchTerm.toLowerCase());
    return matchesTab && matchesSearch; 
  });

  // ==========================================
  // STYLES 
  // ==========================================
  const inputStyle = { width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ced4da", outline: "none", fontFamily: "inherit", direction: "rtl", fontSize: "14px", textDecoration: "none" };
  const labelStyle = { display: "block", marginBottom: "6px", fontWeight: "bold", fontSize: "14px", color: "#8b2c2c" };
  
  const getActionBtnStyle = (textColor, bgColor, borderColor) => ({
    padding: "6px 12px", borderRadius: "6px", border: `1px solid ${borderColor}`, backgroundColor: bgColor, color: textColor, fontSize: "12px", fontWeight: "bold", cursor: "pointer", transition: "0.2s"
  });

  const compactCardStyle = { backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e9ecef", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", overflow: "hidden" };
  const compactCardHeaderStyle = { backgroundColor: "#fcfaf8", padding: "12px 16px", borderBottom: "1px solid #f0e6d3", display: "flex", justifyContent: "space-between", alignItems: "center" };
  const compactPillStyle = { backgroundColor: "#fff", color: "#495057", border: "1px solid #e2d8c9", borderRadius: "20px", padding: "4px 12px", display: "inline-flex", gap: "6px", alignItems: "center", fontSize: "13px", fontWeight: "600" };
  
  const addPillFormStyle = { backgroundColor: "#fff", border: "1px dashed #ced4da", borderRadius: "20px", padding: "4px 6px 4px 12px", display: "inline-flex", alignItems: "center", gap: "8px" };
  const addPillInputStyle = { background: "transparent", border: "none", outline: "none", width: "80px", fontSize: "12.5px", color: "#495057", fontFamily: "inherit" };
  const addPillBtnStyle = { backgroundColor: "#8b2c2c", color: "white", border: "none", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "16px", fontWeight: "bold", padding: 0 };
  const textBtnDangerStyle = { background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: "12px", fontWeight: "bold", padding: 0 };

  const safeEmails = Array.isArray(emails) ? emails : [""];
  const safePhones = Array.isArray(phones) ? phones : [""];

  return (
    <AdminPageLayout heroImage="/admin-heroes/setting_hero.webp" title="הגדרות" subtitle="ניהול הגדרות מערכת, אזורים, שכונות והרשאות">
      
      {toastMessage && (
        <div className="admin-toast">
          <span className="admin-toast-check">✓</span> {toastMessage}
        </div>
      )}

      {/* --- Section 1: Organization Details --- */}
      <SectionCard>
        <h3 className="settings-section-title">פרטי הארגון</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", direction: "rtl" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div><label style={labelStyle}>שם הארגון</label><input type="text" value={orgName || ""} onChange={(e) => setOrgName(e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>כתובת</label><input type="text" value={address || ""} onChange={(e) => setAddress(e.target.value)} style={inputStyle} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
            <div>
              <label style={labelStyle}>טלפון</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {safePhones.map((phone, index) => (
                  <div key={`phone-${index}`} style={{ display: "flex", gap: "8px" }}>
                    <input type="text" value={phone || ""} onChange={(e) => handleArrayChange(index, e.target.value, "phone")} style={inputStyle} dir="ltr" placeholder="02-0000000" />
                    {safePhones.length > 1 && (<button type="button" onClick={() => handleRemoveField(index, "phone")} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>✕</button>)}
                  </div>
                ))}
                <button type="button" onClick={() => handleAddField("phone")} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#6c757d", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>+ הוסף טלפון</button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>אימייל</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {safeEmails.map((email, index) => (
                  <div key={`email-${index}`} style={{ display: "flex", gap: "8px" }}>
                    <input type="email" value={email || ""} onChange={(e) => handleArrayChange(index, e.target.value, "email")} style={inputStyle} dir="ltr" placeholder="info@mitchabrim.org" />
                    {safeEmails.length > 1 && (<button type="button" onClick={() => handleRemoveField(index, "email")} style={{ background: "none", border: "none", color: "#dc3545", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>✕</button>)}
                  </div>
                ))}
                <button type="button" onClick={() => handleAddField("email")} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#6c757d", cursor: "pointer", fontSize: "13px", fontWeight: "bold" }}>+ הוסף אימייל</button>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
            <button className="btn btn-primary" style={{ padding: "10px 30px", borderRadius: "8px", backgroundColor: "#8b2c2c", color: "white", border: "none", fontWeight: "bold", cursor: isSavingOrg ? "not-allowed" : "pointer", opacity: isSavingOrg ? 0.7 : 1 }} onClick={handleSaveOrganizationDetails} disabled={isSavingOrg}>
              {isSavingOrg ? "שומר..." : "שמירה"}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* --- Section 2: System Users --- */}
      <SectionCard>
        <div style={{ direction: "rtl" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: "2px solid #f6ecdc", paddingBottom: "15px" }}>
            <h3 style={{ margin: 0, color: "#8b2c2c", fontWeight: "bold", fontSize: "1.2rem" }}>משתמשי מערכת</h3>
            
            {/* The Golden Feature: Search Bar */}
            <div style={{ position: "relative", width: "250px" }}>
               <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#adb5bd", display: "flex", alignItems: "center" }}><Search size={16} /></span>
               <input type="text" placeholder="חיפוש משתמש..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} style={{ ...inputStyle, padding: "8px 35px 8px 12px", borderRadius: "20px", border: "1px solid #ced4da" }} />
            </div>
          </div>
          
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "30px" }}>
            <div style={{ display: "flex", backgroundColor: "#f8f9fa", borderRadius: "8px", border: "1px solid #ced4da", overflow: "hidden" }}>
              <button onClick={() => setActiveTab("admin")} style={{ padding: "10px 30px", fontSize: "15px", fontWeight: "bold", border: "none", cursor: "pointer", transition: "all 0.2s", backgroundColor: activeTab === "admin" ? "#8b2c2c" : "transparent", color: activeTab === "admin" ? "white" : "#495057" }}>מנהלים</button>
              <div style={{ width: "1px", backgroundColor: "#ced4da" }}></div>
              <button onClick={() => setActiveTab("volunteer")} style={{ padding: "10px 30px", fontSize: "15px", fontWeight: "bold", border: "none", cursor: "pointer", transition: "all 0.2s", backgroundColor: activeTab === "volunteer" ? "#8b2c2c" : "transparent", color: activeTab === "volunteer" ? "white" : "#495057" }}>מתנדבים</button>
            </div>
          </div>

          <div style={{ backgroundColor: "#faf8f5", padding: "20px", borderRadius: "12px", border: "1px solid #e9ecef", marginBottom: "30px" }}>
            <form onSubmit={handleAddUser} style={{ display: "flex", gap: "15px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={labelStyle}>אימייל</label>
                <input className="input" type="email" dir="ltr" style={inputStyle} value={userForm?.email || ""} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="user@example.com" />
              </div>
              {activeTab === "volunteer" && (
                <div style={{ flex: "1 1 100%", minWidth: "200px" }}>
                  <label style={labelStyle}>קישור לפרופיל מתנדב</label>
                  <select
                    className="select"
                    style={inputStyle}
                    value={userForm?.linkedVolunteerId || ""}
                    onChange={(e) => setUserForm({ ...userForm, linkedVolunteerId: e.target.value })}
                  >
                    <option value="">בחר/י מתנדב קיים מהמערכת...</option>
                    {allVolunteers.map((v) => {
                      const name =
                        v.name ||
                        v.fullName ||
                        [v.firstName, v.lastName].filter(Boolean).join(" ").trim() ||
                        v.email ||
                        v.id;
                      const linked = v.authUid ? " (כבר מקושר)" : "";
                      return (
                        <option key={v.id} value={v.id} disabled={!!v.authUid}>
                          {name}{linked}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              <div>
                <button className="btn btn-primary" type="submit" disabled={isAddingUser} style={{ padding: "10px 24px", borderRadius: "8px", backgroundColor: "#8b2c2c", color: "white", border: "none", fontWeight: "bold", cursor: isAddingUser ? "not-allowed" : "pointer" }}>
                  הוספת {ROLE_LABEL[activeTab] || ""}
                </button>
              </div>
            </form>
          </div>

          {loadingUsers ? (<p style={{ color: "#6c757d", textAlign: "center" }}>טוען משתמשים...</p>) : (
            <div className="table-wrap" style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#fdfbf7", borderBottom: "2px solid #e9ecef" }}>
                    <th style={{ padding: "12px", textAlign: "right", color: "#8b2c2c" }}>שם</th>
                    <th style={{ padding: "12px", textAlign: "right", color: "#8b2c2c" }}>אימייל</th>
                    <th style={{ padding: "12px", textAlign: "right", color: "#8b2c2c" }}>סטטוס</th>
                    <th style={{ padding: "12px", textAlign: "right", color: "#8b2c2c" }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUsers.length > 0 ? displayedUsers.map((u, index) => (
                    <tr key={u?.id || `fallback-key-${index}`} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "12px" }}>{u?.displayName || "—"}</td>
                      <td dir="ltr" style={{ padding: "12px", textAlign: "right", color: "#495057" }}>{u?.email || "—"}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "bold", background: u?.status === "active" ? "#e8f5e9" : "#fdecec", color: u?.status === "active" ? "#1e6b2c" : "#9b1c1c" }}>
                          {u?.status === "active" ? "פעיל" : "לא פעיל"}
                        </span>
                      </td>
                      <td style={{ padding: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                        <button onClick={() => handleStatusClick(u)} style={getActionBtnStyle("#495057", "#f8f9fa", "#ced4da")}>{u?.status === "active" ? "השבת" : "הפעל"}</button>
                        <button onClick={() => handlePasswordClick(u)} disabled={resendingId === u?.id || !u?.email} style={{ ...getActionBtnStyle("#495057", "#f8f9fa", "#ced4da"), opacity: (resendingId === u?.id || !u?.email) ? 0.5 : 1 }}>שלח קישור סיסמה</button>
                        <button onClick={() => handleDeleteClick(u)} style={getActionBtnStyle("#dc3545", "#fdecec", "#f5c6cb")}>מחיקה</button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="4" style={{ textAlign: "center", padding: "20px", color: "#6c757d" }}>לא נמצאו משתמשים התואמים לחיפוש שלך.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>

      {/* --- Section 3: Areas & Neighborhoods --- */}
      <SectionCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "2px solid #f6ecdc", paddingBottom: "10px", direction: "rtl" }}>
          <h3 style={{ margin: 0, color: "#8b2c2c", fontWeight: "bold", fontSize: "1.2rem" }}>אזורים ושכונות</h3>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#fcfaf8", padding: "12px 16px", borderRadius: "10px", border: "1px solid #e9ecef", marginBottom: "20px", direction: "rtl" }}>
          <span style={{ fontWeight: "bold", color: "#495057", fontSize: "14px" }}>+ אזור חדש:</span>
          <form onSubmit={handleAddArea} style={{ display: "flex", gap: "8px", flex: 1 }}>
            <input value={newAreaName || ""} onChange={(e) => setNewAreaName(e.target.value)} placeholder="הכנס שם אזור..." style={{ ...inputStyle, padding: "8px 12px", flex: 1, maxWidth: "300px" }} />
            <button type="submit" style={{ padding: "8px 20px", borderRadius: "8px", backgroundColor: "#8b2c2c", color: "white", border: "none", fontWeight: "bold", cursor: "pointer" }}>הוסף</button>
          </form>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", direction: "rtl" }}>
          {(areas || []).map((a, i) => {
            const areaKey = `area::${a.area}`;
            return (
              <div key={a.area} style={{ ...compactCardStyle, overflow: "visible" }}>
                <div style={{ ...compactCardHeaderStyle, position: "relative", borderRadius: "12px 12px 0 0" }}>
                  {editingLocation === areaKey ? (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1 }}>
                      <input
                        autoFocus
                        value={editAreaInputs[a.area] ?? a.area}
                        onChange={(e) => setEditAreaInputs({ ...editAreaInputs, [a.area]: e.target.value })}
                        style={{ ...inputStyle, padding: "7px 10px", fontWeight: "bold" }}
                      />
                      <button type="button" className="btn" onClick={() => requestRenameArea(a)}>שמור</button>
                      <button type="button" className="btn" onClick={() => setEditingLocation("")}>ביטול</button>
                    </div>
                  ) : (
                    <h4 style={{ margin: 0, color: "#343a40", fontSize: "15px", fontWeight: "bold", display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#8b2c2c", display: "inline-block" }} />
                      {a.area}
                    </h4>
                  )}
                  {editingLocation !== areaKey && (
                    <LocationMenuButton
                      menuKey={areaKey}
                      openKey={openLocationMenu}
                      setOpenKey={setOpenLocationMenu}
                      actions={[
                        {
                          label: "עריכה",
                          onClick: () => {
                            setEditAreaInputs({ ...editAreaInputs, [a.area]: a.area });
                            setEditingLocation(areaKey);
                          },
                        },
                        { label: "מחיקה", danger: true, onClick: () => requestDeleteArea(i) },
                      ]}
                    />
                  )}
                </div>

                <div style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  {(a?.neighborhoods || []).map((nb, j) => {
                    const neighborhoodKey = `neighborhood::${a.area}::${nb}`;
                    const isEditing = editingLocation === neighborhoodKey;
                    const isMoving = movingNeighborhood === neighborhoodKey;
                    return (
                      <span key={nb} style={{ ...compactPillStyle, position: "relative", overflow: "visible", padding: "7px 10px" }}>
                        {isEditing ? (
                          <>
                            <input
                              autoFocus
                              value={editNeighborhoodInputs[`${a.area}::${nb}`] ?? nb}
                              onChange={(e) => setEditNeighborhoodInputs({
                                ...editNeighborhoodInputs,
                                [`${a.area}::${nb}`]: e.target.value,
                              })}
                              style={{ border: 0, outline: 0, background: "transparent", width: 110, fontFamily: "inherit" }}
                            />
                            <button type="button" className="btn" onClick={() => requestRenameNeighborhood(a, nb)}>שמור</button>
                            <button type="button" className="btn" onClick={() => setEditingLocation("")}>ביטול</button>
                          </>
                        ) : isMoving ? (
                          <>
                            <span>{nb}</span>
                            <select
                              autoFocus
                              defaultValue=""
                              onChange={(e) => e.target.value && requestMoveNeighborhood(a, nb, e.target.value)}
                              aria-label={`העברת ${nb} לאזור אחר`}
                              style={{ border: "1px solid #d8cbbc", borderRadius: 8, padding: "5px 7px", fontFamily: "inherit" }}
                            >
                              <option value="">בחר אזור...</option>
                              {areas.filter((candidate) => candidate.area !== a.area).map((candidate) => (
                                <option key={candidate.area} value={candidate.area}>{candidate.area}</option>
                              ))}
                            </select>
                            <button type="button" className="btn" onClick={() => setMovingNeighborhood("")}>ביטול</button>
                          </>
                        ) : (
                          <>
                            <span>{nb}</span>
                            <LocationMenuButton
                              menuKey={neighborhoodKey}
                              openKey={openLocationMenu}
                              setOpenKey={setOpenLocationMenu}
                              compact
                              actions={[
                                {
                                  label: "עריכה",
                                  onClick: () => {
                                    setEditNeighborhoodInputs({
                                      ...editNeighborhoodInputs,
                                      [`${a.area}::${nb}`]: nb,
                                    });
                                    setEditingLocation(neighborhoodKey);
                                  },
                                },
                                { label: "העברה", onClick: () => setMovingNeighborhood(neighborhoodKey) },
                                { label: "מחיקה", danger: true, onClick: () => requestDeleteNeighborhood(i, j) },
                              ]}
                            />
                          </>
                        )}
                      </span>
                    );
                  })}

                  <form onSubmit={(e) => handleAddNeighborhood(e, i)} style={addPillFormStyle}>
                    <input value={newNeighborhoodInputs[i] || ""} onChange={(e) => setNewNeighborhoodInputs({...newNeighborhoodInputs, [i]: e.target.value})} placeholder="הוסף שכונה" style={addPillInputStyle} />
                    <button type="submit" style={addPillBtnStyle} title="הוסף">+</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* --- Section 4: Categories (Now Fully Dynamic & Uniform Colors) --- */}
      <SectionCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "2px solid #f6ecdc", paddingBottom: "10px", direction: "rtl" }}>
          <h3 style={{ margin: 0, color: "#8b2c2c", fontWeight: "bold", fontSize: "1.2rem" }}>קטגוריות מידע</h3>
        </div>


        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px", direction: "rtl" }}>
          {(categories || []).map((catGroup, i) => (
            <div key={i} style={compactCardStyle}>
              <div style={compactCardHeaderStyle}>
                <h4 style={{ margin: 0, color: "#343a40", fontSize: "15px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                   <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#8b2c2c", display: "inline-block" }}></span> 
                   {catGroup?.title || "קבוצה"}
                </h4>
                <span title="קבוצה קבועה" aria-label="קבוצה קבועה" style={{ fontSize: "13px", color: "#9e8a7a" }}>🔒</span>
              </div>

              
              <div style={{ padding: "16px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                {(catGroup?.items || []).map((item, j) => (
                  <span key={j} style={compactPillStyle}>
                    {item}
                    {isProtectedCategory(catGroup.title, item) ? (
                      <span title="קטגוריה קבועה" aria-label="קטגוריה קבועה">🔒</span>
                    ) : (
                      <button onClick={() => requestDeleteCategoryItem(i, j)} style={{ background: "none", border: "none", color: "#adb5bd", cursor: "pointer", padding: 0, fontSize: "12px", display: "flex" }}>✕</button>
                    )}
                  </span>
                ))}
                
                <form onSubmit={(e) => handleAddCategoryItem(e, i)} style={addPillFormStyle}>
                  <input value={newCategoryInputs[i] || ""} onChange={(e) => setNewCategoryInputs({...newCategoryInputs, [i]: e.target.value})} placeholder="הוסף קטגוריה" style={addPillInputStyle} />
                  <button type="submit" style={addPillBtnStyle} title="הוסף">+</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* --- Section 5: Backup --- */}
      <SectionCard>
        <h3 className="settings-section-title">גיבוי נתונים</h3>
        <div style={{ direction: "rtl" }}>
          {backupLoadState === "loading" && (
            <p role="status" aria-live="polite" style={{ color: "#6c757d", margin: "0 0 12px" }}>
              טוען את מצב הגיבוי...
            </p>
          )}

          {backupLoadState === "success" && backupStatus && (
            <>
              <p style={{ color: "#287a3e", margin: "0 0 14px", fontWeight: 700 }}>
                הגיבוי האוטומטי מופעל
              </p>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
                marginBottom: "14px",
              }}>
                {[
                  ["סוג", backupStatus.type === "firestore-managed-backups" ? "Firestore Managed Backups" : "—"],
                  ["תדירות", backupStatus.schedule === "daily" ? "יומי" : backupStatus.schedule === "weekly" ? "שבועי" : "—"],
                  ["משך שמירה", Number.isFinite(backupStatus.retentionDays) ? `${backupStatus.retentionDays} ימים` : "—"],
                  ["אזור", backupStatus.location || "—"],
                  ["מצב הגיבוי האחרון", backupStateLabel(backupStatus.latestBackup?.state)],
                  ["מועד הגיבוי האחרון", formatBackupDate(backupStatus.latestBackup?.snapshotTime)],
                  ["גיבויים מוכנים", String(backupStatus.readyBackupsCount ?? "—")],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    padding: "10px 12px",
                    border: "1px solid #eadfd4",
                    borderRadius: "10px",
                    background: "#fffaf5",
                  }}>
                    <div style={{ color: "#7b6b60", fontSize: "12px", marginBottom: "3px" }}>{label}</div>
                    <div style={{ color: "#343a40", fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
              {backupStatus.partial && (
                <p role="status" style={{ color: "#9a6700", margin: "0 0 12px", fontSize: "14px" }}>
                  התקבל מידע חלקי בלבד מחלק מאזורי Firestore.
                </p>
              )}
            </>
          )}

          {backupLoadState === "unavailable" && (
            <p role="status" style={{ color: "#6c757d", margin: "0 0 12px" }}>
              {backupError || "לא נמצא לוח גיבוי פעיל או ששירות בדיקת המצב טרם נפרס."}
            </p>
          )}

          {backupLoadState === "failure" && (
            <p role="alert" style={{ color: "#b42318", margin: "0 0 12px" }}>
              {backupError}
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={refreshBackupStatus}
            disabled={backupLoadState === "loading"}
            style={{
              padding: "8px 24px",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: backupLoadState === "loading" ? "wait" : "pointer",
              opacity: backupLoadState === "loading" ? 0.65 : 1,
            }}
          >
            {backupLoadState === "loading" ? "מעדכן..." : "עדכון מצב"}
          </button>
        </div>
      </SectionCard>

      {/* ========================================== */}
      {/* SOLID DEFENSIVE MODALS */}
      {/* ========================================== */}

      {statusConfirm.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500, direction: "rtl" }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "16px", width: "90%", maxWidth: "400px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#343a40", fontWeight: "bold", fontSize: "1.2rem" }}>
              {statusConfirm.user?.status === "active" ? "השבתת משתמש" : "הפעלת משתמש"}
            </h3>
            <p style={{ color: "#6c757d", marginBottom: "20px", fontSize: "15px" }}>
              האם אתה בטוח שברצונך {statusConfirm.user?.status === "active" ? "להשבית" : "להפעיל"} את המשתמש <strong>"{statusConfirm.user?.displayName || statusConfirm.user?.email}"</strong>?
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#f8f9fa", color: "#495057", border: "1px solid #ced4da", fontWeight: "bold", cursor: "pointer" }} onClick={() => setStatusConfirm({ isOpen: false, user: null })}>ביטול</button>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#8b2c2c", color: "white", border: "none", fontWeight: "bold", cursor: "pointer" }} onClick={executeToggleStatus}>כן, בצע</button>
            </div>
          </div>
        </div>
      )}

      {passwordConfirm.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500, direction: "rtl" }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "16px", width: "90%", maxWidth: "400px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#343a40", fontWeight: "bold", fontSize: "1.2rem" }}>שליחת קישור לאיפוס סיסמה</h3>
            <p style={{ color: "#6c757d", marginBottom: "20px", fontSize: "15px" }}>
              האם אתה בטוח שברצונך לשלוח קישור להגדרת סיסמה למשתמש <strong>"{passwordConfirm.user?.displayName || passwordConfirm.user?.email}"</strong>?
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#f8f9fa", color: "#495057", border: "1px solid #ced4da", fontWeight: "bold", cursor: "pointer" }} onClick={() => setPasswordConfirm({ isOpen: false, user: null })}>ביטול</button>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#8b2c2c", color: "white", border: "none", fontWeight: "bold", cursor: "pointer" }} onClick={executeResendPassword}>כן, שלח</button>
            </div>
          </div>
        </div>
      )}

      {roleConfirm.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500, direction: "rtl" }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "16px", width: "90%", maxWidth: "400px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#343a40", fontWeight: "bold", fontSize: "1.2rem" }}>שינוי הרשאת משתמש</h3>
            <p style={{ color: "#6c757d", marginBottom: "20px", fontSize: "15px" }}>
              האם אתה בטוח שברצונך לשנות את התפקיד של <strong>"{roleConfirm.user?.displayName || roleConfirm.user?.email}"</strong> ל-<strong>{ROLE_LABEL[roleConfirm.newRole]}</strong>?
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#f8f9fa", color: "#495057", border: "1px solid #ced4da", fontWeight: "bold", cursor: "pointer" }} onClick={() => { setRoleConfirm({ isOpen: false, user: null, newRole: "" }); refreshUsers(); }}>ביטול</button>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#8b2c2c", color: "white", border: "none", fontWeight: "bold", cursor: "pointer" }} onClick={executeRoleChange}>כן, שנה תפקיד</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500, direction: "rtl" }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "16px", width: "90%", maxWidth: "400px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#dc3545", fontWeight: "bold", fontSize: "1.2rem" }}>מחיקת משתמש</h3>
            <p style={{ color: "#6c757d", marginBottom: "20px", fontSize: "15px" }}>
              האם אתה בטוח שברצונך למחוק את המשתמש <strong>"{deleteConfirm.user?.displayName || deleteConfirm.user?.email}"</strong>?<br/>
              פעולה זו אינה ניתנת לביטול.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#f8f9fa", color: "#495057", border: "1px solid #ced4da", fontWeight: "bold", cursor: "pointer" }} onClick={() => setDeleteConfirm({ isOpen: false, user: null })}>ביטול</button>
              <button style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#dc3545", color: "white", border: "none", fontWeight: "bold", cursor: "pointer" }} onClick={executeDeleteUser}>כן, מחק משתמש</button>
            </div>
          </div>
        </div>
      )}

      {genericConfirm.isOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1500, direction: "rtl" }}>
          <div style={{ backgroundColor: "white", padding: "24px", borderRadius: "16px", width: "90%", maxWidth: "400px", boxShadow: "0 10px 30px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#dc3545", fontWeight: "bold", fontSize: "1.3rem" }}>{genericConfirm.title}</h3>
            <p style={{ color: "#6c757d", marginBottom: "24px", fontSize: "15px", lineHeight: "1.5" }}>{genericConfirm.message}</p>
            <div aria-busy={isLocationChangePending} style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button type="button" disabled={isLocationChangePending} style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#f8f9fa", color: "#495057", border: "1px solid #ced4da", fontWeight: "bold", cursor: isLocationChangePending ? "not-allowed" : "pointer", opacity: isLocationChangePending ? 0.65 : 1 }} onClick={() => setGenericConfirm({ isOpen: false })}>ביטול</button>
              <button type="button" disabled={isLocationChangePending} style={{ flex: 1, padding: "10px 0", borderRadius: "10px", backgroundColor: "#dc3545", color: "white", border: "none", fontWeight: "bold", cursor: isLocationChangePending ? "not-allowed" : "pointer", opacity: isLocationChangePending ? 0.65 : 1 }} onClick={genericConfirm.onConfirm}>{isLocationChangePending ? "שומר..." : (genericConfirm.confirmLabel || "כן, המשך")}</button>
            </div>
          </div>
        </div>
      )}

    </AdminPageLayout>
  );
}
