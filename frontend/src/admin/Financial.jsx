import { useEffect, useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout.jsx";
import { db, storage } from "../firebase";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function Financial() {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const [transactions, setTransactions] = useState([]);
  
  const [activeTab, setActiveTab] = useState("transactions"); 

  // ذواكر البحث והفلترة للعمليات المالية
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all"); 
  
  // ذاكرة البحث الخاصة بتبويب الفواتير
  const [receiptSearchTerm, setReceiptSearchTerm] = useState("");

  // نوافذ الـ Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditReceiptModalOpen, setIsEditReceiptModalOpen] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [toastMessage, setToastMessage] = useState(""); 
  const [deleteId, setDeleteId] = useState(null); 
  const [deleteReceiptData, setDeleteReceiptData] = useState(null); 

  const [formData, setFormData] = useState({
    type: "תרומה", amount: "", source: "", project: "", date: new Date().toISOString().split('T')[0], receipt: "", notes: ""
  });

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadData, setUploadData] = useState({ receiptName: "", receiptNumber: "", transactionId: "" });

  // ذاكرة تعديل الفاتورة
  const [editReceiptData, setEditReceiptData] = useState(null);

  // ==========================================
  // FIREBASE DATA FETCHING
  // ==========================================
  useEffect(() => {
    const q = query(collection(db, "financialTransactions"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dataList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTransactions(dataList);
    }, (error) => {
      console.error("Error fetching financial data:", error);
    });
    return () => unsubscribe();
  }, []);

  // ==========================================
  // CALCULATIONS & FILTERING
  // ==========================================
  const globalTotals = useMemo(() => {
    let income = 0; let expenses = 0; let donations = 0;
    transactions.forEach(item => {
      if (item.type === "קבלה_בלבד") return; 
      const amountVal = parseFloat(item.amount) || 0;
      if (item.type === "הוצאה") expenses += amountVal;
      else if (item.type === "תרומה") { income += amountVal; donations += amountVal; }
      else if (item.type === "הכנסה") income += amountVal;
    });
    return { income, expenses, donations, balance: income - expenses };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (t.type === "קבלה_בלבד") return false; 
      const matchesType = filterType === "all" || t.type === filterType;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (t.source && t.source.toLowerCase().includes(searchLower)) ||
        (t.project && t.project.toLowerCase().includes(searchLower)) ||
        (t.receipt && t.receipt.toLowerCase().includes(searchLower)) ||
        (t.notes && t.notes.toLowerCase().includes(searchLower)) ||
        (t.receiptName && t.receiptName.toLowerCase().includes(searchLower));
      return matchesType && matchesSearch;
    });
  }, [transactions, filterType, searchTerm]);

  // استخراج الفواتير مع تطبيق نظام البحث الجديد
  const uploadedReceipts = useMemo(() => {
    return transactions.filter(t => {
      if (!t.receiptUrl) return false;
      const searchLower = receiptSearchTerm.toLowerCase();
      return (t.receiptName && t.receiptName.toLowerCase().includes(searchLower)) ||
             (t.receipt && t.receipt.toLowerCase().includes(searchLower)) ||
             (t.source && t.source.toLowerCase().includes(searchLower));
    });
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
      await addDoc(collection(db, "financialTransactions"), {
        type: formData.type, amount: parseFloat(formData.amount), source: formData.source.trim(), project: formData.project.trim(),
        date: formData.date, receipt: formData.receipt.trim(), receiptUrl: "", receiptName: "", notes: formData.notes.trim(), createdAt: serverTimestamp()
      });
      setIsAddModalOpen(false);
      setFormData({ type: "תרומה", amount: "", source: "", project: "", date: new Date().toISOString().split('T')[0], receipt: "", notes: "" });
      showToast("הפעולה נשמרה בהצלחה!"); 
    } catch (error) { alert("שגיאה בשמירת הנתונים."); } 
    finally { setIsSubmitting(false); }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteDoc(doc(db, "financialTransactions", id));
      setDeleteId(null);
      showToast("הפעולה נמחקה מהמערכת!");
    } catch (error) { alert("שגיאה במחיקת הפעולה."); }
  };

  const handleUploadReceipt = async (e) => {
    e.preventDefault();
    if (!uploadFile) { alert("נא לבחור קובץ תחילה"); return; }
    setIsUploading(true);
    try {
      const fileRef = ref(storage, `receipts/${Date.now()}_${uploadFile.name}`);
      await uploadBytes(fileRef, uploadFile);
      const downloadUrl = await getDownloadURL(fileRef);

      const finalReceiptName = uploadData.receiptName.trim() || uploadFile.name;
      const finalReceiptNum = uploadData.receiptNumber.trim() || "ללא מספר";

      if (uploadData.transactionId) {
        await updateDoc(doc(db, "financialTransactions", uploadData.transactionId), { receiptUrl: downloadUrl, receiptName: finalReceiptName, receipt: finalReceiptNum });
      } else {
        await addDoc(collection(db, "financialTransactions"), {
          type: "קבלה_בלבד", amount: 0, source: "—", project: "—", date: new Date().toISOString().split('T')[0],
          receiptUrl: downloadUrl, receiptName: finalReceiptName, receipt: finalReceiptNum, notes: "קבלה עצמאית במאגר", createdAt: serverTimestamp()
        });
      }
      setIsUploadModalOpen(false); setUploadFile(null); setUploadData({ receiptName: "", receiptNumber: "", transactionId: "" });
      showToast("הקבלה הועלתה וצורפה בהצלחה!");
      setActiveTab("receipts"); 
    } catch (error) { alert("שגיאה בהעלאת הקובץ."); } 
    finally { setIsUploading(false); }
  };

  // تعديل ارتباط الفاتورة (Edit Linkage)
  const handleEditReceiptLinkage = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { id, isStandalone, receiptUrl, receiptName, receipt } = editReceiptData;
      const oldTxId = id;
      const newTxId = uploadData.transactionId; // الـ ID الجديد من ה-dropdown

      if (oldTxId === newTxId && !isStandalone) {
        setIsEditReceiptModalOpen(false);
        setIsSubmitting(false);
        return; // لم يتم تغيير شيء
      }

      if (isStandalone) {
        if (newTxId) {
          // نقل الفاتورة من مستقلة إلى مربوطة بعملية
          await updateDoc(doc(db, "financialTransactions", newTxId), { receiptUrl, receiptName, receipt });
          await deleteDoc(doc(db, "financialTransactions", oldTxId)); // مسح الوثيقة المستقلة القديمة
        }
      } else {
        if (newTxId) {
          // نقل الفاتورة من عملية مالية إلى عملية مالية أخرى
          await updateDoc(doc(db, "financialTransactions", newTxId), { receiptUrl, receiptName, receipt });
          await updateDoc(doc(db, "financialTransactions", oldTxId), { receiptUrl: "", receiptName: "", receipt: "" });
        } else {
          // تحويل الفاتورة المربوطة إلى فاتورة مستقلة
          await addDoc(collection(db, "financialTransactions"), {
            type: "קבלה_בלבד", amount: 0, source: "—", project: "—", date: new Date().toISOString().split('T')[0],
            receiptUrl, receiptName, receipt, notes: "קבלה עצמאית במאגר", createdAt: serverTimestamp()
          });
          await updateDoc(doc(db, "financialTransactions", oldTxId), { receiptUrl: "", receiptName: "", receipt: "" });
        }
      }
      setIsEditReceiptModalOpen(false);
      showToast("שיוך הקבלה עודכן בהצלחה!");
    } catch (error) {
      console.error(error);
      alert("שגיאה בעדכון השיוך.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReceiptConfirm = async () => {
    if (!deleteReceiptData) return;
    try {
      if (deleteReceiptData.isStandalone) await deleteDoc(doc(db, "financialTransactions", deleteReceiptData.id));
      else await updateDoc(doc(db, "financialTransactions", deleteReceiptData.id), { receiptUrl: "", receiptName: "" });
      setDeleteReceiptData(null);
      showToast("הקבלה הוסרה בהצלחה!");
    } catch (error) { alert("שגיאה במחיקת הקבלה."); }
  };

  const exportToCSV = () => {
    const BOM = "\uFEFF";
    const header = "סוג,סכום,מקור,פרויקט,תאריך,מספר קבלה,הערות\n";
    const rows = filteredTransactions.map(t => `"${t.type}","${t.amount}","${t.source}","${t.project}","${t.date}","${t.receipt}","${t.notes}"`).join("\n");
    const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `דוח_כספי_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const formatCurrency = (value) => new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(value);

  const getBadgeStyle = (type) => {
    if (type === "תרומה") return { backgroundColor: "#e8f5e9", color: "#1e6b2c" };
    if (type === "הוצאה") return { backgroundColor: "#fdecec", color: "#dc3545" };
    if (type === "הכנסה") return { backgroundColor: "#e2e3e5", color: "#383d41" };
    return {};
  };

  return (
    <AdminLayout title="ניהול כספי" subtitle="הכנסות, הוצאות, תרומות וקבלות" actions={
      <div style={{ display: "flex", gap: "14px", direction: "rtl", alignItems: "center" }}>
        <button onClick={() => setIsAddModalOpen(true)} className="action-btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          הוספת פעולה כספית
        </button>
        <button onClick={() => setIsUploadModalOpen(true)} className="action-btn-secondary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          העלאת קבלה
        </button>
        <button onClick={exportToCSV} className="action-btn-tertiary" title="ייצוא לאקסל">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          ייצוא
        </button>
      </div>
    }>
      <style>{`
        /* الأزرار العلوية */
        .action-btn-primary { background: linear-gradient(135deg, #8b2c2c 0%, #6e1f1f 100%); color: white; padding: 10px 24px; border-radius: 30px; font-weight: 600; border: none; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-direction: row-reverse; gap: 8px; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(139,44,44,0.25); }
        .action-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(139,44,44,0.35); background: #7a2626; }
        .action-btn-secondary { background: #fff; color: #475569; border: 1px solid #cbd5e1; padding: 10px 24px; border-radius: 30px; font-weight: 600; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-direction: row-reverse; gap: 8px; transition: all 0.3s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .action-btn-secondary:hover { background: #f8fafc; border-color: #94a3b8; color: #0f172a; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
        .action-btn-tertiary { background: #fff; color: #64748b; border: 1px solid #e2e8f0; padding: 10px 20px; border-radius: 30px; font-weight: 600; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-direction: row-reverse; gap: 8px; transition: all 0.3s ease; }
        .action-btn-tertiary:hover { background: #f1f5f9; color: #334155; border-color: #cbd5e1; }

        /* الإحصائيات */
        .fin-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 24px; direction: rtl; }
        .fin-stat-card { background: #fff; padding: 24px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 10px rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: flex-start; transition: all 0.2s; }
        .fin-stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(139,44,44,0.05); }
        .fin-label { color: #64748b; font-size: 14px; font-weight: 600; margin-bottom: 12px; display: block; }
        .fin-value { font-size: 2.2rem; font-weight: bold; color: #8b2c2c; letter-spacing: -0.5px; }
        .fin-icon-box { width: 48px; height: 48px; border-radius: 50%; background-color: #f8fafc; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        
        /* الصندوق المدمج والتبويبات */
        .fin-combined-wrapper { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 15px rgba(0,0,0,0.03); direction: rtl; overflow: hidden; margin-bottom: 40px; min-height: 400px; }
        .segmented-tabs-container { display: flex; justify-content: center; padding: 20px 0; background: #fafbfc; border-bottom: 1px solid #e2e8f0; }
        .segmented-control { display: inline-flex; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background: #f1f5f9; padding: 4px; gap: 4px;}
        .segment-btn { padding: 10px 36px; font-size: 14.5px; font-weight: 600; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; background: transparent; color: #64748b; outline: none; }
        .segment-btn.active { background: #fff; color: #8b2c2c; box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
        .segment-btn:hover:not(.active) { color: #334155; }

        /* منطقة الفلترة المحدثة لإضافة اللون */
        .filter-section { padding: 20px 24px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        .filter-pills-container { display: flex; gap: 6px; background: #fff; border: 1px solid #e2e8f0; padding: 6px; border-radius: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .filter-btn { padding: 8px 24px; border-radius: 30px; font-weight: 600; font-size: 13.5px; cursor: pointer; border: none; background: transparent; color: #64748b; transition: all 0.2s; }
        .filter-btn:hover:not(.active) { color: #0f172a; background: #f1f5f9; }
        .filter-btn.active { background: #8b2c2c; color: #fff; box-shadow: 0 2px 6px rgba(139,44,44,0.25); }
        
        /* صندوق البحث */
        .search-input-wrapper { position: relative; flex-grow: 1; max-width: 320px; }
        .search-input { width: 100%; padding: 12px 40px 12px 16px; border-radius: 30px; border: 1px solid #cbd5e1; outline: none; font-size: 14px; transition: all 0.2s; box-sizing: border-box; background: #fff; }
        .search-input:focus { border-color: #8b2c2c; box-shadow: 0 0 0 3px rgba(139,44,44,0.1); }
        .search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }

        /* الجدول مع إضافة Zebra Striping وألوان واضحة للرأس */
        .fin-table { width: 100%; border-collapse: collapse; }
        .fin-table th { background: #f1f5f9; padding: 16px 24px; text-align: right; color: #475569; font-size: 13.5px; font-weight: bold; border-bottom: 2px solid #cbd5e1; }
        .fin-table td { padding: 16px 24px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; vertical-align: middle; }
        .fin-table tr:nth-child(even) { background-color: #fafbfc; } /* Zebra Striping */
        .fin-table tr:hover { background-color: #f1f5f9; }
        
        .type-badge { padding: 6px 14px; border-radius: 30px; font-weight: bold; font-size: 12.5px; display: inline-block; text-align: center; }
        .action-icon-btn { background: #fff; border: 1px solid #e2e8f0; cursor: pointer; color: #64748b; padding: 8px; border-radius: 8px; transition: 0.2s; display: inline-flex; justify-content: center; align-items: center; }
        .action-icon-btn:hover { color: #dc3545; background: #fdecec; border-color: #f5c6cb; }
        .action-icon-edit:hover { color: #8b2c2c; background: #fdfbf7; border-color: #e2d8c9; }
        
        /* أرכיון קבלות */
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

        /* نوافذ الرفع */
        .file-upload-box { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 32px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; background: #f8fafc; cursor: pointer; transition: 0.2s; margin-bottom: 20px; }
        .file-upload-box:hover { border-color: #8b2c2c; background: #fff; }
        .file-upload-box input { display: none; }
        .modal-close-btn { position: absolute; top: 20px; left: 20px; background: none; border: none; cursor: pointer; color: #94a3b8; }
        .modal-close-btn:hover { color: #0f172a; }

        .toast-msg { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background-color: #1e6b2c; color: white; padding: 12px 24px; border-radius: 30px; font-weight: bold; font-size: 14px; box-shadow: 0 10px 20px rgba(30,107,44,0.3); z-index: 5000; animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { bottom: -50px; opacity: 0; } to { bottom: 30px; opacity: 1; } }
      `}</style>

      {toastMessage && <div className="toast-msg">✓ {toastMessage}</div>}

      {/* --- الإحصائيات العامة الثابتة --- */}
      <div className="fin-stats-grid">
        <div className="fin-stat-card">
          <div><span className="fin-label">סה״כ הכנסות</span><span className="fin-value">{formatCurrency(globalTotals.income)}</span></div>
          <div className="fin-icon-box">💰</div>
        </div>
        <div className="fin-stat-card">
          <div><span className="fin-label">סה״כ הוצאות</span><span className="fin-value" style={{ color: "#dc3545" }}>{formatCurrency(globalTotals.expenses)}</span></div>
          <div className="fin-icon-box">💸</div>
        </div>
        <div className="fin-stat-card">
          <div><span className="fin-label">סך תרומות</span><span className="fin-value" style={{ color: "#8b2c2c" }}>{formatCurrency(globalTotals.donations)}</span></div>
          <div className="fin-icon-box">❤️</div>
        </div>
        <div className="fin-stat-card" style={{ borderColor: "#8b2c2c", background: "#fffefc" }}>
          <div><span className="fin-label" style={{ color: "#8b2c2c" }}>יתרה נוכחית</span><span className="fin-value" style={{ color: globalTotals.balance < 0 ? "#dc3545" : "#1e6b2c" }}>{formatCurrency(globalTotals.balance)}</span></div>
          <div className="fin-icon-box" style={{ backgroundColor: "#8b2c2c", color: "white" }}>📊</div>
        </div>
      </div>

      <div className="fin-combined-wrapper">
        
        {/* التبويبات المتصلة (Segmented Control) */}
        <div className="segmented-tabs-container">
          <div className="segmented-control">
            <button className={`segment-btn ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>
              פעולות כספיות
            </button>
            <button className={`segment-btn ${activeTab === 'receipts' ? 'active' : ''}`} onClick={() => setActiveTab('receipts')}>
              מאגר קבלות ({uploadedReceipts.length})
            </button>
          </div>
        </div>

        {/* عرض محتوى تبويب: العمليات المالية */}
        {activeTab === 'transactions' && (
          <>
            <div className="filter-section">
              <div className="filter-pills-container">
                <button className={`filter-btn ${filterType === "all" ? "active" : ""}`} onClick={() => setFilterType("all")}>הכל</button>
                <button className={`filter-btn ${filterType === "תרומה" ? "active" : ""}`} onClick={() => setFilterType("תרומה")}>תרומות</button>
                <button className={`filter-btn ${filterType === "הכנסה" ? "active" : ""}`} onClick={() => setFilterType("הכנסה")}>הכנסות כלליות</button>
                <button className={`filter-btn ${filterType === "הוצאה" ? "active" : ""}`} onClick={() => setFilterType("הוצאה")}>הוצאות</button>
              </div>
              <div className="search-input-wrapper">
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" placeholder="חיפוש לפי מקור, פרויקט או קבלה..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            
            <div style={{ overflowX: "auto", maxHeight: "450px" }}>
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>סוג</th>
                    <th>סכום</th>
                    <th>מקור / ספק</th>
                    <th>פרויקט</th>
                    <th>תאריך</th>
                    <th>קבלה/חשבונית</th>
                    <th style={{ textAlign: "center" }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length > 0 ? filteredTransactions.map(item => (
                    <tr key={item.id}>
                      <td style={{ width: "90px" }}><span className="type-badge" style={getBadgeStyle(item.type)}>{item.type}</span></td>
                      <td style={{ fontWeight: "bold", fontSize: "15px", color: item.type === "הוצאה" ? "#dc3545" : "#0f172a" }}>{formatCurrency(item.amount)}</td>
                      <td style={{ fontWeight: "600", color: "#334155" }}>{item.source}</td>
                      <td style={{ color: "#64748b" }}>{item.project || "—"}</td>
                      <td style={{ color: "#64748b" }}>{item.date}</td>
                      <td>
                        {item.receiptUrl ? (
                          <a href={item.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#8b2c2c", fontWeight: "bold", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "#fef2f2", padding: "4px 10px", borderRadius: "8px" }} title="צפה בקובץ">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                            {item.receiptName || item.receipt || "מסמך מצורף"}
                          </a>
                        ) : item.receipt ? (
                          <span style={{ fontWeight: "500", color: "#64748b" }}>{item.receipt}</span>
                        ) : "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button className="action-icon-btn" onClick={() => setDeleteId(item.id)} title="מחק פעולה זו">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan="7" style={{ textAlign: "center", padding: "60px", color: "#94a3b8", fontSize: "15px" }}>לא נמצאו פעולות.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* عرض محتوى تبويب: أرشيف الفواتير */}
        {activeTab === 'receipts' && (
          <>
            {/* شريط البحث الخاص بتبويب الفواتير */}
            <div className="filter-section" style={{ justifyContent: "flex-end" }}>
              <div className="search-input-wrapper" style={{ maxWidth: "350px" }}>
                <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" placeholder="חיפוש קבלה לפי שם, מספר או מקור..." className="search-input" value={receiptSearchTerm} onChange={(e) => setReceiptSearchTerm(e.target.value)} />
              </div>
            </div>

            <div className="receipts-grid">
              {uploadedReceipts.length > 0 ? uploadedReceipts.map(r => (
                <div key={r.id} className="receipt-card">
                  <div className="receipt-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  </div>
                  <div className="receipt-info">
                    <div className="receipt-title" title={r.receiptName || r.receipt}>{r.receiptName || r.receipt || "מסמך ללא שם"}</div>
                    <div className="receipt-sub">מספר קבלה: {r.receipt !== "צורף קובץ" ? r.receipt : "—"}</div>
                    {r.type === "קבלה_בלבד" ? (
                      <div className="receipt-sub" style={{ marginTop: "4px", color: "#475569", fontWeight: "bold" }}>📄 קבלה עצמאית (ללא שיוך)</div>
                    ) : (
                      <div className="receipt-sub" style={{ marginTop: "4px", color: r.type === "הוצאה" ? "#dc3545" : "#1e6b2c", fontWeight: "600" }}>משויך ל{r.type}: ₪{r.amount}</div>
                    )}
                  </div>
                  
                  <div className="receipt-actions">
                    <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer" className="dl-btn" title="צפה או הורד">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </a>
                    {/* زر تعديل الارتباط */}
                    <button onClick={() => {
                        setEditReceiptData({ id: r.id, isStandalone: r.type === "קבלה_בלבד", receiptUrl: r.receiptUrl, receiptName: r.receiptName, receipt: r.receipt });
                        setUploadData({ ...uploadData, transactionId: r.type === "קבלה_בלבד" ? "" : r.id });
                        setIsEditReceiptModalOpen(true);
                      }} 
                      className="action-icon-btn action-icon-edit" title="ערוך שיוך קבלה"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    {/* زر החذف */}
                    <button onClick={() => setDeleteReceiptData({ id: r.id, isStandalone: r.type === "קבלה_בלבד" })} className="action-icon-btn" title="הסר קבלה זו">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </div>
                </div>
              )) : (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px", color: "#94a3b8" }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: "16px", opacity: 0.5 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                  <div style={{ fontSize: "16px", fontWeight: "600", color: "#475569" }}>לא נמצאו קבלות מתאימות לחיפוש</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ========================================== */}
      {/* מודל עריכת שיוך קבלה (نافذة تعديل ارتباط الفاتورة - الألوان المعدلة هنا) */}
      {/* ========================================== */}
      {isEditReceiptModalOpen && editReceiptData && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, direction: "rtl", backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "#fff", padding: "32px", borderRadius: "20px", width: "90%", maxWidth: "480px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", position: "relative" }}>
            <button className="modal-close-btn" onClick={() => setIsEditReceiptModalOpen(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <h3 style={{ margin: "0 0 24px 0", color: "#0f172a", fontSize: "1.4rem", fontWeight: "bold", textAlign: "center" }}>עריכת שיוך קבלה</h3>
            
            <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
              <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>מסמך נוכחי:</div>
              <div style={{ fontWeight: "bold", color: "#0f172a" }}>{editReceiptData.receiptName || "מסמך ללא שם"}</div>
            </div>

            <form onSubmit={handleEditReceiptLinkage}>
              <div style={{ marginBottom: "28px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>שנה שיוך לפעולה כספית אחרת</label>
                <select value={uploadData.transactionId} onChange={(e) => setUploadData({...uploadData, transactionId: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", backgroundColor: "#fff", fontSize: "14px", fontFamily: "inherit" }}>
                  <option value="">-- הפוך לקבלה עצמאית (ללא שיוך) --</option>
                  {transactions.filter(t => !t.receiptUrl || t.id === editReceiptData.id).filter(t => t.type !== "קבלה_בלבד").map(t => (
                    <option key={t.id} value={t.id}>
                      {t.date} | {t.source} - ₪{t.amount} ({t.type})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={() => setIsEditReceiptModalOpen(false)} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: "1px solid #cbd5e1", backgroundColor: "#fff", color: "#475569", cursor: "pointer", fontWeight: "600" }}>ביטול</button>
                {/* تم تعديل لون الزر من الأزرق إلى العنابي (#8b2c2c) هنا */}
                <button type="submit" disabled={isSubmitting} style={{ flex: 2, padding: "12px", borderRadius: "30px", border: "none", backgroundColor: "#8b2c2c", color: "white", cursor: isSubmitting ? "not-allowed" : "pointer", fontWeight: "600", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(139,44,44,0.2)" }}>
                  {isSubmitting ? "מעדכן..." : "שמור שינויים"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نوافذ الرفع والحذف والإضافة المتبقية */}
      {/* מודל העלאת קבלה (نافذة رفع הפاتورة السحابية) */}
      {isUploadModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, direction: "rtl", backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "#fff", padding: "32px", borderRadius: "20px", width: "90%", maxWidth: "480px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", position: "relative" }}>
            <button className="modal-close-btn" onClick={() => {setIsUploadModalOpen(false); setUploadFile(null);}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <h3 style={{ margin: "0 0 24px 0", color: "#0f172a", fontSize: "1.4rem", fontWeight: "bold", textAlign: "center" }}>העלאת קבלה / חשבונית</h3>
            <form onSubmit={handleUploadReceipt}>
              <label className="file-upload-box">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={uploadFile ? "#1e6b2c" : "#94a3b8"} strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <div style={{ fontWeight: "bold", fontSize: "15px", color: uploadFile ? "#1e6b2c" : "#475569" }}>
                  {uploadFile ? uploadFile.name : "לחץ לבחירת קובץ מהמחשב"}
                </div>
                {!uploadFile && <div style={{ fontSize: "13px", color: "#94a3b8" }}>תומך בפורמטים: PDF, JPG, PNG</div>}
                <input type="file" onChange={(e) => setUploadFile(e.target.files[0])} accept=".pdf,image/*" />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>שם הקבלה</label>
                  <input type="text" value={uploadData.receiptName} onChange={(e) => setUploadData({...uploadData, receiptName: e.target.value})} placeholder="למשל: קבלת תרומה..." style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>מספר קבלה/חשבונית</label>
                  <input type="text" value={uploadData.receiptNumber} onChange={(e) => setUploadData({...uploadData, receiptNumber: e.target.value})} placeholder="למשל: 1042" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <div style={{ marginBottom: "28px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>שיוך לפעולה כספית קיימת (אופציונלי)</label>
                <select value={uploadData.transactionId} onChange={(e) => setUploadData({...uploadData, transactionId: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", backgroundColor: "#f8fafc" }}>
                  <option value="">-- שמור כקבלה כללית (ללא שיוך לפעולה) --</option>
                  {transactions.filter(t => !t.receiptUrl && t.type !== "קבלה_בלבד").map(t => (
                    <option key={t.id} value={t.id}>{t.date} | {t.source} - ₪{t.amount} ({t.type})</option>
                  ))}
                </select>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>* השאר ריק אם ברצונך להעלות קבלה שאינה קשורה לפעולה ספציפית בטבלה.</div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button type="button" onClick={() => {setIsUploadModalOpen(false); setUploadFile(null);}} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: "1px solid #cbd5e1", backgroundColor: "#fff", color: "#475569", cursor: "pointer", fontWeight: "600" }}>ביטול</button>
                <button type="submit" disabled={isUploading || !uploadFile} style={{ flex: 2, padding: "12px", borderRadius: "30px", border: "none", backgroundColor: "#8b2c2c", color: "white", cursor: (isUploading || !uploadFile) ? "not-allowed" : "pointer", fontWeight: "600", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                  {isUploading ? "מעלה קובץ..." : "שמור קבלה"}
                  {!isUploading && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* מודל הוספת פעולה כספית */}
      {isAddModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, direction: "rtl", backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "#fff", padding: "32px", borderRadius: "20px", width: "90%", maxWidth: "520px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", borderBottom: "1px solid #f1f5f9", paddingBottom: "16px" }}>
              <h3 style={{ margin: 0, color: "#0f172a", fontSize: "1.4rem", fontWeight: "bold" }}>הוספת פעולה כספית</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <form onSubmit={handleAddTransaction}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>סוג הפעולה *</label>
                  <select required value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", backgroundColor: "#f8fafc" }}>
                    <option value="תרומה">תרומה (הכנסה)</option>
                    <option value="הכנסה">הכנסה כללית</option>
                    <option value="הוצאה">הוצאה</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>סכום (₪) *</label>
                  <input type="number" required min="1" step="0.01" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>מקור / ספק *</label>
                  <input type="text" required value={formData.source} onChange={(e) => setFormData({...formData, source: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>פרויקט משויך</label>
                  <input type="text" value={formData.project} onChange={(e) => setFormData({...formData, project: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>תאריך הביצוע *</label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>מספר קבלה (ידני)</label>
                  <input type="text" value={formData.receipt} onChange={(e) => setFormData({...formData, receipt: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ marginBottom: "32px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600", color: "#475569" }}>הערות</label>
                <textarea rows="2" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", outline: "none", resize: "none", boxSizing: "border-box" }}></textarea>
              </div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: "12px 28px", borderRadius: "30px", border: "1px solid #cbd5e1", backgroundColor: "#fff", cursor: "pointer", fontWeight: "600" }}>ביטול</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: "12px 28px", borderRadius: "30px", border: "none", backgroundColor: "#8b2c2c", color: "white", cursor: "pointer", fontWeight: "600" }}>{isSubmitting ? "שומר..." : "שמור פעולה"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* מודל מחיקת פעולה שלמה */}
      {deleteId && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, direction: "rtl", backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "#fff", padding: "32px", borderRadius: "20px", textAlign: "center", width: "90%", maxWidth: "380px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ backgroundColor: "#fdecec", width: "64px", height: "64px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </div>
            <h4 style={{ color: "#0f172a", fontWeight: "bold", margin: "0 0 12px 0", fontSize: "1.2rem" }}>מחיקת פעולה כספית</h4>
            <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 30px 0", lineHeight: "1.5" }}>האם אתה בטוח שברצונך למחוק פעולה זו? לא ניתן יהיה לשחזר את הנתונים לאחר מכן.</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={() => setDeleteId(null)} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: "1px solid #cbd5e1", backgroundColor: "#fff", cursor: "pointer", fontWeight: "600", color: "#475569", transition: "all 0.2s" }}>ביטול</button>
              <button onClick={() => handleDeleteTransaction(deleteId)} style={{ flex: 1, padding: "12px", borderRadius: "30px", backgroundColor: "#dc3545", color: "white", border: "none", cursor: "pointer", fontWeight: "600", transition: "all 0.2s", boxShadow: "0 4px 12px rgba(220,53,69,0.2)" }}>כן, מחק לחלוטין</button>
            </div>
          </div>
        </div>
      )}

      {/* מודל הסרת קבלה (للفواتير فقط) - تم تعديل الألوان هنا */}
      {deleteReceiptData && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(15,23,42,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, direction: "rtl", backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: "#fff", padding: "32px", borderRadius: "20px", textAlign: "center", width: "90%", maxWidth: "380px", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            {/* تم تغيير لون الخلفية والأيقونة إلى الأحمر التحذيري (#dc3545) بدلاً من البرتقالي */}
            <div style={{ backgroundColor: "#fdecec", width: "64px", height: "64px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px auto" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc3545" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line><line x1="9" y1="11" x2="15" y2="11"></line></svg>
            </div>
            <h4 style={{ color: "#0f172a", fontWeight: "bold", margin: "0 0 12px 0", fontSize: "1.2rem" }}>הסרת קבלה מהמאגר</h4>
            <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 30px 0", lineHeight: "1.5" }}>
              {deleteReceiptData.isStandalone ? "האם אתה בטוח שברצונך למחוק קבלה עצמאית זו?" : "פעולה זו תסיר את הקובץ המצורף בלבד ולא תמחק את הפעולה הכספית עצמה. להמשיך?"}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button onClick={() => setDeleteReceiptData(null)} style={{ flex: 1, padding: "12px", borderRadius: "30px", border: "1px solid #cbd5e1", backgroundColor: "#fff", cursor: "pointer", fontWeight: "600", color: "#475569" }}>ביטול</button>
              {/* تم تغيير الزر إلى الأحمر مع الظل */}
              <button onClick={handleDeleteReceiptConfirm} style={{ flex: 1, padding: "12px", borderRadius: "30px", backgroundColor: "#dc3545", color: "white", border: "none", cursor: "pointer", fontWeight: "600", boxShadow: "0 4px 12px rgba(220,53,69,0.2)" }}>כן, הסר קבלה</button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}