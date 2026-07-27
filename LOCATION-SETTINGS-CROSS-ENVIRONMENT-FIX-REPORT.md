# تقرير إصلاح إدارة المناطق والأحياء عبر البيئات

## الحكم الحالي

**الإصلاح مكتمل ومختبر محليًا، ويحتاج نشر موردين وإعداد App Check للتطوير على
كل جهاز.** لم يُنفذ أي Deploy أو تعديل Production ضمن هذا العمل.

## السبب الجذري الحقيقي

هناك سببان مترابطان:

1. نسخة Hosting المنشورة تستدعي Callable باسم `updateLocationSettings`، لكن
   المشروع `mitchabrim-jce2026` لا يحتوي Cloud Function بهذا الاسم. أكدت
   `functions:list` وجود `inviteUser` و`mutateElderly` و`submitJoinRequest`
   فقط. كما أن `gcloud functions describe` وCloud Run يعيدان 404 ولا توجد
   Logs للدالة. طلب OPTIONS إلى عنوان الدالة من Origin الإنتاج ومن localhost
   يعيد `HTTP 404`.
2. الكود المحلي كان يحتوي fallback خاصًا بـ`import.meta.env.DEV`: عندما لا
   تتهيأ App Check ينفذ التعديل والنقل مباشرة عبر Firestore. لذلك بدا أن
   localhost يعمل رغم أن الدالة غير منشورة. هذا مسار مختلف عن الإنتاج وغير
   متاح في Production build.

كانت عمليات الحذف تسلك مسارًا ثالثًا: تعديل `settings/general.areas` مباشرة
عبر Firestore من دون فحص المراجع. عند فشل الكتابة كانت الواجهة تغيّر الحالة
محليًا أولًا وتعرض رسالة عامة، وقد يبدو الحذف ناجحًا لحظيًا ثم يعود بعد
التحديث، أو يترك مراجع يتيمة إذا نجح.

## سبب اختلاف السلوك بين البيئات

| البيئة | الحالة قبل الإصلاح |
|---|---|
| localhost على الجهاز الحالي | قد يستخدم fallback المباشر إذا كانت App Check غير مهيأة، أو يستخدم Debug Token مسجلًا لهذا origin |
| عنوان الشبكة مثل `http://10.0.0.4:8080` | Origin مستقل وله Debug Token مستقل؛ لا يرث token الخاص بـlocalhost |
| جهاز تطوير آخر | ملفات `.env*` غير متتبعة في Git، لذا قد تنقص Firebase/App Check variables؛ كما يحتاج المتصفح debug token مسجلًا |
| Hosting | App Check الإنتاجية مهيأة، لكن `updateLocationSettings` غير منشورة، فيفشل الطلب قبل منطق الدالة |

مفتاح reCAPTCHA Enterprise الحالي لا يسمح بكل الدومينات عمومًا، وهذا صحيح.
الدومينات المسجلة هي:

- `mitchabrim-jce2026.web.app`
- `mitchabrim-jce2026.firebaseapp.com`

لا يلزم إضافة localhost أو عنوان IP كاستثناء إنتاجي. التطوير يستخدم Firebase
App Check Debug Provider، ويجب تسجيل token الناتج لكل متصفح/origin/جهاز في
Firebase Console. لا تحفظ debug tokens في Git أو متغيرات Vite.

## Authentication وAuthorization وRules وIAM

- Callable المحلية معرفة في `us-central1` وبـ`enforceAppCheck: true`.
- الاستدعاء يستخدم `httpsCallable` و`getFunctions(app, "us-central1")`.
- الدالة تتحقق من Firebase Auth ثم من وثيقة المستخدم:
  `role == "admin"` و`status == "active"`.
- Firestore Rules المحلية تسمح بالكتابة الإدارية فقط عبر `isAdmin()`.
- تعذر قراءة نص Rules المنشور عبر Firebase Rules API لأن الحساب الحالي أعاد
  `403`; لذلك لا يُدعى أنها مطابقة حرفيًا.
- بعد الإصلاح لا تعتمد عمليات التعديل/النقل/الحذف على Firestore Rules
  للكتابة متعددة السجلات؛ Admin SDK في الدالة ينفذها، مع تحقق Admin صريح داخل
  المعاملة.
