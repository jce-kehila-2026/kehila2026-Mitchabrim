# PROD-01 — تقرير حالة Firebase المنشورة

التاريخ: 2026-07-27  
المشروع المتوقع: `mitchabrim-jce2026`  
نوع الفحص: محلي + حاجز أمان Production، دون Deploy أو Migration أو كتابة

## Executive Summary

لم يمكن إثبات تطابق الموارد المحلية مع Firebase Production لأن حاجز الأمان
المطلوب لم يكتمل:

- `npx firebase-tools use` أعاد حرفيًا `mitchabrim-jce2026`.
- `gcloud config get-value project` تعذر تشغيله لأن `gcloud` غير مثبت أو غير
  متاح في `PATH`.

بناءً على شرط المهمة، لم تُنفذ بعد ذلك أي أوامر تقرأ Production، حتى لو كانت
قراءة فقط. لذلك لا يصح تصنيف Hosting أو Functions أو Rules أو Indexes أو TTL
على أنها مطابقة أو تحتاج نشرًا. الحالة الصحيحة هي **غير متحققة بالكامل**،
وتحتاج إعادة الفحص بعد تثبيت/تهيئة `gcloud` وإثبات أن مشروعه النشط هو
`mitchabrim-jce2026`.

نجح البناء وجميع الاختبارات المحلية المختارة، لكن هذا دليل على صلاحية الحالة
المحلية فقط وليس دليلًا على النشر.

## حاجز المشروع والموارد المستهدفة

| البند | الدليل المحلي | النتيجة |
|---|---|---|
| Firebase CLI project | `firebase-tools use` → `mitchabrim-jce2026` | متحقق |
| gcloud project | الأمر غير متاح | غير متحقق؛ أوقف فحص Production |
| `.firebaserc` | default = `mitchabrim-jce2026` | متحقق محليًا |
| مشروع الواجهة | `VITE_FIREBASE_PROJECT_ID=mitchabrim-jce2026` | متحقق محليًا |
| Firestore database | SDK يستخدم قاعدة المشروع الافتراضية؛ لم تُقرأ Production | يحتاج تحقق |
| Storage bucket | الواجهة مضبوطة على bucket مشروع `mitchabrim-jce2026` | متحقق محليًا فقط |

لم تُطبع Tokens أو Secrets أو بيانات مستخدمين.

## جدول المقارنة المحلي مقابل Production

| المورد | الحالة المحلية | دليل Production | الحكم |
|---|---|---|---|
| Hosting | `dist` ناجح، 132 ملفًا، وSPA rewrite موجود | لم يُقرأ | يحتاج تحقق يدوي/إعادة الفحص |
| `submitJoinRequest` | موجودة، callable، Node 22، المنطقة الافتراضية `us-central1` | لم يُقرأ | غير متحققة بالكامل |
| `inviteUser` | موجودة، callable، `us-central1`، App Check مفروض | لم يُقرأ | غير متحققة بالكامل |
| `mutateElderly` | موجودة، callable، `us-central1`، App Check مفروض | لم يُقرأ | غير متحققة بالكامل |
| Firestore Rules | ملف محلي ينجح في Emulator | لم تُنزّل ruleset منشورة | غير متحققة بالكامل |
| Storage Rules | ملف محلي ينجح في Emulator | لم تُنزّل ruleset منشورة | غير متحققة بالكامل |
| Firestore Indexes | 7 composite indexes محلية | لم تُقرأ الفهارس المنشورة أو حالاتها | غير متحققة بالكامل |
| TTL Policies | 3 field overrides محلية | لم تُقرأ سياسات Production | غير متحققة بالكامل |
| Authentication | الكود يستخدم Firebase Auth | لم تُقرأ إعدادات المشروع | يحتاج مراجعة Console/CLI |
| App Check | دعم محلي موجود، وعمليات إدارية تفرضه | registrations/enforcement لم تُقرأ | يحتاج مراجعة Console/CLI |

لا يوجد دليل يسمح بوسم أي مورد بـ«يحتاج نشر». كما لا يوجد دليل يسمح بوسمه
«مطابق».

## Firebase Hosting

الحالة المحلية:

- `firebase.json` يحدد `dist` كمجلد النشر.
- SPA rewrite صحيح محليًا: `**` → `/index.html`.
- `npm.cmd run build` أنشأ 132 ملفًا.
- Hosting smoke المحلي تحقق من `/`, `/login`, `/admin`, `/admin/media`,
  `/volunteer/tasks`, و`/public-gallery` ومن تحميل entry JavaScript.

ما لم يمكن إثباته:

- آخر Hosting release ووقته.
- hash أو manifest الإصدار المنشور.
- أن الصفحة المنشورة تستخدم chunks الحالية لا القديمة.
- أن routes المنشورة الفعلية تعيد الإصدار الحالي.
- هل يلزم Deploy جديد.

