import { useEffect, useState, useMemo } from "react";
import AdminPageLayout from "@/components/admin/AdminPageLayout.jsx";
import { Coins, Heart } from "lucide-react";
import {
  subscribeFinancialTransactions,
  createFinancialTransaction,
  updateFinancialTransaction,
  deleteFinancialTransaction,
  uploadReceiptFile,
} from "@/services/financialService";

export default function Financial() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("transactions");

  // Basic Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterYear, setFilterYear] = useState("all"); // حالة جديدة لفلتر السنة

  // Advanced Filters
  const [filterFundingSource, setFilterFundingSource] = useState("all");
  const [filterProject, setFilterProject] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");

  const [receiptSearchTerm, setReceiptSearchTerm] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditReceiptModalOpen, setIsEditReceiptModalOpen] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false); // حالة جديدة لاقتراحات المشاريع

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [deleteReceiptData, setDeleteReceiptData] = useState(null);

  const [formData, setFormData] = useState({
    type: "תרומה",
    amount: "",
    fundingSource: "כללי",
    source: "",
    project: "",
    date: new Date().toISOString().split("T")[0],
    receipt: "",
    notes: "",
    paymentMethod: "העברה בנקאית",
    otherPaymentMethod: "",
  });

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadData, setUploadData] = useState({ receiptName: "", receiptNumber: "", transactionId: "" });
  const [editReceiptData, setEditReceiptData] = useState(null);

  // ==========================================
  // FIREBASE DATA FETCHING
  // ==========================================
  useEffect(() => {
    const unsubscribe = subscribeFinancialTransactions(
      (dataList) => setTransactions(dataList),
      (error) => console.error("Error fetching financial data:", error)
    );
    return () => unsubscribe();
  }, []);

  // ==========================================
  // CALCULATIONS & FILTERING
  // ==========================================
  // استخراج السنوات المتاحة من البيانات
  const availableYears = useMemo(() => {
    const years = transactions.filter(t => t.date).map(t => t.date.substring(0, 4));
    return ["all", ...new Set(years)].sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  // تحديث الحسابات لتأخذ فلتر السنة بعين الاعتبار
  const globalTotals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let donations = 0;
    transactions.forEach((item) => {
      if (item.type === "קבלה_בלבד") return;

      // تطبيق فلتر السنة على الإحصائيات العلوية
      if (filterYear !== "all" && item.date && !item.date.startsWith(filterYear)) return;

      const amountVal = parseFloat(item.amount) || 0;
      if (item.type === "הוצאה") expenses += amountVal;
      else if (item.type === "תרומה") {
        income += amountVal;
        donations += amountVal;
      } else if (item.type === "הכנסה") income += amountVal;
    });
    return { income, expenses, donations, balance: income - expenses };
  }, [transactions, filterYear]);

  const uniqueSources = useMemo(() => {
    const sourcesList = transactions.filter((t) => t.type !== "קבלה_בלבד" && t.source).map((t) => t.source.trim());
    return [...new Set(sourcesList)];
  }, [transactions]);

  // استخراج المشاريع الفريدة للقائمة المنسدلة
  const uniqueProjects = useMemo(() => {
    const projs = transactions.filter(t => t.type !== "קבלה_בלבד" && t.project).map(t => t.project.trim());
    return [...new Set(projs)].filter(p => p !== "");
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type === "קבלה_בלבד") return false;

      // تطبيق فلتر السنة على الجدول
      const matchesYear = filterYear === "all" || (t.date && t.date.startsWith(filterYear));

      const matchesType = filterType === "all" || t.type === filterType;
      const matchesFundingSource = filterFundingSource === "all" || t.fundingSource === filterFundingSource;
      const matchesProject =
        !filterProject || (t.project && t.project.toLowerCase().includes(filterProject.toLowerCase()));

      const amt = parseFloat(t.amount) || 0;
      const min = parseFloat(filterMinAmount);
      const max = parseFloat(filterMaxAmount);
      const matchesMin = isNaN(min) || amt >= min;
      const matchesMax = isNaN(max) || amt <= max;

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (t.source && t.source.toLowerCase().includes(searchLower)) ||
        (t.receipt && t.receipt.toLowerCase().includes(searchLower)) ||
        (t.notes && t.notes.toLowerCase().includes(searchLower)) ||
        (t.receiptName && t.receiptName.toLowerCase().includes(searchLower));

      return matchesYear && matchesType && matchesFundingSource && matchesProject && matchesMin && matchesMax && matchesSearch;
    });
  }, [transactions, filterType, filterFundingSource, filterProject, filterMinAmount, filterMaxAmount, searchTerm, filterYear]);

  const uploadedReceipts = useMemo(() => {
    let allReceipts = [];
    transactions.forEach((t) => {
      if (t.receiptUrl || t.type === "קבלה_בלבד") {
        allReceipts.push({
          ...t,
          archiveId: t.id + "_legacy",
          isStandalone: t.type === "קבלה_בלבד",
          isAttachment: false,
        });
      }
      if (t.attachments && t.attachments.length > 0) {
        t.attachments.forEach((att) => {
          allReceipts.push({
            ...t,
            archiveId: t.id + "_" + att.id,
            receiptUrl: att.url,
            receiptName: att.name,
            receipt: att.number,
            isStandalone: false,
            isAttachment: true,
            attachmentId: att.id,
          });
        });
      }
    });
    const searchLower = receiptSearchTerm.toLowerCase();
    return allReceipts.filter(
      (r) =>
        (r.receiptName && r.receiptName.toLowerCase().includes(searchLower)) ||
        (r.receipt && r.receipt.toLowerCase().includes(searchLower)) ||
        (r.source && r.source.toLowerCase().includes(searchLower)),
    );
  }, [transactions, receiptSearchTerm]);

  // ==========================================
  // CRUD & UPLOAD OPERATIONS
  // ==========================================
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.source) return;
    setIsSubmitting(true);
    try {
      const newTransaction = {
        type: formData.type,
        amount: parseFloat(formData.amount),
        fundingSource: formData.fundingSource,
        source: formData.source.trim(),
        project: formData.project.trim(),
        date: formData.date,
        receipt: formData.receipt.trim(),
        receiptUrl: "",
        receiptName: "",
        notes: formData.notes.trim(),
      };

      if (formData.type === "תרומה" || formData.type === "הכנסה") {
        if (formData.paymentMethod === "אחר" && formData.otherPaymentMethod.trim() !== "") {
          newTransaction.paymentMethod = `אחר - ${formData.otherPaymentMethod.trim()}`;
        } else {
          newTransaction.paymentMethod = formData.paymentMethod;
        }
      }

      await createFinancialTransaction(newTransaction);
      setIsAddModalOpen(false);
      setFormData({
        type: "תרומה",
        amount: "",
        fundingSource: "כללי",
        source: "",
        project: "",
        date: new Date().toISOString().split("T")[0],
        receipt: "",
        notes: "",
        paymentMethod: "העברה בנקאית",
        otherPaymentMethod: "",
      });
      showToast("הפעולה נשמרה בהצלחה!");
    } catch (error) {
      alert("שגיאה בשמירת הנתונים.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteFinancialTransaction(id);
      setDeleteId(null);
      showToast("הפעולה נמחקה מהמערכת!");
    } catch (error) {
      alert("שגיאה במחיקת הפעולה.");
    }
  };

  const handleUploadReceipt = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert("נא לבחור קובץ תחילה");
      return;
    }
    setIsUploading(true);
    try {
      const { url: downloadUrl } = await uploadReceiptFile(uploadFile);

      const finalReceiptName = uploadData.receiptName.trim() || uploadFile.name;
      const finalReceiptNum = uploadData.receiptNumber.trim() || "ללא מספר";

      if (uploadData.transactionId) {
        const tx = transactions.find((t) => t.id === uploadData.transactionId);
        const currentAttachments = tx.attachments || [];
        const newAttachment = {
          url: downloadUrl,
          name: finalReceiptName,
          number: finalReceiptNum,
          id: Date.now().toString(),
        };
        await updateFinancialTransaction(uploadData.transactionId, {
          attachments: [...currentAttachments, newAttachment],
        });
      } else {
        await createFinancialTransaction({
          type: "קבלה_בלבד",
          amount: 0,
          source: "—",
          project: "—",
          date: new Date().toISOString().split("T")[0],
          receiptUrl: downloadUrl,
          receiptName: finalReceiptName,
          receipt: finalReceiptNum,
          notes: "קבלה עצמאית במאגר",
        });
      }
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadData({ receiptName: "", receiptNumber: "", transactionId: "" });
      showToast("הקבלה הועלתה וצורפה בהצלחה!");
      setActiveTab("receipts");
    } catch (error) {
      alert("שגיאה בהעלאת הקובץ.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditReceiptLinkage = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { id, isStandalone, isAttachment, attachmentId, receiptUrl, receiptName, receipt } = editReceiptData;
      const oldTxId = id;
      const newTxId = uploadData.transactionId;

      if (oldTxId === newTxId && !isStandalone) {
        setIsEditReceiptModalOpen(false);
        setIsSubmitting(false);
        return;
      }

      if (isStandalone) {
        if (newTxId) {
          await updateFinancialTransaction(newTxId, { receiptUrl, receiptName, receipt });
          await deleteFinancialTransaction(oldTxId);
        }
      } else {
        if (newTxId) {
          await updateFinancialTransaction(newTxId, { receiptUrl, receiptName, receipt });
          await updateFinancialTransaction(oldTxId, { receiptUrl: "", receiptName: "", receipt: "" });
        } else {
          await createFinancialTransaction({
            type: "קבלה_בלבד",
            amount: 0,
            source: "—",
            project: "—",
            date: new Date().toISOString().split("T")[0],
            receiptUrl,
            receiptName,
            receipt,
            notes: "קבלה עצמאית במאגר",
          });
          await updateFinancialTransaction(oldTxId, { receiptUrl: "", receiptName: "", receipt: "" });
        }
      }
      setIsEditReceiptModalOpen(false);
      showToast("שיוך הקבלה עודכן בהצלחה!");
    } catch (error) {
      alert("שגיאה בעדכון השיוך.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReceiptConfirm = async () => {
    if (!deleteReceiptData) return;
    try {
      if (deleteReceiptData.isStandalone) {
        await deleteFinancialTransaction(deleteReceiptData.id);
      } else if (deleteReceiptData.isAttachment) {
        const tx = transactions.find((t) => t.id === deleteReceiptData.id);
        const updatedAttachments = tx.attachments.filter((a) => a.id !== deleteReceiptData.attachmentId);
        await updateFinancialTransaction(deleteReceiptData.id, { attachments: updatedAttachments });
      } else {
        await updateFinancialTransaction(deleteReceiptData.id, { receiptUrl: "", receiptName: "" });
      }
      setDeleteReceiptData(null);
      showToast("הקבלה הוסרה בהצלחה!");
    } catch (error) {
      alert("שגיאה במחיקת הקבלה.");
    }
  };

  const exportToCSV = () => {
    const BOM = "\uFEFF";
    const header = "סוג,סכום,מקור,שם/ספק,פרויקט,תאריך,מספר קבלה,הערות\n";
    const rows = filteredTransactions
      .map((t) => {
        let receiptText = t.receipt || "";
        if (t.attachments && t.attachments.length > 0) {
          receiptText = t.attachments.map((a) => a.number || a.name).join(" | ");
        }
        const fundSrc = t.fundingSource || "—";
        return `"${t.type}","${t.amount}","${fundSrc}","${t.source}","${t.project}","${t.date}","${receiptText}","${t.notes}"`;
      })
      .join("\n");
    const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    // تم إضافة فلتر السنة لاسم الملف
    link.download = `דוח_כספי_${filterYear === "all" ? "כל_השנים" : filterYear}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);

  const getBadgeStyle = (type) => {
    if (type === "תרומה") return { backgroundColor: "#e8f5e9", color: "#1e6b2c" };
    if (type === "הוצאה") return { backgroundColor: "#fdecec", color: "#dc3545" };
    if (type === "הכנסה") return { backgroundColor: "#e2e3e5", color: "#383d41" };
    return {};
  };

  return (
    <AdminPageLayout heroImage="/admin-heroes/finance_hero.png"
      title="ניהול כספי"
      subtitle="מעקב אחר הכנסות, הוצאות ודוחות כספיים"
      actions={
        <div style={{ display: "flex", gap: "14px", direction: "rtl", alignItems: "center" }}>
          
          {/* --- القائمة المنسدلة لاختيار السنة --- */}
          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(e.target.value)}
            style={{
              padding: "8px 16px", borderRadius: "30px", border: "1px solid #cbd5e1", 
              backgroundColor: "#fff", color: "#475569", fontWeight: "600", fontSize: "14px",
              outline: "none", cursor: "pointer", marginLeft: "10px"
            }}
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year === "all" ? "כל השנים" : `שנת ${year}`}</option>
            ))}
          </select>

          <button onClick={() => setIsAddModalOpen(true)} className="action-btn-primary">
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
            הוספת פעולה כספית
          </button>
          <button onClick={() => setIsUploadModalOpen(true)} className="action-btn-secondary">
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            העלאת קבלה
          </button>
          <button onClick={exportToCSV} className="action-btn-tertiary" title="ייצוא לאקסל">
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            ייצוא
          </button>
        </div>
      }
    >
      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; transition: background 0.2s; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        /* --- CSS الخاص ببانر التحذير --- */
        .fin-alert-banner {
          background-color: #fef2f2;
          border: 1px solid #f87171;
          border-right: 4px solid #dc3545;
          color: #991b1b;
          padding: 16px 20px;
          border-radius: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 14.5px;
          box-shadow: 0 4px 6px -1px rgba(220, 53, 69, 0.1);
          animation: fadeInDown 0.4s ease-out;
          direction: rtl;
        }
        .fin-alert-banner svg { color: #dc3545; flex-shrink: 0; }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        .fin-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 24px; direction: rtl; }
        .fin-stat-card { background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 10px rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: flex-start; transition: all 0.2s; }
        .fin-stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(139,44,44,0.05); }
        .fin-label { color: #64748b; font-size: 14px; font-weight: 600; margin-bottom: 12px; display: block; }
        .fin-value { font-size: 2.2rem; font-weight: bold; color: #8b2c2c; letter-spacing: -0.5px; }
        .fin-icon-box { width: 48px; height: 48px; border-radius: 50%; background-color: #f8fafc; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        
        .fin-combined-wrapper { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.03); direction: rtl; overflow: hidden; margin-bottom: 40px; min-height: 400px; }
        .segmented-tabs-container { display: flex; justify-content: center; padding: 20px 0; background: #fafbfc; border-bottom: 1px solid #e2e8f0; }
        .segmented-control { display: inline-flex; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #f1f5f9; padding: 4px; gap: 4px;}
        .segment-btn { padding: 10px 36px; font-size: 14.5px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; background: transparent; color: #64748b; outline: none; }
        .segment-btn.active { background: #fff; color: #8b2c2c; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
        .segment-btn:hover:not(.active) { color: #334155; }

        .filter-section { padding: 20px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; flex-direction: column; gap: 16px; }
        .filter-row-1 { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        .filter-row-2 { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: #fff; padding: 12px 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
        
        .filter-pills-container { display: flex; gap: 6px; background: #fff; border: 1px solid #e2e8f0; padding: 6px; border-radius: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .filter-btn { padding: 8px 24px; border-radius: 30px; font-weight: 600; font-size: 13.5px; cursor: pointer; border: none; background: transparent; color: #64748b; transition: all 0.2s; }
        .filter-btn:hover:not(.active) { color: #0f172a; background: #f1f5f9; }
        .filter-btn.active { background: #8b2c2c; color: #fff; box-shadow: 0 2px 6px rgba(139,44,44,0.25); }
        
        .search-input-wrapper { position: relative; flex-grow: 1; max-width: 320px; }
        .search-input { width: 100%; padding: 12px 40px 12px 16px; border-radius: 30px; border: 1px solid #cbd5e1; outline: none; font-size: 14px; transition: all 0.2s; box-sizing: border-box; background: #fff; }
        .search-input:focus { border-color: #8b2c2c; box-shadow: 0 0 0 3px rgba(139,44,44,0.1); }
        .search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }

        .adv-filter-group { display: flex; align-items: center; gap: 8px; }
        .adv-filter-label { font-size: 13px; font-weight: 600; color: #475569; white-space: nowrap; }
        .adv-filter-input { padding: 8px 12px; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 13px; outline: none; transition: 0.2s; background: #f8fafc; }
        .adv-filter-input:focus { border-color: #8b2c2c; background: #fff; }

        .fin-table { width: 100%; border-collapse: collapse; }
        .fin-table th { background: #f1f5f9; padding: 16px 24px; text-align: right; color: #475569; font-size: 13.5px; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
        .fin-table td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; vertical-align: middle; }
        .fin-table tr:nth-child(even) { background-color: #fafbfc; }
        .fin-table tr:hover { background-color: #f1f5f9; }
        
        .type-badge { padding: 6px 14px; border-radius: 30px; font-weight: bold; font-size: 12.5px; display: inline-block; text-align: center; }
        .action-icon-btn { background: #fff; border: 1px solid #e2e8f0; cursor: pointer; color: #64748b; padding: 8px; border-radius: 8px; transition: 0.2s; display: inline-flex; justify-content: center; align-items: center; }
        .action-icon-btn:hover { color: #dc3545; background: #fdecec; border-color: #f5c6cb; }
        .action-icon-edit:hover { color: #0284c7; background: #f0f9ff; border-color: #bae6fd; }
        
        .receipts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; padding: 24px; background: #fff; }
        .receipt-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; display: flex; gap: 16px; align-items: center; transition: 0.2s; background: #fff; }
        .receipt-card:hover { border-color: #8b2c2c; box-shadow: 0 4px 12px rgba(139,44,44,0.08); transform: translateY(-2px); }
        .receipt-icon { width: 52px; height: 52px; border-radius: 12px; background: #fef2f2; color: #dc3545; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .receipt-info { flex-grow: 1; overflow: hidden; }
        .receipt-title { font-weight: bold; color: #0f172a; font-size: 14.5px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .receipt-sub { font-size: 12.5px; color: #64748b; margin-top: 3px; }
        .receipt-actions { display: flex; gap: 6px; align-items: center; flex-direction: column; }
        .dl-btn { padding: 8px; border-radius: 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; color: #8b2c2c; transition: 0.2s; display: flex; }
        .dl-btn:hover { background-color: #f1f5f9; border-color: #cbd5e1; }

        .file-upload-box { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 32px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; background: #f8fafc; cursor: pointer; transition: 0.2s; margin-bottom: 20px; }
        .file-upload-box:hover { border-color: #8b2c2c; background: #fff; }
        .file-upload-box input { display: none; }

        .modal-form-select {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: left 12px center;
            padding-left: 40px;
            width: 100%;
            padding-top: 12px;
            padding-bottom: 12px;
            padding-right: 16px;
            border-radius: 10px;
            border: 1px solid #cbd5e1;
            outline: none;
            background-color: #fff;
            font-size: 14px;
            font-family: inherit;
            transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
        }
        .modal-form-select:focus { border-color: #8b2c2c; box-shadow: 0 0 0 3px rgba(139,44,44,0.1); }

        .autocomplete-wrapper { position: relative; width: 100%; }
        .autocomplete-dropdown { 
          position: absolute; top: 100%; left: 0; right: 0; 
          background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; 
          margin-top: 4px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
          z-index: 50; max-height: 180px; overflow-y: auto; 
          list-style: none; padding: 0; 
        }
        .autocomplete-item { 
          padding: 10px 16px; cursor: pointer; color: #334155; font-size: 14px; 
          border-bottom: 1px solid #f1f5f9; transition: background 0.2s;
        }
        .autocomplete-item:last-child { border-bottom: none; }
        .autocomplete-item:hover { background: #f8fafc; color: #8b2c2c; font-weight: bold; }

        .toast-msg { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background-color: #1e6b2c; color: white; padding: 12px 24px; border-radius: 30px; font-weight: bold; font-size: 14px; box-shadow: 0 10px 20px rgba(30,107,44,0.3); z-index: 5000; animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 30px; opacity: 1; } }
      `}</style>

      {toastMessage && <div className="toast-msg">✓ {toastMessage}</div>}

      {/* --- شريط التحذير الجديد يظهر فقط إذا كان الرصيد أقل من صفر --- */}
      {globalTotals.balance < 0 && (
        <div className="fin-alert-banner">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div>
            <strong>שים לב: </strong>
            קופת הארגון נמצאת בגירעון (מינוס). יש לעקוב אחר ההוצאות.
          </div>
        </div>
      )}

      <div className="fin-stats-grid">
        <div className="fin-stat-card">
          <div>
            <span className="fin-label">סה״כ הכנסות</span>
            <span className="fin-value">{formatCurrency(globalTotals.income)}</span>
          </div>
          <div className="fin-icon-box"><Coins size={22} style={{ color: "#2e7d32" }} /></div>
        </div>
        <div className="fin-stat-card">
          <div>
            <span className="fin-label">סה״כ הוצאות</span>
            <span className="fin-value" style={{ color: "#dc3545" }}>
              {formatCurrency(globalTotals.expenses)}
            </span>
          </div>
          <div className="fin-icon-box"><Coins size={22} style={{ color: "#dc3545" }} /></div>
        </div>
        <div className="fin-stat-card">
          <div>
            <span className="fin-label">סך תרומות</span>
            <span className="fin-value" style={{ color: "#8b2c2c" }}>
              {formatCurrency(globalTotals.donations)}
            </span>
          </div>
          <div className="fin-icon-box"><Heart size={22} fill="#8b2c2c" color="#8b2c2c" /></div>
        </div>
        <div
          className="fin-stat-card"
          style={{
            borderColor: globalTotals.balance < 0 ? "#dc3545" : "#8b2c2c",
            background: globalTotals.balance < 0 ? "#fdf2f2" : "#fffefc",
          }}
        >
          <div>
            <span className="fin-label" style={{ color: globalTotals.balance < 0 ? "#dc3545" : "#8b2c2c" }}>
              יתרה נוכחית
            </span>
            <span className="fin-value" style={{ color: globalTotals.balance < 0 ? "#dc3545" : "#1e6b2c" }}>
              {formatCurrency(globalTotals.balance)}
            </span>
          </div>
          <div
            className="fin-icon-box"
            style={{ backgroundColor: globalTotals.balance < 0 ? "#dc3545" : "#8b2c2c", color: "white" }}
          >
            📊
          </div>
        </div>
      </div>

      <div className="fin-combined-wrapper">
        <div className="segmented-tabs-container">
          <div className="segmented-control">
            <button
              className={`segment-btn ${activeTab === "transactions" ? "active" : ""}`}
              onClick={() => setActiveTab("transactions")}
            >
              פעולות כספיות
            </button>
            <button
              className={`segment-btn ${activeTab === "receipts" ? "active" : ""}`}
              onClick={() => setActiveTab("receipts")}
            >
              מאגר קבלות ({uploadedReceipts.length})
            </button>
          </div>
        </div>

        {activeTab === "transactions" && (
          <>
            <div className="filter-section">
              <div className="filter-row-1">
                <div className="filter-pills-container">
                  <button
                    className={`filter-btn ${filterType === "all" ? "active" : ""}`}
                    onClick={() => setFilterType("all")}
                  >
                    הכל
                  </button>
                  <button
                    className={`filter-btn ${filterType === "תרומה" ? "active" : ""}`}
                    onClick={() => setFilterType("תרומה")}
                  >
                    תרומות
                  </button>
                  <button
                    className={`filter-btn ${filterType === "הכנסה" ? "active" : ""}`}
                    onClick={() => setFilterType("הכנסה")}
                  >
                    הכנסות כלליות
                  </button>
                  <button
                    className={`filter-btn ${filterType === "הוצאה" ? "active" : ""}`}
                    onClick={() => setFilterType("הוצאה")}
                  >
                    הוצאות
                  </button>
                </div>
                <div className="search-input-wrapper">
                  <svg
                    className="search-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  <input
                    type="text"
                    placeholder="חיפוש חופשי..."
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="filter-row-2">
                <div className="adv-filter-group">
                  <span className="adv-filter-label">סינון לפי מקור:</span>
                  <select
                    className="adv-filter-input"
                    style={{ appearance: "auto" }}
                    value={filterFundingSource}
                    onChange={(e) => setFilterFundingSource(e.target.value)}
                  >
                    <option value="all">הכל</option>
                    <option value="אגף/גוף">אגף / גוף</option>
                    <option value="תורם קבוע">תורם קבוע</option>
                    <option value="כללי">כללי</option>
                  </select>
                </div>
                <div className="adv-filter-group" style={{ borderRight: "1px solid #e2e8f0", paddingRight: "16px" }}>
                  <span className="adv-filter-label">פרויקט:</span>
                  <input
                    type="text"
                    className="adv-filter-input"
                    placeholder="שם פרויקט..."
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    style={{ width: "120px" }}
                  />
                </div>
                <div className="adv-filter-group" style={{ borderRight: "1px solid #e2e8f0", paddingRight: "16px" }}>
                  <span className="adv-filter-label">סכום מ- (₪):</span>
                  <input
                    type="number"
                    className="adv-filter-input"
                    placeholder="0"
                    value={filterMinAmount}
                    onChange={(e) => setFilterMinAmount(e.target.value)}
                    style={{ width: "90px" }}
                  />
                  <span className="adv-filter-label" style={{ marginLeft: "4px" }}>
                    עד:
                  </span>
                  <input
                    type="number"
                    className="adv-filter-input"
                    placeholder="100,000"
                    value={filterMaxAmount}
                    onChange={(e) => setFilterMaxAmount(e.target.value)}
                    style={{ width: "90px" }}
                  />
                </div>
              </div>
            </div>

            <div className="custom-scroll" style={{ overflowX: "auto", maxHeight: "450px" }}>
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>סוג</th>
                    <th>סכום</th>
                    <th>מקור</th>
                    <th>שם / ספק</th>
                    <th>פרויקט</th>
                    <th>תאריך</th>
                    <th>קבלה/חשבונית</th>
                    <th style={{ textAlign: "center" }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((item) => (
                      <tr key={item.id}>
                        <td style={{ width: "90px" }}>
                          <span className="type-badge" style={getBadgeStyle(item.type)}>
                            {item.type}
                          </span>
                          {item.paymentMethod && item.paymentMethod !== "לא צוין" && (
                            <div style={{ fontSize: "11px", color: "#6c757d", marginTop: "4px", textAlign: "center" }}>
                              {item.paymentMethod}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            fontWeight: "bold",
                            fontSize: "15px",
                            color: item.type === "הוצאה" ? "#dc3545" : "#0f172a",
                          }}
                        >
                          {formatCurrency(item.amount)}
                        </td>
                        <td style={{ fontWeight: "500", color: "#475569" }}>{item.fundingSource || "כללי"}</td>
                        <td style={{ fontWeight: "600", color: "#334155" }}>{item.source}</td>
                        <td style={{ color: "#64748b" }}>{item.project || "—"}</td>
                        <td style={{ color: "#64748b" }}>{item.date}</td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {item.receiptUrl && (
                              <a
                                href={item.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  color: "#8b2c2c",
                                  fontWeight: "bold",
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  backgroundColor: "#fef2f2",
                                  padding: "4px 10px",
                                  borderRadius: "8px",
                                  width: "fit-content",
                                }}
                                title="צפה בקובץ"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14 2 14 8 20 8"></polyline>
                                </svg>
                                {item.receiptName || item.receipt || "מסמך מצורף"}
                              </a>
                            )}
                            {item.attachments &&
                              item.attachments.map((att) => (
                                <a
                                  key={att.id}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "#8b2c2c",
                                    fontWeight: "bold",
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    backgroundColor: "#fef2f2",
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    width: "fit-content",
                                  }}
                                  title="צפה בקובץ"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                  </svg>
                                  {att.name || att.number || "מסמך מצורף"}
                                </a>
                              ))}
                            {!item.receiptUrl &&
                              (!item.attachments || item.attachments.length === 0) &&
                              (item.receipt ? (
                                <span style={{ fontWeight: "500", color: "#64748b" }}>{item.receipt}</span>
                              ) : (
                                "—"
                              ))}
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button className="action-icon-btn" onClick={() => setDeleteId(item.id)} title="מחק פעולה זו">
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
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="8"
                        style={{ textAlign: "center", padding: "60px", color: "#94a3b8", fontSize: "15px" }}
                      >
                        לא נמצאו פעולות התואמות לסינון.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ... (Receipts Tab) ... */}
        {activeTab === "receipts" && (
          <>
            <div className="filter-section" style={{ justifyContent: "flex-end" }}>
              <div className="search-input-wrapper" style={{ maxWidth: "350px" }}>
                <svg
                  className="search-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="חיפוש קבלה לפי שם, מספר או מקור..."
                  className="search-input"
                  value={receiptSearchTerm}
                  onChange={(e) => setReceiptSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="receipts-grid">
              {uploadedReceipts.length > 0 ? (
                uploadedReceipts.map((r) => (
                  <div key={r.archiveId} className="receipt-card">
                    <div className="receipt-icon">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <div className="receipt-info">
                      <div className="receipt-title" title={r.receiptName || r.receipt}>
                        {r.receiptName || r.receipt || "מסמך ללא שם"}
                      </div>
                      <div className="receipt-sub">מספר קבלה: {r.receipt !== "צורף קובץ" ? r.receipt : "—"}</div>
                      {r.isStandalone ? (
                        <div className="receipt-sub" style={{ marginTop: "4px", color: "#475569", fontWeight: "bold" }}>
                          📄 קבלה עצמאית (ללא שיוך)
                        </div>
                      ) : (
                        <div
                          className="receipt-sub"
                          style={{
                            marginTop: "4px",
                            color: r.type === "הוצאה" ? "#dc3545" : "#1e6b2c",
                            fontWeight: "600",
                          }}
                        >
                          משויך ל{r.type}: ₪{r.amount}
                        </div>
                      )}
                    </div>
                    <div className="receipt-actions">
                      <a
                        href={r.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dl-btn"
                        title="צפה או הורד"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </a>
                      <button
                        onClick={() => {
                          setEditReceiptData({
                            id: r.id,
                            isStandalone: r.isStandalone,
                            isAttachment: r.isAttachment,
                            attachmentId: r.attachmentId,
                            receiptUrl: r.receiptUrl,
                            receiptName: r.receiptName,
                            receipt: r.receipt,
                          });
                          setUploadData({ ...uploadData, transactionId: r.isStandalone ? "" : r.id });
                          setIsEditReceiptModalOpen(true);
                        }}
                        className="action-icon-btn action-icon-edit"
                        title="ערוך שיוך קבלה"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteReceiptData({ id: r.id, isStandalone: r.type === "קבלה_בלבד" })}
                        className="action-icon-btn"
                        title="הסר קבלה זו"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px", color: "#94a3b8" }}>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    style={{ marginBottom: "16px", opacity: 0.5 }}
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <div style={{ fontSize: "16px", fontWeight: "600", color: "#475569" }}>
                    לא נמצאו קבלות מתאימות לחיפוש
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isAddModalOpen && (
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
              <h3 style={{ margin: 0, color: "#343a40", fontSize: "1.5rem", fontWeight: "bold" }}>הוספת פעולה כספית</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
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
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#e9ecef")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
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
              <form id="add-transaction-form" onSubmit={handleAddTransaction}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "13.5px",
                        fontWeight: "600",
                        color: "#495057",
                      }}
                    >
                      סוג הפעולה <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <select
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="modal-form-select"
                    >
                      <option value="תרומה">תרומה (הכנסה)</option>
                      <option value="הכנסה">הכנסה כללית</option>
                      <option value="הוצאה">הוצאה</option>
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "13.5px",
                        fontWeight: "600",
                        color: "#495057",
                      }}
                    >
                      סכום (₪) <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        outline: "none",
                        boxSizing: "border-box",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "13.5px",
                        fontWeight: "600",
                        color: "#495057",
                      }}
                    >
                      מקור <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <select
                      required
                      value={formData.fundingSource}
                      onChange={(e) => setFormData({ ...formData, fundingSource: e.target.value })}
                      className="modal-form-select"
                    >
                      <option value="אגף/גוף">אגף / גוף</option>
                      <option value="תורם קבוע">תורם קבוע</option>
                      <option value="כללי">כללי</option>
                    </select>
                  </div>

                  <div className="autocomplete-wrapper">
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "13.5px",
                        fontWeight: "600",
                        color: "#495057",
                      }}
                    >
                      שם / ספק <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.source}
                      onChange={(e) => {
                        setFormData({ ...formData, source: e.target.value });
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      placeholder="התחל להקליד כדי לראות אפשרויות..."
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

                    {showSuggestions &&
                      formData.source &&
                      uniqueSources.filter(
                        (s) => s.toLowerCase().includes(formData.source.toLowerCase()) && s !== formData.source,
                      ).length > 0 && (
                        <ul className="autocomplete-dropdown custom-scroll">
                          {uniqueSources
                            .filter(
                              (s) => s.toLowerCase().includes(formData.source.toLowerCase()) && s !== formData.source,
                            )
                            .map((src, idx) => (
                              <li
                                key={idx}
                                className="autocomplete-item"
                                onClick={() => {
                                  setFormData({ ...formData, source: src });
                                  setShowSuggestions(false);
                                }}
                              >
                                {src}
                              </li>
                            ))}
                        </ul>
                      )}
                  </div>
                </div>

                {(formData.type === "תרומה" || formData.type === "הכנסה") && (
                  <div
                    style={{
                      marginBottom: "20px",
                      padding: "20px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "12px",
                      border: "1px dashed #cbd5e1",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        marginBottom: "10px",
                        fontSize: "13.5px",
                        fontWeight: "600",
                        color: "#8b2c2c",
                      }}
                    >
                      אמצעי תשלום / סוג העברה <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <select
                      required
                      value={formData.paymentMethod}
                      onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                      className="modal-form-select"
                    >
                      <option value="העברה בנקאית">העברה בנקאית</option>
                      <option value="כרטיס אשראי / סליקה">כרטיס אשראי / סליקה</option>
                      <option value="המחאה / צ'ק">המחאה / צ'ק</option>
                      <option value="אפליקציות תשלום (Bit, Paybox)">אפליקציות תשלום (Bit, Paybox)</option>
                      <option value="מזומן">מזומן</option>
                      <option value="גוף ציבורי / מוסד ממשלתי">גוף ציבורי / מוסד ממשלתי</option>
                      <option value="אחר">אחר...</option>
                    </select>

                    {formData.paymentMethod === "אחר" && (
                      <div style={{ marginTop: "16px" }}>
                        <label
                          style={{
                            display: "block",
                            marginBottom: "8px",
                            fontSize: "12.5px",
                            fontWeight: "600",
                            color: "#475569",
                          }}
                        >
                          פירוט אמצעי התשלום (אופציונלי)
                        </label>
                        <input
                          type="text"
                          value={formData.otherPaymentMethod}
                          onChange={(e) => setFormData({ ...formData, otherPaymentMethod: e.target.value })}
                          placeholder="למשל: העברה מחו״ל..."
                          style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            outline: "none",
                            boxSizing: "border-box",
                            fontSize: "14px",
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  
                  {/* --- حقل المشروع تم تحويله إلى قائمة منسدلة ذكية (Autocomplete) --- */}
                  <div className="autocomplete-wrapper">
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "13.5px",
                        fontWeight: "600",
                        color: "#495057",
                      }}
                    >
                      פרויקט משויך
                    </label>
                    <input
                      type="text"
                      value={formData.project}
                      onChange={(e) => {
                        setFormData({ ...formData, project: e.target.value });
                        setShowProjectSuggestions(true);
                      }}
                      onFocus={() => setShowProjectSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowProjectSuggestions(false), 200)}
                      placeholder="הזן פרויקט קיים או חדש..."
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

                    {showProjectSuggestions &&
                      uniqueProjects.filter(
                        (p) => p.toLowerCase().includes(formData.project.toLowerCase()) && p !== formData.project,
                      ).length > 0 && (
                        <ul className="autocomplete-dropdown custom-scroll">
                          {uniqueProjects
                            .filter(
                              (p) => p.toLowerCase().includes(formData.project.toLowerCase()) && p !== formData.project,
                            )
                            .map((proj, idx) => (
                              <li
                                key={idx}
                                className="autocomplete-item"
                                onClick={() => {
                                  setFormData({ ...formData, project: proj });
                                  setShowProjectSuggestions(false);
                                }}
                              >
                                {proj}
                              </li>
                            ))}
                        </ul>
                      )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "13.5px",
                        fontWeight: "600",
                        color: "#495057",
                      }}
                    >
                      תאריך הביצוע <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
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
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13.5px",
                      fontWeight: "600",
                      color: "#495057",
                    }}
                  >
                    מספר קבלה (ידני)
                  </label>
                  <input
                    type="text"
                    value={formData.receipt}
                    onChange={(e) => setFormData({ ...formData, receipt: e.target.value })}
                    placeholder="למשל: 1042"
                    style={{
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "1px solid #ced4da",
                      outline: "none",
                      boxSizing: "border-box",
                      fontSize: "14px",
                      marginBottom: "20px",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13.5px",
                      fontWeight: "600",
                      color: "#495057",
                    }}
                  >
                    הערות
                  </label>
                  <textarea
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  padding: "12px 32px",
                  borderRadius: "30px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontWeight: "600",
                  color: "#495057",
                  transition: "0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
              >
                ביטול
              </button>
              <button
                type="submit"
                form="add-transaction-form"
                disabled={isSubmitting}
                style={{
                  padding: "12px 32px",
                  borderRadius: "30px",
                  border: "none",
                  backgroundColor: "#8b2c2c",
                  color: "white",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  transition: "0.2s",
                  boxShadow: "0 4px 12px rgba(139,44,44,0.2)",
                }}
              >
                {isSubmitting ? "שומר..." : "שמור פעולה"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isUploadModalOpen && (
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
              <h3 style={{ margin: 0, color: "#343a40", fontSize: "1.5rem", fontWeight: "bold" }}>
                העלאת קבלה / חשבונית
              </h3>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                }}
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
              <form id="upload-receipt-form" onSubmit={handleUploadReceipt}>
                <label className="file-upload-box">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={uploadFile ? "#8b2c2c" : "#adb5bd"}
                    strokeWidth="1.5"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <div style={{ fontWeight: "bold", fontSize: "15px", color: uploadFile ? "#8b2c2c" : "#495057" }}>
                    {uploadFile ? uploadFile.name : "לחץ לבחירת קובץ מהמחשב"}
                  </div>
                  {!uploadFile && (
                    <div style={{ fontSize: "13px", color: "#6c757d" }}>תומך בפורמטים: PDF, JPG, PNG</div>
                  )}
                  <input type="file" onChange={(e) => setUploadFile(e.target.files[0])} accept=".pdf,image/*" />
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "13.5px",
                        fontWeight: "600",
                        color: "#495057",
                      }}
                    >
                      שם הקבלה
                    </label>
                    <input
                      type="text"
                      value={uploadData.receiptName}
                      onChange={(e) => setUploadData({ ...uploadData, receiptName: e.target.value })}
                      placeholder="למשל: קבלת תרומה..."
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
                        fontSize: "13.5px",
                        fontWeight: "600",
                        color: "#495057",
                      }}
                    >
                      מספר קבלה/חשבונית
                    </label>
                    <input
                      type="text"
                      value={uploadData.receiptNumber}
                      onChange={(e) => setUploadData({ ...uploadData, receiptNumber: e.target.value })}
                      placeholder="למשל: 1042"
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
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13.5px",
                      fontWeight: "600",
                      color: "#495057",
                    }}
                  >
                    שיוך לפעולה כספית קיימת (אופציונלי)
                  </label>
                  <select
                    value={uploadData.transactionId}
                    onChange={(e) => setUploadData({ ...uploadData, transactionId: e.target.value })}
                    className="modal-form-select"
                    style={{ backgroundColor: "#faf8f5" }}
                  >
                    <option value="">-- שמור כקבלה כללית (ללא שיוך לפעולה) --</option>
                    {transactions
                      .filter((t) => !t.receiptUrl && t.type !== "קבלה_בלבד")
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.date} | {t.source} - ₪{t.amount} ({t.type})
                        </option>
                      ))}
                  </select>
                  <div style={{ fontSize: "12px", color: "#6c757d", marginTop: "6px" }}>
                    * השאר ריק אם ברצונך להעלות קבלה שאינה קשורה לפעולה ספציפית בטבלה.
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
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadFile(null);
                }}
                style={{
                  padding: "12px 32px",
                  borderRadius: "30px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  color: "#495057",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
              >
                ביטול
              </button>
              <button
                type="submit"
                form="upload-receipt-form"
                disabled={isUploading || !uploadFile}
                style={{
                  padding: "12px 32px",
                  borderRadius: "30px",
                  border: "none",
                  backgroundColor: "#8b2c2c",
                  color: "white",
                  cursor: isUploading || !uploadFile ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(139,44,44,0.2)",
                  transition: "0.2s",
                }}
              >
                {isUploading ? "מעלה קובץ..." : "שמור קבלה"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditReceiptModalOpen && editReceiptData && (
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
              maxWidth: "520px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid #e2d8c9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, color: "#343a40", fontSize: "1.4rem", fontWeight: "bold" }}>עריכת שיוך קבלה</h3>
              <button
                onClick={() => setIsEditReceiptModalOpen(false)}
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

            <div style={{ padding: "24px 32px" }}>
              <div
                style={{
                  backgroundColor: "#faf8f5",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #e2d8c9",
                  marginBottom: "24px",
                }}
              >
                <div style={{ fontSize: "13.5px", color: "#6c757d", marginBottom: "6px" }}>מסמך נוכחי:</div>
                <div style={{ fontWeight: "bold", color: "#343a40", fontSize: "15px" }}>
                  {editReceiptData.receiptName || "מסמך ללא שם"}
                </div>
              </div>

              <form id="edit-linkage-form" onSubmit={handleEditReceiptLinkage}>
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "13.5px",
                      fontWeight: "600",
                      color: "#495057",
                    }}
                  >
                    שנה שיוך לפעולה כספית אחרת
                  </label>
                  <select
                    value={uploadData.transactionId}
                    onChange={(e) => setUploadData({ ...uploadData, transactionId: e.target.value })}
                    className="modal-form-select"
                  >
                    <option value="">-- הפוך לקבלה עצמאית (ללא שיוך) --</option>
                    {transactions
                      .filter((t) => !t.receiptUrl || t.id === editReceiptData.id)
                      .filter((t) => t.type !== "קבלה_בלבד")
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.date} | {t.source} - ₪{t.amount} ({t.type})
                        </option>
                      ))}
                  </select>
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
              }}
            >
              <button
                type="button"
                onClick={() => setIsEditReceiptModalOpen(false)}
                style={{
                  padding: "12px 28px",
                  borderRadius: "30px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  color: "#495057",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8f9fa")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
              >
                ביטול
              </button>
              <button
                type="submit"
                form="edit-linkage-form"
                disabled={isSubmitting}
                style={{
                  padding: "12px 28px",
                  borderRadius: "30px",
                  border: "none",
                  backgroundColor: "#8b2c2c",
                  color: "white",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontWeight: "600",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(139,44,44,0.2)",
                  transition: "0.2s",
                }}
              >
                {isSubmitting ? "מעדכן..." : "שמור שינויים"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
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
              padding: "32px",
              borderRadius: "20px",
              textAlign: "center",
              width: "90%",
              maxWidth: "380px",
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
              מחיקת פעולה כספית
            </h4>
            <p style={{ color: "#6c757d", fontSize: "14px", margin: "0 0 30px 0", lineHeight: "1.5" }}>
              האם אתה בטוח שברצונך למחוק פעולה זו? לא ניתן יהיה לשחזר את הנתונים לאחר מכן.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "30px",
                  border: "1px solid #ced4da",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  fontWeight: "600",
                  color: "#495057",
                  transition: "all 0.2s",
                }}
              >
                ביטול
              </button>
              <button
                onClick={() => handleDeleteTransaction(deleteId)}
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
                כן, מחק לחלוטין
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteReceiptData && (
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
              padding: "32px",
              borderRadius: "20px",
              textAlign: "center",
              width: "90%",
              maxWidth: "380px",
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <h4 style={{ color: "#0f172a", fontWeight: "bold", margin: "0 0 12px 0", fontSize: "1.2rem" }}>
              הסרת קבלה מהמאגר
            </h4>
            <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 30px 0", lineHeight: "1.5" }}>
              {deleteReceiptData.isStandalone
                ? "האם אתה בטוח שברצונך למחוק קבלה עצמאית זו? לא ניתן יהיה לשחזר את הנתונים לאחר מכן."
                : "פעולה זו תסיר את הקובץ המצורף בלבד ולא תמחק את הפעולה הכספית עצמה. להמשיך?"}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setDeleteReceiptData(null)}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "30px",
                  border: "1px solid #cbd5e1",
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
                onClick={handleDeleteReceiptConfirm}
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
                כן, הסר קבלה
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminPageLayout>
  );
}