- لا توجد حاليًا خدمة Cloud Run لـ`updateLocationSettings`، وبالتالي لا توجد
  IAM policy لها. بعد النشر يجب التأكد من:
  `allUsers -> roles/run.invoker`. هذا يسمح بوصول HTTP إلى غلاف Callable فقط؛
  App Check وAuth وفحص المدير يبقون مفروضين داخل الدالة.

## التعديلات المنفذة

- أزيل fallback المباشر الخاص بـDEV. كل البيئات تستخدم Callable نفسها.
- أصبحت إعادة تسمية المنطقة والحي، نقل الحي، حذف الحي، وحذف المنطقة تمر جميعًا
  عبر `updateLocationSettings`.
- أضيف دعم server-side لـ`deleteArea` و`deleteNeighborhood`.
- الحذف يرفض بـ`failed-precondition` إذا وُجدت أي مراجع مرتبطة، ويعيد عددها
  للواجهة. لا يحذف سجلات مرتبطة ولا يتركها يتيمة.
- تشمل مطابقة المنطقة سجلات قديمة ينقصها `area` لكن حيها تابع للمنطقة المصدرية.
- استبدل `BulkWriter` ثم كتابة الإعدادات المنفصلة بمعاملة Firestore واحدة تشمل
  المراجع و`settings/general`. إذا فشل App Check أو الشبكة أو Auth فلا تبدأ
  المعاملة، وإذا فشلت المعاملة لا يحدث تعديل جزئي.
- حد العملية الذرية 450 مرجعًا، إضافة إلى مستند الإعدادات. إذا زاد العدد ترفض
  العملية قبل أي كتابة برسالة تطلب تدخلًا إداريًا بدل تنفيذ دفعات جزئية.
- أضيفت رسائل مفهومة لحالات انتهاء الجلسة، نقص صلاحية Admin، App Check،
  انقطاع الشبكة، الموقع المستخدم، وتجاوز الحد الذري.
- التسجيل التقني في المتصفح يقتصر على `code/message/details` ولا يسجل بيانات
  السجلات أو محتوى الطلب.
- أضيف `frontend/.env.example` آمن لتوحيد أسماء متغيرات Firebase وApp Check
  على أجهزة التطوير دون تضمين أسرار أو debug tokens.

## الملفات المعدلة

- `.gitignore`
- `frontend/.env.example`
- `frontend/functions/src/locationSettingsCore.js`
- `frontend/src/admin/Settings.jsx`
- `frontend/src/services/settingsService.js`
- `frontend/src/utils/elderlyFormModel.js`
- `frontend/tests/elderly-validation-location.test.mjs`
- `frontend/tests/db-01.firebase.test.mjs`
- `frontend/scripts/run-sec-06-tests.mjs`

يوجد أيضًا تعديل سابق غير متعلق بالمهمة في
`frontend/src/admin/SiteContent.jsx`، ولم يُغيّر ضمن هذا الإصلاح. تعديلات
اختبارات `mutateElderly` السابقة محفوظة كما هي.

## الاختبارات والنتائج

- `npm run test:elderly-settings`: **نجح، 9/9**.
  - إعادة تسمية منطقة وحي.
  - نقل حي.
  - حذف حي ومنطقة في النموذج.
  - منع التكرار والتحقق من أنواع العمليات.
  - منع رجوع fallback المحلي.
  - ثبات المنطقة وApp Check في تعريف Callable.
- `npm run test:db01`: **نجح**.
  - 6/6 اختبارات وحدة.
  - نجح Firestore/Auth Emulator.
  - Admin فعّال: تعديل حي، نقل حي، حذف حي فارغ، حذف منطقة فارغة.
  - مستخدم غير مخول: `permission-denied`.
  - حذف حي مرتبط: `failed-precondition` مع بقاء الإعدادات والمراجع بلا تغيير.
  - مدخل غير صالح: `invalid-argument`.
  - تحديث سجل قديم بلا `area`.
  - تحقق ذرية الإعدادات والمراجع.
- `npm run test:sec06`: **نجح** بعد إصلاح اكتشاف JDK 21+ في مشغل الاختبار.
  ويغطي فصل Callables العامة والمحمية وFirestore Rules ورفض غير المخول.
