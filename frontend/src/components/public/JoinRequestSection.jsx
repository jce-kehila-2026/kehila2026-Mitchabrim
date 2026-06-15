import { useState } from "react";
// هذا هو المسار الدقيق والصحيح لملف الفايربيس الخاص بك:
import { db } from "../../firebase"; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function JoinRequestSection() {
  // إنشاء ذاكرة حية (State) لحفظ القيم التي يكتبها المستخدم في الفورم
  const [form, setForm] = useState({ fullName: "", phone: "", type: "", message: "" });
  // حالة لمعرفة هل تم إرسال الطلب بنجاح لإظهار الرسالة الخضراء
  const [sent, setSent] = useState(false);
  // حالة تمنع المستخدم من الضغط على زر الإرسال مرتين متتاليتين أثناء التحميل
  const [isSubmitting, setIsSubmitting] = useState(false); 

  // دالة تحديث الحقول تلقائياً عند الكتابة داخلها
  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // الدالة البرمجية الحقيقية التي تأخذ البيانات وتطير بها إلى سيرفر Firebase
  const submit = async (e) => {
    e.preventDefault(); // منع المتصفح من إعادة تحميل الصفحة (المنطق الأساسي في React)
    
    // تأكيد أن الحقول الإجبارية ليست فارغة قبل بدء الاتصال بالإنترنت
    if (!form.fullName || !form.phone || !form.type) return;
    
    setIsSubmitting(true); // تفعيل وضع التحميل وقفل الأزرار الحقول

    try {
      // إرسال وحفظ كائن البيانات (Object) داخل جدول joinRequests في قاعدة البيانات
      await addDoc(collection(db, "joinRequests"), {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        // دمج نوع الطلب مع الرسالة لكي تظهر واضحة ومنظمة للمدير في لوحة التحكم
        note: `${form.type} - ${form.message}`.trim(), 
        type: form.type,
        createdAt: serverTimestamp() // إضافة ختم الوقت الرسمي من سيرفر جوجل للترتيب الزمني
      });

      // إذا نجحت العملية، نغير حالة sent إلى true لتظهر الكبسولة الخضراء للمستخدم
      setSent(true);
      // تفريغ الحقول بالكامل وإعادتها لنصوص فارغة لتهيئتها لطلب جديد
      setForm({ fullName: "", phone: "", type: "", message: "" });
      
      // مؤقت زمني (Timer) يقوم بإخفاء الرسالة الخضراء تلقائياً بعد 5 ثوانٍ
      setTimeout(() => setSent(false), 5000);

    } catch (error) {
      console.error("שגיאה בשליחת הפנייה:", error);
      alert("אירעה שגיאה בשליחת הפנייה. אנא נסו שוב.");
    } finally {
      setIsSubmitting(false); // إلغاء وضع التحميل وإعادة تفعيل زر الإرسال
    }
  };

  return (
    <section id="join" className="pub-section join-section">
      <div className="container join-grid">
        <div className="join-info">
          <span className="section-eyebrow">הצטרפות</span>
          <h2 className="section-title">רוצים להצטרף או לקבל פרטים?</h2>
          <p className="section-sub">השאירו פרטים ונחזור אליכם בהקדם ונשמח לעזור.</p>

          <ul className="join-points-clean">
            <li>
              <span className="jp-ico" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </span>
              <div>
                <h5>ליווי אישי ויחס חם</h5>
                <p>צוות שמקשיב, מלווה ועונה בזמן לכל פנייה.</p>
              </div>
            </li>
            <li>
              <span className="jp-ico" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                  <circle cx="10" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M17 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <div>
                <h5>שילוב במגוון פעילויות</h5>
                <p>התנדבות אישית, פרלמנטים, פרויקטי חגים ועוד.</p>
              </div>
            </li>
            <li>
              <span className="jp-ico" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </span>
              <div>
                <h5>תגובה תוך ימים ספורים</h5>
                <p>נחזור אליכם בתוך מספר ימי עבודה לעדכון הבא.</p>
              </div>
            </li>
          </ul>
        </div>

        {/* نموذج إدخال البيانات - مرتبط بدالة الـ submit عند الضغط على الزر */}
        <form className="join-card" onSubmit={submit}>
          {sent && <div className="join-success">הבקשה נשלחה בהצלחה. ניצור איתך קשר בהקדם.</div>}
          <div className="field">
            <label>שם מלא</label>
            <input className="input" value={form.fullName} onChange={update("fullName")} required disabled={isSubmitting} />
          </div>
          <div className="field">
            <label>טלפון</label>
            <input className="input" type="tel" value={form.phone} onChange={update("phone")} required disabled={isSubmitting} />
          </div>
          <div className="field">
            <label>סוג פנייה</label>
            <select className="select" value={form.type} onChange={update("type")} required disabled={isSubmitting}>
              <option value="">בחר/י סוג פנייה...</option>
              <option>אזרח ותיק</option>
              <option>פונה עבור אזרח ותיק אחר</option>
              <option>מתעניין בהתנדבות</option>
              <option>איש מקצוע</option>
              <option>אחר</option>
            </select>
          </div>
          <div className="field">
            <label>הודעה קצרה</label>
            <textarea className="textarea" rows={4} value={form.message} onChange={update("message")} disabled={isSubmitting} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
            {isSubmitting ? "שולח..." : "שליחת פנייה"}
          </button>
          <p className="join-note">נחזור אליך בהקדם ונשמח לעזור.</p>
        </form>
      </div>
    </section>
  );
}