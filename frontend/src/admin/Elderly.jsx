import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CHART_COLORS = [
  "#8B0000",
  "#D4A574",
  "#2e7d32",
  "#ed6c02",
  "#0288d1",
  "#7b1fa2",
  "#00695c",
  "#e65100",
  "#4a148c",
  "#bf360c",
];

import StatsCard from "@/components/admin/StatsCard.jsx";
import SearchFilters from "@/components/admin/SearchFilters.jsx";
import SectionCard from "@/components/admin/SectionCard.jsx";
import DataTable from "@/components/admin/DataTable.jsx";
import TablePagination from "@/components/admin/TablePagination.jsx";
import {
  getElderly,
  getElderlyPage,
  getElderlyQueryCount,
  getElderlyStatusCounts,
  createElderly,
  editElderly,
  deleteElderly,
} from "@/services/elderlyService.js";
import { getVolunteers } from "@/services/volunteersService.js";
import { getElderlyContacts } from "@/services/elderlyContactsService.js";
import useAreasAndNeighborhoods from "@/hooks/useAreasAndNeighborhoods.js";
import useFirestorePagination from "@/hooks/useFirestorePagination.js";
import useDebouncedValue from "@/hooks/useDebouncedValue.js";
import { validateName } from "@/utils/validation";
import { sanitizeFormData } from "@/utils/sanitize";
import {
  getEffectiveSearchTerm,
  normalizeSearchDigits,
  normalizeSearchText,
} from "@/utils/firestoreSearch";
import { createOperationId } from "@/utils/operationId";
import {
  digitsInput,
  normalizeLanguages,
  sortElderlyRecords,
  validateBirthDate,
  validateElderlyNumbers,
} from "@/utils/elderlyFormModel";
import {
  addCountry,
  addLanguage,
  getCountries,
  getLanguages,
} from "@/services/settingsService";

/* ===== Options (shared with volunteers page) =====
   Areas and neighborhoods are loaded from Firestore (settings/general) via the
   useAreasAndNeighborhoods hook — no hardcoded lists here. */
const VOLUNTEER_STATUS_OPTIONS = ["כן", "לא", "קשר טלפוני"];
const GENDER_OPTIONS = ["זכר", "נקבה"];
const MARITAL_OPTIONS = ["רווק/ה", "נשוי/אה", "גרוש/ה", "אלמן/ה"];
const LANGUAGE_OPTIONS = ["עברית", "ערבית", "אנגלית", "ספרדית", "צרפתית", "רוסית", "סינית", "יפנית"];
const RECENT_ELDERLY_VIEWS_KEY = "mitchabrim.recentElderlyViews";
const STATUS_OPTIONS = ["פעיל", "נפטר", "לא פעיל"];
const ASSISTANCE_OPTIONS = [
  "קשר חברתי",
  "ליווי לרופא",
  "קניות",
  "ניקיון",
  "סיוע טכני",
  "סיוע רגשי",
  "ליווי לפעילויות",
];

const COUNTRY_OPTIONS = [
  "ישראל","ארגנטינה","אוסטרליה","אוסטריה","בלגיה","ברזיל","בולגריה","קנדה","צ׳ילה","סין",
  "קולומביה","קרואטיה","קפריסין","צ׳כיה","דנמרק","מצרים","אסטוניה","אתיופיה","פינלנד","צרפת",
  "גאורגיה","גרמניה","יוון","הונגריה","הודו","אינדונזיה","אירן","עיראק","אירלנד","איטליה",
  "יפן","ירדן","קזחסטן","קניה","לטביה","לבנון","ליטא","לוקסמבורג","מקסיקו","מרוקו",
  "הולנד","ניו זילנד","ניגריה","נורבגיה","פקיסטן","פרו","פולין","פורטוגל","רומניה","רוסיה",
  "סעודיה","סרביה","סינגפור","סלובקיה","דרום אפריקה","דרום קוריאה","ספרד","שוודיה","שוויץ","סוריה",
  "טייוואן","תאילנד","תוניסיה","טורקיה","אוקראינה","איחוד האמירויות","בריטניה","ארצות הברית","אורוגוואי","ונצואלה","וייטנאם","תימן",
];

const SEED = [
  { id: 1, firstName: "מרים", lastName: "לוי", idNum: "012345678", birth: "1942-03-14", area: "מרכז", neighborhood: "רחביה", address: "הרצוג 12", mobile: "0521234567", homePhone: "025555555", contactName: "דוד לוי", contactPhone: "0549999999", lastContact: "2026-05-20", volStatus: "כן", volName: "דניאלה כץ", volId: 101, assistance: "קשר חברתי, ליווי לרופא", marital: "אלמן/ה", country: "פולין", language: "עברית", bio: "אישה חמה, אוהבת שיחות טלפון יומיות.", parliament: "פרלמנט רחביה", status: "פעיל", notes: "לתאם מראש לפני ביקור." },
  { id: 2, firstName: "יוסף", lastName: "ברקוביץ", idNum: "023456789", birth: "1938-11-02", area: "דרום", neighborhood: "גילה", address: "הפרחים 4", mobile: "0549876543", homePhone: "", contactName: "רחל ברקוביץ", contactPhone: "0521111111", lastContact: "2026-05-01", volStatus: "לא רוצה", volName: "", volId: null, assistance: "סיוע טכני", marital: "נשוי/אה", country: "רוסיה", language: "רוסית", bio: "", parliament: "פרלמנט גילה", status: "פעיל", notes: "ממתין לשיבוץ" },
  { id: 3, firstName: "חנה", lastName: "שטרן", idNum: "034567890", birth: "1945-06-21", area: "מערב", neighborhood: "בית הכרם", address: "החלוץ 7", mobile: "0501112222", homePhone: "026666666", contactName: "משה שטרן", contactPhone: "0523334444", lastContact: "2026-04-15", volStatus: "כן", volName: "מיכל אבני", volId: 102, assistance: "קשר חברתי", marital: "נשוי/אה", country: "ישראל", language: "עברית", bio: "", parliament: "פרלמנט בית הכרם", status: "פעיל", notes: "" },
  { id: 4, firstName: "אברהם", lastName: "כהן", idNum: "045678901", birth: "1940-01-10", area: "צפון", neighborhood: "פסגת זאב", address: "הרב פרנק 9", mobile: "0533334444", homePhone: "", contactName: "", contactPhone: "", lastContact: "", volStatus: "לא רוצה", volName: "", volId: null, assistance: "", marital: "אלמן/ה", country: "ישראל", language: "עברית", bio: "", parliament: "ללא פרלמנט", status: "פעיל", notes: "ביקש להישאר ללא קשר" },
  { id: 5, firstName: "רבקה", lastName: "אדרי", idNum: "056789012", birth: "1936-09-30", area: "מרכז", neighborhood: "קטמון", address: "פלמ״ח 22", mobile: "0525556666", homePhone: "027777777", contactName: "יעל אדרי", contactPhone: "0548887777", lastContact: "2026-03-22", volStatus: "לא מתאים", volName: "תמר גולן", volId: 103, assistance: "סיוע רגשי", marital: "אלמן/ה", country: "מרוקו", language: "עברית", bio: "מצב בריאותי מורכב.", parliament: "פרלמנט קטמון", status: "פעיל", notes: "" },
  { id: 6, firstName: "שלמה", lastName: "דהן", idNum: "067890123", birth: "1930-02-05", area: "צפון", neighborhood: "רוממה", address: "—", mobile: "", homePhone: "", contactName: "", contactPhone: "", lastContact: "", volStatus: "לא רוצה", volName: "", volId: null, assistance: "", marital: "אלמן/ה", country: "ישראל", language: "עברית", bio: "", parliament: "ללא פרלמנט", status: "נפטר", notes: "" },
];