الحكم: **يحتاج إعادة تحقق Production**. نجاح smoke كان ضد `dist` المحلي، لا
ضد Firebase Hosting المنشور.

## Cloud Functions

الدوال المحلية الوحيدة:

| Function | المنطقة المحلية | Runtime المحلي | الحماية المحلية |
|---|---|---|---|
| `submitJoinRequest` | الافتراضية `us-central1` | Node.js 22 | validation/rate limits/idempotency؛ secret معرف دون عرض قيمته |
| `inviteUser` | `us-central1` | Node.js 22 | Auth + App Check |
| `mutateElderly` | `us-central1` | Node.js 22 | Auth + App Check |

لم يمكن قراءة قائمة Functions المنشورة، حالتها، وقت تحديثها، source hash أو
runtime. لذلك لم يمكن تحديد Function محلية غير منشورة أو منشورة غير موجودة
محليًا.

الحكم لكل الدوال: **غير متحققة بالكامل**.

## Firestore Rules

الملف المحلي: `frontend/firestore.rules`. نجحت قواعده في اختبارات Emulator
ذات الصلة. لم تُنزّل ruleset المنشورة ولم يُقارن source أو release/hash.
نجاح compilation والاختبارات لا يثبت التطابق مع Production.

الحكم: **غير متحققة بالكامل**.

## Storage Rules

الملف المحلي: `frontend/storage.rules`. نجح في اختبارات Emulator، بما فيها
حدود الحجم وMIME. لم تُنزّل ruleset المنشورة ولم تُقارن بالمحلية.

الحكم: **غير متحققة بالكامل**.

## Firestore Indexes

`frontend/firestore.indexes.json` يحتوي محليًا على 7 composite indexes:

1. `elderly`: `status + searchPrefixes`
2. `volunteerReports`: `volunteerAuthUid + createdAt desc`
3. `volunteerReports`: `volunteerId + createdAt desc`
4. `profileUpdateRequests`: `volunteerAuthUid + createdAt desc`
5. `volunteerNotifications`: `volunteerAuthUid + createdAt desc`
6. `volunteerTasks`: `volunteerId + createdAt desc`
7. `volunteerTasks`: `volunteerAuthUid + createdAt desc`

نجح فحص 80 حالة استعلام و214 variant ضد Emulator. لم تُقرأ قائمة Production
ولم يمكن إثبات أن كل index منشور وحالته `READY` أو عدم وجود فهارس زائدة.

الحكم: **غير متحققة بالكامل**.

## TTL Policies

الـfield overrides المحلية تطلب TTL على `expiresAt` لهذه المجموعات:

- `joinRequestIdempotency`
- `joinRequestDuplicates`
- `joinRequestRateLimits`

نجحت اختبارات DB-03 المحلية، لكن لم يُنفذ أمر Production لإثبات أن السياسات
الثلاث ما زالت `ACTIVE`. لم تُفعّل أو تُعطّل أي Policy.

الحكم: **غير متحققة بالكامل**.

## Authentication وApp Check

أمكن إثبات محليًا:

- الواجهة تستهدف مشروع `mitchabrim-jce2026`.
- التطبيق يستخدم Firebase Authentication.
- Email/password login موجود في الكود.
- `inviteUser` و`mutateElderly` تفرضان App Check محليًا.

لم يمكن إثبات:

- Authorized Domains الفعلية.
- تفعيل Email/Password provider في Production.
- MFA policy.
- App Check app registrations.
- App Check enforcement الفعلي لكل منتج.
- Password policy وEmail Enumeration Protection.

الحكم: **يحتاج مراجعة Console أو API/CLI قراءة فقط بعد اجتياز حاجز المشروع**.

## الموارد غير المنشورة أو الزائدة

- موارد محلية غير منشورة: **غير قابلة للتحديد** دون قائمة Production.
- موارد منشورة غير موجودة محليًا: **غير قابلة للتحديد** دون قائمة Production.

## الأوامر والاختبارات المنفذة

| الأمر | النتيجة |
|---|---|
| `npx firebase-tools use` | نجح: `mitchabrim-jce2026` |
| `gcloud config get-value project` | تعذر: `gcloud` غير مثبت/غير متاح |
| `npm.cmd run build` | نجح؛ تحذير حجم chunk فقط |
| `npm.cmd run test:smoke` | نجح ضد `dist` المحلي |
| `npm.cmd run test:sec06` | نجح |
| `npm.cmd run test:sec09` | نجح، 20 فحصًا |
| `npm.cmd run test:db03` | نجح، 4 unit + Emulator |
| `npm.cmd run test:db04` | نجح، 5 unit + 80 cases/214 checks |
| `npm.cmd run test:reliability` | نجح، unit/React/Firebase Emulator |