- `npm run build`: **نجح**، 2520 module.
- استيراد `functions/index.js`: **نجح**.
- فحص المتصفح:
  - localhost و`10.0.0.4:8080` قابلان للوصول ويعرضان التطبيق.
  - جلسة أداة الفحص غير مسجلة، لذلك أعيد التوجيه إلى login في البيئتين؛ لم
    تُستخدم أو تُطلب بيانات دخول ولم يُتجاوز Auth.
  - Hosting أعاد التوجيه إلى login للجلسة غير المسجلة.
- فحص preflight الحالي قبل النشر:
  - Origin الإنتاج: `HTTP 404`.
  - localhost: `HTTP 404`.
  - النتيجة متوافقة مع غياب Cloud Function، وليست دليلًا على CORS يحتاج
    ترويسة يدوية.

## ما يحتاج نشرًا أو إعدادًا

### 1. Cloud Function فقط

بعد موافقة صريحة:

```powershell
firebase deploy --only functions:updateLocationSettings `
  --project mitchabrim-jce2026
```

المورد المتوقع:

```text
Cloud Functions v2 / Cloud Run
Name: updateLocationSettings / updatelocationsettings
Region: us-central1
App Check: enforced
```

بعد النشر يجب فحص IAM. إذا لم يضف Firebase CLI invoker تلقائيًا، ينفذ Owner:

```powershell
gcloud run services add-iam-policy-binding updatelocationsettings `
  --region us-central1 `
  --project mitchabrim-jce2026 `
  --member=allUsers `
  --role=roles/run.invoker
```

لا يعطل هذا App Check أو Auth.

### 2. Firebase Hosting

يلزم نشر Hosting بعد نشر الدالة كي تصل تحسينات الحذف والذرية ورسائل الأخطاء:

```powershell
firebase deploy --only hosting --project mitchabrim-jce2026
```

لا يلزم نشر Firestore Rules أو indexes لهذا الإصلاح وفق الكود المحلي. لم
تُعدل Rules.

### 3. كل جهاز تطوير

1. انسخ `frontend/.env.example` إلى `.env.local` واملأ قيم تطبيق Firebase
   نفسه، بما فيها `VITE_FIREBASE_APPCHECK_SITE_KEY`.
2. أبقِ `VITE_FIREBASE_APPCHECK_DEBUG=true` في التطوير فقط.
3. افتح localhost أو عنوان الشبكة، نفذ عملية محمية، واقرأ Debug Token الذي
   يولده Firebase SDK.
4. سجّل token في Firebase Console > App Check > التطبيق الويب > Manage debug
   tokens.
5. كرر ذلك لكل browser origin/device. لا تشارك token ولا تضف استثناء domain
   عامًا.

## خطوات التحقق النهائي على جهازين والإنتاج

1. انشر Function المحددة ثم تحقق أنها v2 callable في `us-central1` وأن IAM
   تحتوي `allUsers/roles.run.invoker`.
2. افحص OPTIONS من localhost وHosting: يجب ألا يعيد 404 أو 403، ويجب أن تظهر
   ترويسات Callable CORS.
3. على الجهاز الأول عبر localhost، وبحساب Admin فعّال:
   - أعد تسمية حي ومنطقة.
   - انقل حيًا بين منطقتين.
   - احذف حيًا/منطقة غير مرتبطين.
   - حاول حذف موقع مرتبط وتأكد من رسالة عدد المراجع ومن عدم تغير البيانات.
4. افتح نفس خادم Vite من الجهاز الثاني عبر عنوان الشبكة، سجّل Debug Token لذلك
   origin، وكرر العمليات.
5. اختبر بحساب غير Admin وتأكد من رسالة عدم الصلاحية وعدم وجود كتابة.
6. افصل الشبكة قبل التأكيد وتأكد من رسالة الشبكة وعدم تغير الواجهة أو Firestore.
7. انشر Hosting، ثم كرر الخطوات على
   `https://mitchabrim-jce2026.web.app/admin/settings`.
8. راقب Logs: الرفض المتوقع يجب أن يكون App Check أو unauthenticated أو
   permission-denied أو validation/failed-precondition واضحًا، لا IAM/CORS/404
   ولا `FirebaseError: internal`.