const volBadge = (v) => (v === "כן" ? "badge-green" : v === "קשר טלפוני" ? "badge-orange" : v === "לא" ? "badge-gray" : "");
const statusBadge = (s) => (s === "פעיל" ? "badge-green" : "badge-gray");
const fullName = (e) => `${e.firstName || ""} ${e.lastName || ""}`.trim();

export default function Elderly() {
  const [loadError, setLoadError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [openVolunteer, setOpenVolunteer] = useState(null);
  const [openContact, setOpenContact] = useState(null);

  // Area/Neighborhood data — single source of truth from settings/general.
  const {
    areaNames,
    getNeighborhoods,
    loading: areasLoading,
    error: areasError,
    isEmpty: areasEmpty,
  } = useAreasAndNeighborhoods();

  // Filters
  const [filterArea, setFilterArea] = useState("");
  const [filterNeighborhood, setFilterNeighborhood] = useState("");
  const [filterMarital, setFilterMarital] = useState("");
  const [filterVolStatus, setFilterVolStatus] = useState("");
  const [sortMode, setSortMode] = useState("לפי האלף-בית");
  const [sortedPage, setSortedPage] = useState(1);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_ELDERLY_VIEWS_KEY) || "[]");
      return Array.isArray(stored) ? stored.map(String).slice(0, 100) : [];
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");

  // If the area changes and the previously-selected neighborhood is no longer
  // valid for the new area, reset it.
  useEffect(() => {
    if (!filterNeighborhood) return;
    const valid = getNeighborhoods(filterArea).includes(filterNeighborhood);
    if (!valid) setFilterNeighborhood("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterArea]);

  const PAGE_SIZE = 20;
  const debouncedSearch = useDebouncedValue(search, 300);
  const effectiveSearch = getEffectiveSearchTerm(debouncedSearch);
  const queryCriteria = useMemo(() => ({
    area: filterArea,
    neighborhood: filterNeighborhood,
    marital: filterMarital,
    volStatus: filterVolStatus,
    search: effectiveSearch,
  }), [filterArea, filterNeighborhood, filterMarital, filterVolStatus, effectiveSearch]);
  const queryKey = JSON.stringify(queryCriteria);
  const hasActiveQuery = !!(
    filterArea || filterNeighborhood || filterMarital || filterVolStatus || effectiveSearch
  );

  // Cache-invalidation counter (bumped after mutations to force refetch).
  const [statsVersion, setStatsVersion] = useState(0);

  const [stats, setStats] = useState({
    total: 0,
    connected: 0,
    without: 0,
    phoneContact: 0,
    searchIndexed: 0,
  });
  const [totalCount, setTotalCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getElderlyStatusCounts()
      .then((nextStats) => {
        if (cancelled) return;
        setStats(nextStats);
        if (!hasActiveQuery) setTotalCount(nextStats.total);
      })
      .catch((err) => {
        console.error("Failed to load elderly counts:", err);
        if (!cancelled) setLoadError("טעינת נתוני הסיכום נכשלה.");
      });
    return () => { cancelled = true; };
  }, [statsVersion, hasActiveQuery]);

  const fetchElderlyPage = useCallback(
    ({ cursor }) => getElderlyPage({ pageSize: PAGE_SIZE, cursor, criteria: queryCriteria }),
    [queryCriteria],
  );
  const paged = useFirestorePagination({
    fetchPage: fetchElderlyPage,
    totalCount,
    pageSize: PAGE_SIZE,
    deps: [statsVersion, queryKey],
  });

  useEffect(() => {
    if (!hasActiveQuery) return undefined;
    let cancelled = false;
    getElderlyQueryCount(queryCriteria)
      .then((count) => {
        if (!cancelled) setTotalCount(count);
      })
      .catch((err) => {
        console.error("Failed to count filtered elderly:", err);
        if (!cancelled) setLoadError("טעינת מספר תוצאות החיפוש נכשלה.");
      });
    return () => { cancelled = true; };
  }, [queryKey, statsVersion, hasActiveQuery]);

  // Full reads remain isolated behind explicit print/chart/form actions.
  const [fullData, setFullData] = useState(null);
  const [fullLoading, setFullLoading] = useState(false);
  const fullDataCacheRef = useRef(null);
  const fullDataRequestRef = useRef(null);
  const fullDataVersionRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      fullDataVersionRef.current += 1;
    };
  }, []);
  const ensureFullData = useCallback(async () => {
    if (fullDataCacheRef.current) return fullDataCacheRef.current;
    if (fullDataRequestRef.current) return fullDataRequestRef.current;
    const version = fullDataVersionRef.current;
    if (mountedRef.current) setFullLoading(true);
    const request = getElderly()
      .then((items) => {
        const data = items.length ? items : SEED;
        if (mountedRef.current && version === fullDataVersionRef.current) {
          fullDataCacheRef.current = data;
          setFullData(data);
        }
        return data;
      })
      .catch((err) => {
        console.error("Failed to load full elderly collection:", err);
        if (mountedRef.current && version === fullDataVersionRef.current) {
          fullDataCacheRef.current = null;
          setLoadError("טעינת הנתונים המלאים מ-Firebase נכשלה. ניתן לנסות שוב.");
          setFullData(null);
        }
        throw err;
      })
      .finally(() => {
        if (fullDataRequestRef.current === request) fullDataRequestRef.current = null;
        if (mountedRef.current && version === fullDataVersionRef.current) {
          setFullLoading(false);
        }
      });
    fullDataRequestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    setSortedPage(1);
    if (sortMode) ensureFullData().catch(() => {});
  }, [sortMode, queryKey, ensureFullData]);

  // Only active seniors are shown in the table + stats + charts.
  const activeData = useMemo(
    () => (fullData || []).filter((e) => e.status === "פעיל"),
    [fullData],
  );

  const chartData = useMemo(() => {
    // Bar: Elderly by Neighborhood (active only)
    const neighborhoodCount = {};
    activeData.forEach((item) => {
      const key = item.neighborhood || "ללא שכונה";
      neighborhoodCount[key] = (neighborhoodCount[key] || 0) + 1;
    });
    const barData = Object.entries(neighborhoodCount)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Pie: כן vs לא (volunteer status ratio)
    const yes = activeData.filter((e) => e.volStatus === "כן").length;
    const no = activeData.filter((e) => e.volStatus === "לא").length;
    const pieData = [];
    if (yes) pieData.push({ name: "כן", value: yes });
    if (no) pieData.push({ name: "לא", value: no });

    return { barData, pieData };
  }, [activeData]);

  const sortedFilteredData = useMemo(() => {
    if (!sortMode || !fullData) return [];
    const searchTerm = effectiveSearch;
    const filteredItems = fullData.filter((item) => {
      if (item.status !== "פעיל") return false;
      if (filterArea && item.area !== filterArea) return false;
      if (filterNeighborhood && item.neighborhood !== filterNeighborhood) return false;
      if (filterMarital && item.marital !== filterMarital) return false;
      if (filterVolStatus && item.volStatus !== filterVolStatus) return false;
      if (searchTerm) {
        const nameSearch = normalizeSearchText(fullName(item));
        const digitSearch = [
          item.idNum,
          item.mobile,
          item.homePhone,
        ].map(normalizeSearchDigits).join(" ");
        if (!nameSearch.includes(searchTerm) && !digitSearch.includes(searchTerm)) return false;
      }
      return true;
    });
    return sortElderlyRecords(filteredItems, sortMode, recentlyViewedIds);
  }, [
    sortMode,
    fullData,
    effectiveSearch,
    filterArea,
    filterNeighborhood,
    filterMarital,
    filterVolStatus,
    recentlyViewedIds,
  ]);
  // Keep the current server page visible until the full dataset needed for
  // client-side sorting has loaded, instead of rendering an empty first page.
  const usingClientSort = Boolean(sortMode && fullData);
  const sortedTotalPages = Math.max(1, Math.ceil(sortedFilteredData.length / PAGE_SIZE));
  const pageItems = usingClientSort
    ? sortedFilteredData.slice((sortedPage - 1) * PAGE_SIZE, sortedPage * PAGE_SIZE)
    : paged.items;
  const currentPage = usingClientSort ? sortedPage : paged.page;
  const totalPages = usingClientSort ? sortedTotalPages : paged.totalPages;
  const paginationTotal = usingClientSort ? sortedFilteredData.length : (totalCount ?? 0);
  const loading = usingClientSort ? fullLoading : paged.loading;



  // Resolve the open elderly record from whichever list is currently visible.
  const openElderly =
    (fullData && fullData.find((e) => e.id === openId)) ||
    pageItems.find((e) => e.id === openId) ||
    null;

  const createMutationIdRef = useRef(null);
  const editMutationIdRef = useRef(null);

  // Invalidate paginated + count caches after any mutation.
  const invalidate = () => {
    fullDataVersionRef.current += 1;
    fullDataCacheRef.current = null;
    fullDataRequestRef.current = null;
    setFullData(null);
    setStatsVersion((v) => v + 1);
  };

  const handleEditElderly = async (id, updated) => {
    editMutationIdRef.current ||= createOperationId();
    try {
      // eslint-disable-next-line no-unused-vars
      const { id: _omit, ...payload } = sanitizeFormData(updated);
      await editElderly(id, payload, editMutationIdRef.current);
    } catch (err) {
      console.error("editElderly failed:", err);
      alert("שמירה ל-Firebase נכשלה. לא בוצע שינוי חלקי.");
      return;
    }
    editMutationIdRef.current = null;
    setOpenId(null);
    invalidate();
  };

  const handleCreateElderly = async (entry) => {
    const clean = sanitizeFormData(entry);
    createMutationIdRef.current ||= createOperationId();
    try {
      await createElderly(clean, createMutationIdRef.current);
    } catch (err) {
      console.error("createElderly failed:", err);
      alert("הוספה ל-Firebase נכשלה.");
      return;
    }
    createMutationIdRef.current = null;
    setShowAdd(false);
    invalidate();
  };

  const handleDeleteElderly = async (elderly) => {
    if (!elderly) return;
    if (!window.confirm(`האם למחוק את ${fullName(elderly)}? פעולה זו אינה הפיכה.`)) return;
    try {
      if (typeof elderly.id === "string") await deleteElderly(elderly.id, createOperationId());
    } catch (err) {
      console.error("deleteElderly failed:", err);
      alert("מחיקה מ-Firebase נכשלה.");
      return;
    }
    setOpenId(null);
    invalidate();
  };

  const handleOpenPrint = async () => {
    try {
      await ensureFullData();
      setShowPrint(true);
    } catch {
      // ensureFullData already exposes the actionable error in the page.
    }
  };
  const handleOpenAdd = async () => {
    ensureFullData().catch(() => {});
    createMutationIdRef.current = createOperationId();
    setShowAdd(true);
  };
  const handleToggleCharts = async () => {
    if (showCharts) {
      setShowCharts(false);
      return;
    }
    try {
      await ensureFullData();
      setShowCharts(true);
    } catch {
      // Keep charts closed and allow the next click to retry.
    }
  };

  const markElderlyViewed = (elderlyId) => {
    const id = String(elderlyId);
    setRecentlyViewedIds((current) => {
      const next = [id, ...current.filter((item) => item !== id)].slice(0, 100);
      try {
        localStorage.setItem(RECENT_ELDERLY_VIEWS_KEY, JSON.stringify(next));
      } catch {
        // Keep the current-session ordering if browser storage is unavailable.
      }
      return next;
    });
  };

  const totalStat = stats.total;
  const connectedCount = stats.connected;
  const phoneContactCount = stats.phoneContact;
  const withoutCount = stats.without;





  return (
    <AdminPageLayout
      title="ניהול אזרחים ותיקים"
      subtitle="ניהול רשימת האזרחים הוותיקים, שיוך לאזורים ושכונות, סטטוס התנדבות ופרטים אישיים."
      heroImage="/admin-heroes/elderly-hero-bg.webp"
      actions={
        <>
          <button className="btn btn-primary" onClick={handleOpenAdd}>+ הוספת אזרח ותיק</button>
          <button className="btn" onClick={handleOpenPrint}>הדפסת רשימה</button>
          <button
            className="btn btn-outline"
            onClick={handleToggleCharts}
          >
            {showCharts ? "📊 הסתר גרפים" : "📊 הצג גרפים"}
          </button>
        </>
      }
    >

      {(loadError || paged.error) && (
        <div style={{
          background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e",
          borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 14,
        }}>{loadError || paged.error}</div>
      )}
      {loading && (
        <div style={{ padding: "10px 0", color: "#6b7280", fontSize: 14 }}>טוען נתונים…</div>
      )}
      <div className="stats-grid">
        <StatsCard icon="👵" title="סה״כ אזרחים ותיקים" value={String(totalStat)} />
        <StatsCard icon="🤝" title="מחוברים למתנדב" value={String(connectedCount)} />
        <StatsCard icon="🚫" title="ללא מתנדב" value={String(withoutCount)} />
        <StatsCard icon="📞" title="קשר טלפוני" value={String(phoneContactCount)} />
      </div>

      {showCharts && fullData && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20, marginBottom: 20 }}>
          <SectionCard title="📊 אזרחים ותיקים לפי שכונה">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData.barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8B0000" name="מספר אזרחים" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard title="🧩 התפלגות לפי סטטוס מתנדב">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      )}

      <SectionCard>
        {areasError && (
          <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>{areasError}</div>
        )}
        {areasLoading && (
          <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 8 }}>טוען אזורים ושכונות...</div>
        )}
        {areasEmpty && (
          <div style={{ color: "#92400e", fontSize: 13, marginBottom: 8 }}>לא נמצאו אזורים ושכונות</div>
        )}
        <SearchFilters
          searchPlaceholder="חיפוש מתחיל לפי שם, טלפון או ת.ז..."
          searchValue={search}
          onSearchChange={(e) => setSearch(e.target.value)}
          filters={[
            {
              label: "אזור",
              value: filterArea,
              onChange: (e) => setFilterArea(e.target.value),
              options: ["", ...areaNames],
            },
            {
              label: "שכונה",
              value: filterNeighborhood,
              onChange: (e) => setFilterNeighborhood(e.target.value),
              options: ["", ...getNeighborhoods(filterArea)],
            },
            {
              label: "מצב משפחתי",
              value: filterMarital,
              onChange: (e) => setFilterMarital(e.target.value),
              options: ["", ...MARITAL_OPTIONS],
            },
            {
              label: "סטטוס מתנדב",
              value: filterVolStatus,
              onChange: (e) => setFilterVolStatus(e.target.value),
              options: ["", ...VOLUNTEER_STATUS_OPTIONS],
            },
            {
              label: "מיון",
              value: sortMode,
              onChange: (e) => setSortMode(e.target.value),
              options: ["לפי האלף-בית", "לפי שכונות", "לפי קשר אחרון", "צפיות אחרונות"],
            },
          ]}
        />
        {effectiveSearch && stats.total > stats.searchIndexed && (
          <div style={{
            background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e",
            borderRadius: 10, padding: "8px 12px", margin: "10px 0", fontSize: 13,
          }}>
            חלק מהרשומות הישנות טרם הוכנו לחיפוש. התוצאות עשויות להיות חלקיות עד להפעלת PERF-05 backfill.
          </div>
        )}
        <DataTable
          columns={[
            {
              key: "_idx",
              label: "#",
              render: (r) => r._idx,
            },
            {
              key: "name",
              label: "שם",
              render: (r) => (
                <button className="link-btn" onClick={() => {
                  editMutationIdRef.current = createOperationId();
                  markElderlyViewed(r.id);
                  setOpenId(r.id);
                }}>{fullName(r)}</button>
              ),
            },
            { key: "idNum", label: "ת.ז.", render: (r) => r.idNum || "—" },
            { key: "neighborhood", label: "שכונה" },
            { key: "mobile", label: "טלפון", render: (r) => r.mobile || r.homePhone || "—" },
            {
              key: "volStatus",
              label: "סטטוס מתנדב",
              render: (r) => <span className={`badge ${volBadge(r.volStatus)}`}>{r.volStatus}</span>,
            },
            {
              key: "volName",
              label: "משויך ל",
              render: (r) =>
                r.volName ? (
                  <button className="link-btn" onClick={() => setOpenVolunteer(r)}>{r.volName}</button>
                ) : (
                  "—"
                ),
            },
            {
              key: "contactPerson",
              label: "איש קשר",
              render: (r) =>
                r.contactPersonName ? (
                  <button className="link-btn" onClick={() => setOpenContact(r)}>{r.contactPersonName}</button>
                ) : (
                  "—"
                ),
            },
            { key: "notes", label: "הערות" },
          ]}
          data={pageItems.map((r, i) => ({ ...r, _idx: ((currentPage - 1) * PAGE_SIZE) + i + 1 }))}
        />
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={paginationTotal}
          pageSize={PAGE_SIZE}
          loading={loading}
          onNext={usingClientSort
            ? () => setSortedPage((page) => Math.min(sortedTotalPages, page + 1))
            : paged.next}
          onPrevious={usingClientSort
            ? () => setSortedPage((page) => Math.max(1, page - 1))
            : paged.prev}
          onPageChange={usingClientSort ? setSortedPage : paged.goToPage}
        />


      </SectionCard>

      {showAdd && (
        <ElderlyFormModal
          title="הוספת אזרח ותיק"
          initial={null}
          existingIds={(fullData || pageItems).map((d) => ({ id: d.id, idNum: d.idNum }))}
          onClose={() => {
            createMutationIdRef.current = null;
            setShowAdd(false);
          }}
          onSave={handleCreateElderly}
        />
      )}
      {openElderly && (
        <ElderlyProfileModal
          entry={openElderly}
          existingIds={(fullData || pageItems).map((d) => ({ id: d.id, idNum: d.idNum }))}
          onClose={() => {
            editMutationIdRef.current = null;
            setOpenId(null);
          }}
          onSave={(updated) => handleEditElderly(openElderly.id, updated)}
          onDelete={() => handleDeleteElderly(openElderly)}
        />
      )}
      {openVolunteer && (
        <VolunteerQuickModal entry={openVolunteer} onClose={() => setOpenVolunteer(null)} />
      )}
      {openContact && (
        <ContactQuickModal entry={openContact} onClose={() => setOpenContact(null)} />
      )}
      {showPrint && fullData && (
        <PrintReportModal
          items={[...fullData].sort((a, b) => fullName(a).localeCompare(fullName(b), "he"))}
          onClose={() => setShowPrint(false)}
        />
      )}
    </AdminPageLayout>
  );
}