لم يُشغّل `audit:db04:production` لأنه يتطلب قراءة Production بعد حاجز لم
يكتمل. كل الكتابات التي ظهرت في الاختبارات كانت داخل مشاريع Emulator من نوع
`demo-*`.

## الأمور التي لم يمكن إثباتها

- آخر Hosting deployment وتطابق manifest/chunks.
- قائمة Functions المنشورة وmetadata وsource hashes.
- تطابق Firestore وStorage rulesets.
- قائمة الفهارس المنشورة وحالة `READY`.
- حالة TTL الفعلية `ACTIVE`.
- Authentication providers/domains/MFA.
- App Check registrations وenforcement.
- اسم Firestore database وStorage bucket الفعليين من Production APIs.

## خطوات إعادة الفحص الآمنة

قبل أي أمر Production:

```powershell
npx.cmd firebase-tools use
gcloud config get-value project
```

يجب أن يعيد كلاهما حرفيًا `mitchabrim-jce2026`. بعد ذلك فقط تُستخدم أوامر
قراءة مثل قوائم Hosting releases وFunctions وindexes وTTL، وتنزيل rulesets
المنشورة إلى مجلد مؤقت للمقارنة. يجب عدم طباعة access tokens أو إعدادات تحتوي
قيم secrets.

## أوامر النشر المطلوبة — لا تُنفذ الآن

لا يمكن تحديد أن النشر مطلوب قبل إكمال المقارنة. إذا أثبت الفحص لاحقًا فرقًا،
تُستخدم أوامر scoped فقط بعد موافقة منفصلة، مثل:

```powershell
npx.cmd firebase-tools deploy --only hosting --project mitchabrim-jce2026
npx.cmd firebase-tools deploy --only functions:FUNCTION_NAME --project mitchabrim-jce2026
npx.cmd firebase-tools deploy --only firestore:rules --project mitchabrim-jce2026
npx.cmd firebase-tools deploy --only storage --project mitchabrim-jce2026
npx.cmd firebase-tools deploy --only firestore:indexes --project mitchabrim-jce2026
```

لا تُستخدم هذه القائمة كخطة نشر جماعية؛ ينفذ فقط المورد المثبت اختلافه.
سياسات TTL وإعدادات Authentication/App Check تحتاج أوامر أو Console منفصلة
بعد مراجعة صريحة ولا ينبغي تغييرها ضمن deploy عام.

## ترتيب النشر الآمن المشروط

إذا أثبت الفحص فروقًا وبعد الموافقة:

1. حفظ metadata وrulesets وmanifests الحالية كدليل rollback.
2. نشر Rules المتوافقة قبل كود يعتمد عليها، بعد Emulator tests.
3. نشر indexes الجديدة وانتظار `READY` دون حذف القديمة تلقائيًا.
4. التحقق من TTL دون تغييرها؛ معالجة أي فرق كعملية مستقلة.
5. نشر Function واحدة في كل مرة ثم فحص logs/health.
6. نشر Hosting أخيرًا إذا كان يعتمد على Functions الجديدة.
7. إجراء smoke read-only على routes وcallables الآمنة.

## التحقق بعد النشر والـRollback

- Hosting: تحقق من routes وasset manifest؛ rollback من Firebase Hosting
  Console إلى release السابق المثبت.
- Functions: تحقق من region/runtime/state/logs؛ rollback بإعادة نشر source
  revision السابقة للدالة المحددة فقط.
- Firestore/Storage Rules: نفذ permission matrix؛ rollback بإعادة نشر ruleset
  السابقة المحفوظة.
- Indexes: انتظر `READY` واختبر الاستعلامات؛ لا تحذف index قديمًا في rollback
  قبل إثبات عدم استخدامه.
- TTL: تحقق من `ACTIVE`؛ لا تعطل policy كـrollback تلقائي.
- Authentication/App Check: اختبر login والأدوار؛ rollback يدوي ومحدد لكل
  setting بعد توثيق القيمة السابقة.

## الحكم النهائي

| المورد | الحكم |
|---|---|
| Hosting | يحتاج تحقق يدوي/إعادة فحص Production |
| Cloud Functions | غير آمن للاعتماد عليه دون تحقق |
| Firestore Rules | غير آمن للاعتماد عليه دون تحقق |
| Storage Rules | غير آمن للاعتماد عليه دون تحقق |
| Firestore Indexes | غير آمن للاعتماد عليه دون تحقق |
| TTL Policies | يحتاج تحقق Console/CLI |
| Authentication | يحتاج تحقق Console يدوي |
| App Check | يحتاج تحقق Console يدوي |

حكم PROD-01: **غير قابلة للإثبات بالحالة الحالية**.

السبب الوحيد الذي منع المقارنة المنشورة هو عدم توفر `gcloud` لإكمال حاجز
المشروع الإلزامي. لم يُنفذ Deploy أو Migration أو حذف أو تعديل Production.
