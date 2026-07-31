import { useRef, useState } from "react";
import { createJoinRequest } from "../../services/joinRequestsService";
import { validatePhone, validateName, filterDigits, filterName } from "../../utils/validation";
import useSiteContent from "@/hooks/useSiteContent";

const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.()
  || `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;

export default function JoinRequestSection() {
  const { content } = useSiteContent();
  const j = content.join;
  // إنشاء ذاكرة حية (State) لحفظ القيم التي يكتبها المستخدم في الفورم
  const [form, setForm] = useState({ fullName: "", phone: "", type: "", message: "", email: "" });
  const [errors, setErrors] = useState({});
  // حالة لمعرفة هل تم إرסال הטופס בהצלחה
  const [resultStatus, setResultStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const idempotencyKey = useRef(newIdempotencyKey());

  const update = (k) => (e) => {
    let v = e.target.value;
    if (k === "fullName") v = filterName(v, 100);
    if (k === "phone") v = filterDigits(v, 10);
    setForm({ ...form, [k]: v });
    if (errors[k]) setErrors({ ...errors, [k]: "" });
  };

  const validateAll = () => {
    const errs = {};
    const nm = validateName(form.fullName); if (nm) errs.fullName = nm;
    const ph = validatePhone(form.phone); if (ph) errs.phone = ph;
    if (!form.type) errs.type = "יש לבחור סוג פנייה";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;
    setIsSubmitting(true);
    setResultStatus(null);

    try {
      const result = await createJoinRequest({
        fullName: form.fullName,
        phone: form.phone,
        type: form.type,
        message: form.message,
        email: form.email,
        idempotencyKey: idempotencyKey.current,
      });

      // إذا نجحت العملية، نغير حالة sent إلى true لتظهر الكبسولة الخضراء للمستخدم
      setResultStatus(result.status === "duplicate" ? "duplicate" : "success");
      // تفريغ الحقول بالكامل وإعادتها لنصوص فارغة لتهيئتها لطلب جديد
      setForm({ fullName: "", phone: "", type: "", message: "", email: "" });
      idempotencyKey.current = newIdempotencyKey();

      // مؤقت زمني (Timer) يقوم بإخفاء الرسالة الخضراء تلقائياً بعد 5 ثوانٍ
      setTimeout(() => setResultStatus(null), 5000);
    } catch (error) {
      const developmentSetupError = import.meta.env.DEV && [
        "join-request/app-check-debug-unsupported",
        "join-request/app-check-debug-token-rejected",
        "appCheck/fetch-status-error",
        "appCheck/initial-throttle",
        "appCheck/throttled",
      ].includes(error?.code);
      const rejected = ["app-check-not-configured", "app-check-unavailable", "functions/unauthenticated", "functions/resource-exhausted", "functions/failed-precondition", "functions/permission-denied", "functions/invalid-argument"].includes(error?.code);
      setResultStatus(developmentSetupError ? "development-setup" : rejected ? "rejected" : "failed");
    } finally {
      setIsSubmitting(false); // إلغاء وضع التحميل وإعادة تفعيل زر الإرسال
    }

  };

  return (
    <section id="join" className="pub-section join-section">
      <div className="container join-grid">
        <div className="join-info">
          <span className="section-eyebrow">{j.eyebrow}</span>
          <h2 className="section-title">{j.title}</h2>
          <p className="section-sub">{j.subtitle}</p>

          <ul className="join-points-clean">
            {(j.points && j.points.length > 0
              ? j.points
              : [
                  { title: "ליווי אישי ויחס חם", desc: "צוות שמקשיב, מלווה ועונה בזמן לכל פנייה." },
                  { title: "שילוב במגוון פעילויות", desc: "התנדבות אישית, פרלמנטים, פרויקטי חגים ועוד." },
                  { title: "תגובה תוך ימים ספורים", desc: "נחזור אליכם בתוך מספר ימי עבודה לעדכון הבא." },
                ]
            ).map((pt, i) => (
              <li key={i}>
                <span className="jp-ico" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </span>
                <div>
                  <h5>{pt.title}</h5>
                  <p>{pt.desc}</p>
                </div>
              </li>
            ))}
          </ul>

        </div>

        <form className="join-card" onSubmit={submit}>
          {resultStatus === "success" && <div className="join-success" role="status">{j.successText}</div>}
          {resultStatus === "duplicate" && <div className="join-success" role="status">הפנייה כבר התקבלה. אין צורך לשלוח שוב.</div>}
          {resultStatus === "development-setup" && <div className="join-success" role="alert">אימות סביבת הפיתוח אינו מוגדר בדפדפן הזה. יש לרשום ב-Firebase את App Check Debug Token שמופיע במסוף הדפדפן ולנסות שוב. בחיבור דרך הרשת מומלץ להשתמש ב-HTTPS.</div>}
          {resultStatus === "rejected" && <div className="join-success" role="alert">לא ניתן לשלוח את הפנייה כרגע. אנא בדקו את הפרטים ונסו שוב מאוחר יותר.</div>}
          {resultStatus === "failed" && <div className="join-success" role="alert">שליחת הפנייה נכשלה. אנא נסו שוב.</div>}
          <div className="field">
            <label>שם מלא</label>
            <input
              className="input"
              value={form.fullName}
              onChange={update("fullName")}
              required
              disabled={isSubmitting}
              maxLength={100}
            />
            {errors.fullName && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.fullName}</div>}
          </div>
          <div className="field">
            <label>טלפון</label>
            <input
              className="input"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={update("phone")}
              required
              disabled={isSubmitting}
            />
            {errors.phone && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.phone}</div>}
          </div>
          <div className="field">
            <label>אימייל (אופציונלי)</label>
            <input
              className="input"
              type="email"
              value={form.email || ""}
              onChange={update("email")}
              disabled={isSubmitting}
            />
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
            {errors.type && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{errors.type}</div>}
          </div>
          <div className="field">
            <label>הודעה קצרה</label>
            <textarea
              className="textarea"
              rows={4}
              value={form.message}
              onChange={update("message")}
              disabled={isSubmitting}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={isSubmitting}>
            {isSubmitting ? "שולח..." : j.buttonText || "שליחת פנייה"}
          </button>
          <p className="join-note">{j.note}</p>
        </form>
      </div>
    </section>
  );
}