/* ===== Profile modal (view + edit) ===== */
function ElderlyProfileModal({ entry, existingIds, onClose, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <ElderlyFormModal
        title="עריכת פרטי אזרח ותיק"
        initial={entry}
        existingIds={existingIds}
        onClose={() => setEditing(false)}
        onSave={(updated) => {
          onSave({ ...entry, ...updated });
          setEditing(false);
        }}
      />
    );
  }

  const D = ({ label, value }) => (
    <div className="item"><label>{label}</label><div>{value || "—"}</div></div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 880 }}>
        <div className="modal-header" style={{ alignItems: "center" }}>
          <h2>פרופיל אזרח ותיק — {fullName(entry)}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginInlineStart: "auto" }}>
            <button className="btn btn-primary" onClick={() => setEditing(true)}>עריכת פרטים</button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="form-section">
          <h4>פרטים אישיים</h4>
          <div className="detail-grid">
            <D label="שם פרטי" value={entry.firstName} />
            <D label="שם משפחה" value={entry.lastName} />
            <D label="ת.ז" value={entry.idNum} />
            <D label="תאריך לידה" value={entry.birth} />
            <D label="מגדר" value={entry.gender} />
            <D label="מצב משפחתי" value={entry.marital} />
          </div>
        </div>

        <div className="form-section">
          <h4>פרטי קשר</h4>
          <div className="detail-grid">
            <D label="אזור" value={entry.area} />
            <D label="שכונה" value={entry.neighborhood} />
            <D label="כתובת" value={entry.address} />
            <D label="טלפון נייד" value={entry.mobile} />
            <D label="טלפון בית" value={entry.homePhone} />
          </div>
        </div>

        <div className="form-section">
          <h4>איש קשר של האזרח</h4>
          {entry.contactPersonId ? (
            <>
              <div className="detail-grid">
                <D label="שם איש קשר" value={entry.contactPersonName} />
                <D label="סוג קשר" value={entry.contactPersonRelationType} />
                <D label="טלפון" value={entry.contactPersonPhone} />
                <D label="מייל" value={entry.contactPersonEmail} />
                <D label="סטטוס" value={entry.contactPersonStatus} />
              </div>
              {entry.contactPersonNotes && (
                <div className="field" style={{ marginTop: 10 }}>
                  <label>הערות</label>
                  <div>{entry.contactPersonNotes}</div>
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "#6b7280", margin: 0 }}>לא קושר איש קשר</p>
          )}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-sm" onClick={() => setEditing(true)}>
              עריכת איש קשר מקושר
            </button>
          </div>
        </div>

        <div className="form-section">
          <h4>תאריך יצירת קשר אחרון</h4>
          <div className="detail-grid">
            <D label="תאריך יצירת קשר אחרונה" value={entry.lastContact} />
          </div>
        </div>


        <div className="form-section">
          <h4>התנדבות</h4>
          <div className="detail-grid">
            <D label="סטטוס מתנדב" value={<span className={`badge ${volBadge(entry.volStatus)}`}>{entry.volStatus}</span>} />
            {entry.volStatus === "כן" && (
              <D label="שם מתנדב" value={entry.volName} />
            )}
            <D label="סיוע" value={entry.assistance} />
          </div>
        </div>

        <div className="form-section">
          <h4>רקע</h4>
          <div className="detail-grid">
            <D label="ארץ לידה" value={entry.country} />
            <D label="שפות דיבור" value={normalizeLanguages(entry).join(", ")} />
            
            <D label="סטטוס" value={<span className={`badge ${statusBadge(entry.status)}`}>{entry.status}</span>} />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>פירוט חיים אישיים</label>
            <div>{entry.bio || "—"}</div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>הערות</label>
            <div>{entry.notes || "—"}</div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
          {onDelete && (
            <button className="btn btn-danger" onClick={onDelete}>מחיקת אזרח ותיק</button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===== Form modal (add / edit) ===== */
const NUMERIC_FIELDS = ["idNum", "mobile", "homePhone"];
const REQUIRED_LABELS = {
  firstName: "שם פרטי", lastName: "שם משפחה", mobile: "טלפון נייד",
};

function ElderlyFormModal({ title, initial, existingIds = [], onClose, onSave }) {
  const {
    areaNames,
    getNeighborhoods,
    loading: areasLoading,
    error: areasError,
    isEmpty: areasEmpty,
  } = useAreasAndNeighborhoods();

  const [f, setF] = useState(() => {
    const base = initial || {
      firstName: "", lastName: "", idNum: "", birth: "", gender: "",
      mobile: "", homePhone: "",
      area: "", neighborhood: "", address: "",
      lastContact: "",
      contactPersonId: null, contactPersonName: "", contactPersonPhone: "",
      contactPersonRelationType: "", contactPersonEmail: "",
      contactPersonStatus: "", contactPersonNotes: "",
      volStatus: "לא", volName: "",
      assistance: "", marital: MARITAL_OPTIONS[0],
      country: "ישראל", language: "עברית", languages: ["עברית"],
      bio: "",
      status: "פעיל", notes: "",
    };
    const languages = normalizeLanguages(base);
    return { ...base, languages, language: languages.join(", ") };
  });
  const [numericWarn, setNumericWarn] = useState({});
  const [missing, setMissing] = useState([]);
  const [idDup, setIdDup] = useState(false);
  const [countryOptions, setCountryOptions] = useState(
    () => [...COUNTRY_OPTIONS].sort((a, b) => a.localeCompare(b, "he")),
  );
  const [newCountry, setNewCountry] = useState("");
  const [countryError, setCountryError] = useState("");
  const [languageOptions, setLanguageOptions] = useState(() => (
    [...new Set([...LANGUAGE_OPTIONS, ...normalizeLanguages(initial || {})])]
      .sort((a, b) => a.localeCompare(b, "he"))
  ));
  const [newLanguage, setNewLanguage] = useState("");
  const [languageError, setLanguageError] = useState("");

  // Load volunteers from Firestore for the volunteer-select dropdown.
  const [volunteers, setVolunteers] = useState([]);
  const [volLoading, setVolLoading] = useState(true);
  const [volError, setVolError] = useState("");
  // Load contact persons for the contact-person-select dropdown.
  const [contactPersons, setContactPersons] = useState([]);
  const [cpLoading, setCpLoading] = useState(true);
  const [cpError, setCpError] = useState("");
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const countries = await getCountries(COUNTRY_OPTIONS);
        if (mounted) setCountryOptions(countries);
      } catch (err) {
        console.error("Failed to load countries:", err);
      }
    })();
    (async () => {
      try {
        const languages = await getLanguages([
          ...LANGUAGE_OPTIONS,
          ...normalizeLanguages(initial || {}),
        ]);
        if (mounted) setLanguageOptions(languages);
      } catch (err) {
        console.error("Failed to load languages:", err);
      }
    })();
    (async () => {
      try {
        const list = await getVolunteers();
        if (!mounted) return;
        setVolunteers(list);
      } catch (err) {
        console.error("Failed to load volunteers:", err);
        if (mounted) setVolError("טעינת רשימת המתנדבים נכשלה");
      } finally {
        if (mounted) setVolLoading(false);
      }
    })();
    (async () => {
      try {
        const list = await getElderlyContacts();
        if (!mounted) return;
        setContactPersons(list);
      } catch (err) {
        console.error("Failed to load contact persons:", err);
        if (mounted) setCpError("טעינת רשימת אנשי הקשר נכשלה");
      } finally {
        if (mounted) setCpLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);


  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  // Changing area resets neighborhood to avoid stale/invalid pairings.
  const setArea = (e) => setF({ ...f, area: e.target.value, neighborhood: "" });
  const setDigits = (k, maxLen) => (e) => {
    const raw = e.target.value;
    const cleaned = digitsInput(raw, maxLen);
    setNumericWarn((w) => ({ ...w, [k]: raw !== cleaned }));
    setF({ ...f, [k]: cleaned });
  };
  const setLetters = (k, maxLen = 80) => (e) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/[^A-Za-z\u0590-\u05FF\u0600-\u06FF\s'\-"]/g, "").slice(0, maxLen);
    setF({ ...f, [k]: cleaned });
  };


  const showVolName = f.volStatus === "כן";

  const [fieldErrors, setFieldErrors] = useState({});

  const handleSave = () => {
    const required = Object.keys(REQUIRED_LABELS);
    const empty = required.filter((k) => !String(f[k] ?? "").trim());
    const dup = f.idNum && existingIds.some((x) => x.idNum === f.idNum && x.id !== (initial?.id));

    // logical validation
    const errs = {};
    const fn = validateName(f.firstName); if (fn) errs.firstName = fn;
    const ln = validateName(f.lastName); if (ln) errs.lastName = ln;
    Object.assign(errs, validateElderlyNumbers(f));
    const birthError = validateBirthDate(f.birth);
    if (birthError) errs.birth = birthError;
    setFieldErrors(errs);
    setMissing(empty);
    setIdDup(dup);
    if (empty.length || dup || Object.keys(errs).length) return;
    const languages = normalizeLanguages(f);
    onSave({ ...f, languages, language: languages.join(", ") });
  };

  const toggleLanguage = (language) => {
    const current = normalizeLanguages(f);
    const next = current.includes(language)
      ? current.filter((item) => item !== language)
      : [...current, language];
    setF({ ...f, languages: next, language: next.join(", ") });
  };

  const handleAddCountry = async () => {
    setCountryError("");
    try {
      const countries = await addCountry(newCountry, COUNTRY_OPTIONS);
      const added = countries.find((country) => (
        country.localeCompare(newCountry.trim(), "he", { sensitivity: "base" }) === 0
      )) || newCountry.trim();
      setCountryOptions(countries);
      setF({ ...f, country: added });
      setNewCountry("");
    } catch (error) {
      setCountryError(error?.message || "לא ניתן להוסיף את המדינה");
    }
  };

  const handleAddLanguage = async () => {
    setLanguageError("");
    try {
      const languages = await addLanguage(newLanguage, languageOptions);
      const added = languages.find((language) => (
        language.localeCompare(newLanguage.trim(), "he", { sensitivity: "base" }) === 0
      )) || newLanguage.trim();
      setLanguageOptions(languages);
      if (!normalizeLanguages(f).includes(added)) toggleLanguage(added);
      setNewLanguage("");
    } catch (error) {
      setLanguageError(error?.message || "לא ניתן להוסיף את השפה");
    }
  };

  const NumericMsg = ({ k }) => numericWarn[k] ? (
    <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>ניתן להזין מספרים שלמים בלבד</div>
  ) : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 920 }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {(missing.length > 0 || idDup) && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
            borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 14,
          }}>
            {missing.length > 0 && (
              <div>קיימים שדות חובה ריקים: {missing.map((k) => REQUIRED_LABELS[k]).join(", ")}</div>
            )}
            {idDup && <div>מספר ת.ז זה כבר קיים במערכת — אינו יכול לחזור על עצמו.</div>}
          </div>
        )}

        <div className="form-section">
          <h4>פרטים אישיים</h4>
          <div className="row row-2">
            <div className="field"><label>שם פרטי</label><input className="input" value={f.firstName} onChange={setLetters("firstName")} />{fieldErrors.firstName && <div style={{color:"#dc2626",fontSize:12}}>{fieldErrors.firstName}</div>}</div>
            <div className="field"><label>שם משפחה</label><input className="input" value={f.lastName} onChange={setLetters("lastName")} />{fieldErrors.lastName && <div style={{color:"#dc2626",fontSize:12}}>{fieldErrors.lastName}</div>}</div>
            <div className="field">
              <label>ת.ז</label>
              <input className="input" value={f.idNum} onChange={setDigits("idNum", 9)} inputMode="numeric" maxLength={9} />
              <NumericMsg k="idNum" />
              {fieldErrors.idNum && <div style={{color:"#dc2626",fontSize:12}}>{fieldErrors.idNum}</div>}
            </div>
            <div className="field"><label>תאריך לידה</label><input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={f.birth} onChange={set("birth")} />{fieldErrors.birth && <div style={{color:"#dc2626",fontSize:12}}>{fieldErrors.birth}</div>}</div>
            <div className="field">
              <label>מגדר</label>
              <select className="select" value={f.gender || ""} onChange={set("gender")}>
                <option value="">בחר מגדר</option>
                {GENDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>מצב משפחתי</label>
              <select className="select" value={f.marital} onChange={set("marital")}>
                {MARITAL_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h4>פרטי קשר</h4>
          <div className="row row-2">
            <div className="field">
              <label>טלפון נייד</label>
              <input className="input" value={f.mobile} onChange={setDigits("mobile", 10)} inputMode="numeric" maxLength={10} />
              <NumericMsg k="mobile" />
              {fieldErrors.mobile && <div style={{color:"#dc2626",fontSize:12}}>{fieldErrors.mobile}</div>}
            </div>
            <div className="field">
              <label>טלפון בית</label>
              <input className="input" value={f.homePhone} onChange={setDigits("homePhone", 9)} inputMode="numeric" maxLength={9} />
              <NumericMsg k="homePhone" />
              {fieldErrors.homePhone && <div style={{color:"#dc2626",fontSize:12}}>{fieldErrors.homePhone}</div>}
            </div>
            <div className="field">
              <label>אזור</label>
              <select className="select" value={f.area || ""} onChange={setArea} disabled={areasLoading || areasEmpty}>
                <option value="">
                  {areasLoading ? "טוען אזורים..." : areasEmpty ? "לא נמצאו אזורים" : "בחר אזור"}
                </option>
                {areaNames.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {areasError && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 4 }}>{areasError}</div>}
            </div>
            <div className="field">
              <label>שכונה</label>
              <select
                className="select"
                value={f.neighborhood || ""}
                onChange={set("neighborhood")}
                disabled={!f.area}
              >
                <option value="">{f.area ? "בחר שכונה" : "בחר אזור תחילה"}</option>
                {getNeighborhoods(f.area).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="field"><label>כתובת</label><input className="input" value={f.address} onChange={set("address")} /></div>
          </div>
        </div>

        <div className="form-section">
          <h4>איש קשר מקושר</h4>
          <div className="row row-2">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>איש קשר מקושר</label>
              <ContactPersonSelect
                contactPersons={contactPersons}
                loading={cpLoading}
                error={cpError}
                valueId={f.contactPersonId}
                onChange={(cp) =>
                  setF({
                    ...f,
                    contactPersonId: cp ? cp.id : null,
                    contactPersonName: cp ? (cp.fullName || `${cp.firstName || ""} ${cp.lastName || ""}`.trim()) : "",
                    contactPersonPhone: cp ? (cp.phone || "") : "",
                    contactPersonRelationType: cp ? (cp.relationType || "") : "",
                    contactPersonEmail: cp ? (cp.email || "") : "",
                    contactPersonStatus: cp ? (cp.status || "פעיל") : "",
                    contactPersonNotes: cp ? (cp.notes || "") : "",
                  })
                }
              />
              <div style={{ color: "#6b7280", fontSize: 12, marginTop: 6 }}>
                ניתן לבחור רק איש קשר קיים. ליצירת איש קשר חדש יש לעבור ל"ניהול אנשי קשר לקשישים".
              </div>
            </div>
            <div className="field"><label>תאריך יצירת קשר אחרונה</label><input className="input" type="date" value={f.lastContact} onChange={set("lastContact")} /></div>
          </div>
        </div>


        <div className="form-section">
          <h4>התנדבות</h4>
          <div className="row row-2">
            <div className="field">
              <label>סטטוס מתנדב</label>
              <select className="select" value={f.volStatus} onChange={set("volStatus")}>
                {VOLUNTEER_STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            {showVolName && (
              <div className="field">
                <label>שם מתנדב</label>
                <VolunteerSelect
                  volunteers={volunteers}
                  loading={volLoading}
                  error={volError}
                  valueId={f.volId}
                  valueName={f.volName}
                  onChange={(v) =>
                    setF({
                      ...f,
                      volId: v ? v.id : null,
                      volName: v ? `${v.firstName || ""} ${v.lastName || ""}`.trim() || v.name || "" : "",
                    })
                  }
                />
              </div>
            )}
            <div className="field"><label>סיוע</label><input className="input" value={f.assistance} onChange={set("assistance")} placeholder="לדוגמה: קשר חברתי, ליווי לרופא" /></div>
          </div>
        </div>

        <div className="form-section">
          <h4>רקע</h4>
          <div className="row row-2">
            <div className="field">
              <label>ארץ לידה</label>
              <select className="select" value={f.country} onChange={set("country")}>
                {countryOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <input className="input" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} placeholder="מדינה חדשה" />
                <button type="button" className="btn" onClick={handleAddCountry}>הוסף</button>
              </div>
              {countryError && <div style={{color:"#dc2626",fontSize:12}}>{countryError}</div>}
            </div>
            <div className="field">
              <label>שפות דיבור</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {languageOptions.map((language) => (
                  <label key={language} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={normalizeLanguages(f).includes(language)}
                      onChange={() => toggleLanguage(language)}
                    />
                    {language}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <input
                  className="input"
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  placeholder="שפה חדשה"
                />
                <button type="button" className="btn" onClick={handleAddLanguage}>הוסף</button>
              </div>
              {languageError && <div style={{color:"#dc2626",fontSize:12}}>{languageError}</div>}
            </div>
            <div className="field">
              <label>סטטוס</label>
              <select className="select" value={f.status} onChange={set("status")}>
                {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label>פירוט חיים אישיים</label><textarea className="textarea" rows={2} value={f.bio} onChange={set("bio")} /></div>
          <div className="field"><label>הערות</label><textarea className="textarea" rows={2} value={f.notes} onChange={set("notes")} /></div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleSave}>שמירה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Volunteer quick info modal ===== */
function VolunteerQuickModal({ entry, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>פרופיל מתנדב — {entry.volName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="detail-grid">
            <div className="item"><label>שם מתנדב</label><div>{entry.volName}</div></div>
            <div className="item"><label>משויך ל</label><div>{fullName(entry)}</div></div>
            <div className="item"><label>אזור</label><div>{entry.area}</div></div>
            <div className="item"><label>שכונה</label><div>{entry.neighborhood}</div></div>
            <div className="item"><label>סטטוס שיוך</label><div>{entry.volStatus}</div></div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Contact person quick info modal ===== */
function ContactQuickModal({ entry, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>איש קשר — {entry.contactPersonName || "—"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="form-section">
          <div className="detail-grid">
            <div className="item"><label>שם איש קשר</label><div>{entry.contactPersonName || "—"}</div></div>
            <div className="item"><label>סוג קשר</label><div>{entry.contactPersonRelationType || "—"}</div></div>
            <div className="item"><label>טלפון</label><div>{entry.contactPersonPhone || "—"}</div></div>
            <div className="item"><label>מייל</label><div>{entry.contactPersonEmail || "—"}</div></div>
            <div className="item"><label>סטטוס</label><div>{entry.contactPersonStatus || "—"}</div></div>
            <div className="item"><label>שייך ל</label><div>{fullName(entry)}</div></div>
          </div>
          {entry.contactPersonNotes && (
            <div className="field" style={{ marginTop: 10 }}>
              <label>הערות</label>
              <div>{entry.contactPersonNotes}</div>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>סגירה</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Print / report modal ===== */
function PrintReportModal({ items, onClose }) {
  const { areaNames, getNeighborhoods } = useAreasAndNeighborhoods();
  const [sel, setSel] = useState({ area: "", neighborhood: "", volStatus: "", marital: "", assistance: "" });
  const [showPreview, setShowPreview] = useState(false);

  const filtered = useMemo(
    () =>
      items.filter((e) => {
        if (sel.area && e.area !== sel.area) return false;
        if (sel.neighborhood && e.neighborhood !== sel.neighborhood) return false;
        if (sel.volStatus && e.volStatus !== sel.volStatus) return false;
        if (sel.marital && e.marital !== sel.marital) return false;
        if (sel.assistance && !(e.assistance || "").includes(sel.assistance)) return false;
        return true;
      }),
    [items, sel],
  );

  const setF = (k) => (e) => {
    const value = e.target.value;
    if (k === "area") {
      const validNb = getNeighborhoods(value).includes(sel.neighborhood);
      setSel({ ...sel, area: value, neighborhood: validNb ? sel.neighborhood : "" });
      return;
    }
    setSel({ ...sel, [k]: value });
  };


  const handleDownload = () => {
    const headers = ["שם", "ת.ז", "אזור", "שכונה", "טלפון", "סטטוס מתנדב", "מצב משפחתי", "סיוע", "סטטוס"];
    const rows = filtered.map((e) => [
      fullName(e), e.idNum, e.area, e.neighborhood,
      e.mobile || e.homePhone, e.volStatus, e.marital, e.assistance, e.status,
    ]);
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "elderly-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filterDefs = [
    ["area", "אזור", areaNames],
    ["neighborhood", "שכונה", getNeighborhoods(sel.area)],
    ["volStatus", "סטטוס מתנדב", VOLUNTEER_STATUS_OPTIONS],
    ["marital", "מצב משפחתי", MARITAL_OPTIONS],
    ["assistance", "סיוע", ASSISTANCE_OPTIONS],
  ];


  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980 }}>
        <div className="modal-header">
          <h2>הכנת דוח אזרחים ותיקים</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-section no-print">
          <h4>סינון לדוח</h4>
          <div className="filters-row">
            {filterDefs.map(([key, label, opts]) => (
              <select key={key} className="filter-pill" value={sel[key]} onChange={setF(key)}>
                <option value="">{label}</option>
                {opts.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
          </div>
        </div>

        {showPreview && (
          <div className="form-section">
            <h4>תצוגה מקדימה ({filtered.length} אזרחים ותיקים)</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שם</th><th>אזור</th><th>שכונה</th><th>טלפון</th>
                    <th>סטטוס מתנדב</th><th>מצב משפחתי</th><th>סיוע</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td>{fullName(e)}</td>
                      <td>{e.area}</td>
                      <td>{e.neighborhood}</td>
                      <td>{e.mobile || e.homePhone || "—"}</td>
                      <td>{e.volStatus}</td>
                      <td>{e.marital}</td>
                      <td>{e.assistance || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="modal-actions no-print">
          <button className="btn btn-primary" onClick={() => setShowPreview(true)}>תצוגה מקדימה</button>
          <button className="btn" onClick={handleDownload}>הורדת דוח</button>
          <button className="btn" onClick={() => window.print()}>הדפסה</button>
          <button className="btn" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Searchable volunteer dropdown =====
   Loads from the volunteers collection (passed in via props). Lets the admin
   search by name/phone/neighborhood and pick "ללא מתנדב" to clear. */
function VolunteerSelect({ volunteers, loading, error, valueId, valueName, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const vName = (v) => `${v.firstName || ""} ${v.lastName || ""}`.trim() || v.name || "";
  const vPhone = (v) => v.mobile || v.phone || "";
  const vArea = (v) => v.neighborhood || v.area || "";
  const vStatus = (v) => v.status || "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return volunteers;
    return volunteers.filter((v) => {
      const hay = [vName(v), vPhone(v), vArea(v), vStatus(v)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [volunteers, query]);

  const selected = valueId ? volunteers.find((v) => v.id === valueId) : null;
  const displayText = selected
    ? `${vName(selected)}${vPhone(selected) ? " — " + vPhone(selected) : ""}${vArea(selected) ? " — " + vArea(selected) : ""}`
    : valueName
      ? `${valueName} (לא ברשימה)`
      : "בחר/י מתנדב מהרשימה";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="select"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", textAlign: "start", cursor: "pointer", background: "#fff", paddingInlineEnd: 28 }}
      >
        {loading ? "טוען מתנדבים…" : displayText}
      </button>
      <span aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#6b7280" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </span>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            insetInlineStart: 0,
            insetInlineEnd: 0,
            zIndex: 50,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,.12)",
            maxHeight: 320,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
            <input
              className="input"
              autoFocus
              placeholder="חיפוש לפי שם, טלפון או שכונה…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div style={{ overflowY: "auto", maxHeight: 240 }}>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setQuery(""); }}
              style={optionStyle(!valueId)}
            >
              ללא מתנדב
            </button>

            {error && (
              <div style={{ padding: 12, color: "#b91c1c", fontSize: 13 }}>{error}</div>
            )}
            {!error && loading && (
              <div style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>טוען מתנדבים…</div>
            )}
            {!error && !loading && filtered.length === 0 && (
              <div style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>
                {volunteers.length === 0 ? "לא נמצאו מתנדבים במערכת" : "לא נמצאו תוצאות"}
              </div>
            )}
            {!loading && filtered.map((v) => {
              const isSel = v.id === valueId;
              const parts = [vName(v), vPhone(v), vArea(v), vStatus(v)].filter(Boolean);
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { onChange(v); setOpen(false); setQuery(""); }}
                  style={optionStyle(isSel)}
                >
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{vName(v) || "—"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {parts.slice(1).join(" — ") || "—"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function optionStyle(active) {
  return {
    display: "block",
    width: "100%",
    textAlign: "start",
    padding: "8px 12px",
    background: active ? "#eff6ff" : "transparent",
    border: "none",
    borderBottom: "1px solid #f8fafc",
    cursor: "pointer",
  };
}

/* ===== Searchable contact-person dropdown =====
   Loads from elderlyContactPersons. Lets the admin search by name/phone/relation
   type and pick "ללא איש קשר" to clear. Only selects existing contact persons. */
function ContactPersonSelect({ contactPersons, loading, error, valueId, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const cName = (c) => c.fullName || `${c.firstName || ""} ${c.lastName || ""}`.trim();
  const cPhone = (c) => c.phone || "";
  const cRel = (c) => c.relationType || "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contactPersons;
    return contactPersons.filter((c) =>
      [cName(c), cPhone(c), cRel(c)].join(" ").toLowerCase().includes(q),
    );
  }, [contactPersons, query]);

  const selected = valueId ? contactPersons.find((c) => c.id === valueId) : null;
  const displayText = selected
    ? `${cName(selected)}${cPhone(selected) ? " — " + cPhone(selected) : ""}${cRel(selected) ? " — " + cRel(selected) : ""}`
    : "בחר/י איש קשר מהרשימה";

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="select"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", textAlign: "start", cursor: "pointer", background: "#fff", paddingInlineEnd: 28 }}
      >
        {loading ? "טוען אנשי קשר…" : displayText}
      </button>
      <span aria-hidden="true" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#6b7280" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </span>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            insetInlineStart: 0,
            insetInlineEnd: 0,
            zIndex: 50,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,.12)",
            maxHeight: 320,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
            <input
              className="input"
              autoFocus
              placeholder="חיפוש לפי שם, טלפון או סוג קשר…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div style={{ overflowY: "auto", maxHeight: 240 }}>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setQuery(""); }}
              style={optionStyle(!valueId)}
            >
              ללא איש קשר
            </button>

            {error && (
              <div style={{ padding: 12, color: "#b91c1c", fontSize: 13 }}>{error}</div>
            )}
            {!error && loading && (
              <div style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>טוען אנשי קשר…</div>
            )}
            {!error && !loading && filtered.length === 0 && (
              <div style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>
                {contactPersons.length === 0 ? "לא נמצאו אנשי קשר במערכת" : "לא נמצאו תוצאות"}
              </div>
            )}
            {!loading && filtered.map((c) => {
              const isSel = c.id === valueId;
              const parts = [cPhone(c), cRel(c)].filter(Boolean);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); setQuery(""); }}
                  style={optionStyle(isSel)}
                >
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>{cName(c) || "—"}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {parts.join(" — ") || "—"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
