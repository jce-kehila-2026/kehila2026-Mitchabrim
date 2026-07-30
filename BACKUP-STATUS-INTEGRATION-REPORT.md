# BACKUP STATUS INTEGRATION

## طريقة جلب حالة النسخ

أُضيفت Callable Function إدارية للقراءة فقط باسم `getBackupStatus`. تتحقق أولًا من Firebase Authentication ومن أن سجل المستخدم في `users/{uid}` يحمل `role: admin` و`status: active`، ثم تستخدم هوية تشغيل Function لقراءة Firestore Admin REST API الرسمي.

تقرأ Function قاعدة `(default)`، جدول Managed Backups، والنسخ الموجودة عبر المناطق، ثم تعيد ملخصًا فقط. لا تعيد أسماء الموارد أو Backup IDs أو database UID أو IAM، ولا توفر أي عملية إنشاء أو حذف أو Restore.

## الملفات المعدلة

- `frontend/functions/src/backupStatusCore.js`: التحقق الإداري وتحويل استجابة Google Cloud إلى ملخص آمن.
- `frontend/functions/index.js`: تعريف Callable `getBackupStatus` مع App Check.
- `frontend/functions/package.json` و`package-lock.json`: إضافة `google-auth-library` كاعتماد مباشر.
- `frontend/src/services/settingsService.js`: استدعاء Function ومعالجة أخطاء آمنة.
- `frontend/src/admin/Settings.jsx`: حالات loading/success/failure/unavailable وزر تحديث الحالة.
- `frontend/tests/backup-status-integration.test.mjs`: اختبارات الصلاحيات والملخص والواجهة.
- `frontend/package.json`: أمر الاختبار الموجّه.

## هل أُضيفت Function؟

نعم: `getBackupStatus` في `us-central1`، مع `enforceAppCheck: true`. هي للقراءة فقط ولا تغيّر إعدادات Managed Backups.

## البيانات المعروضة

- تفعيل النسخ.
- النوع: Firestore Managed Backups.
- الجدول اليومي أو الأسبوعي وفق المصدر.
- مدة الاحتفاظ.
- منطقة قاعدة البيانات.
- حالة وتاريخ آخر نسخة.
- عدد النسخ بحالة READY.

جميع القيم التشغيلية تأتي من Google Cloud وليست hardcoded.

## الفحص ونتيجة Build

- `npm run test:backup-status`: نجحت 3 اختبارات من 3.
- Production build: نجح عبر `npm run build:production`، مع بقاء تحذير حجم بعض الحزم الموجود مسبقًا دون أخطاء بناء.

## ما يحتاج Deploy لاحقًا

لم يُنفذ أي Deploy. يلزم لاحقًا، بهذا الترتيب:

1. `firebase deploy --only functions:getBackupStatus --project mitchabrim-jce2026`
2. `firebase deploy --only hosting --project mitchabrim-jce2026`

لا يلزم نشر Firestore Rules أو Indexes، ولا تغيير جدول النسخ الحالي. حساب تشغيل Functions الحالي يملك صلاحية القراءة المطلوبة عبر دوره الحالي؛ لم يُعدّل IAM.
