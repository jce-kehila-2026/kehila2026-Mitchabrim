# تقرير إصلاح قابلية استخدام نظام إدارة الصور

## 1. النتيجة التنفيذية

تم تنفيذ إصلاح محلي بسيط ومتوافق مع المرحلتين الأولى والثانية، دون نشر أو كتابة على Production.

اختير الحقل:

```js
siteAsset: boolean
```

للفصل بين ثلاثة مفاهيم مستقلة:

- `isPublic`: يمكن الوصول إلى الصورة كرابط عام.
- `showInGallery`: تظهر الصورة في الجاليريا العامة.
- `siteAsset`: صورة محفوظة ومخصصة للاستخدام في الموقع العام.

أما الاستخدام الفعلي الحالي في قسم محدد فيبقى ممثلًا فقط بواسطة:

```js
usageRefs
usageCount
```

لا تعتمد الحماية الجديدة على `category`. تستخدم الفئة القديمة `תמונות אתר פרסומי` فقط في backfill للبيانات القديمة.

## 2. ما تمت مراجعته

قُرئ كاملًا:

- `IMAGE-MANAGEMENT-PHASE-1-FIX-REPORT.md`
- `IMAGE-MANAGEMENT-PHASE-2-FIX-REPORT.md`

ثم تمت مقارنة التقريرين مع الكود الحالي في:

- واجهة `Media.jsx`.
- خدمة `imagesService.js`.
- `mutateImage` و`saveSiteContentSection`.
- Firestore وStorage Rules.
- App Check وإعداد Functions في `firebase.js`.
- ترحيلات الجاليريا ومراجع صور الموقع.
- اختبارات القواعد والترحيل الحالية.
- حالة Functions المنشورة قراءةً فقط عبر `gcloud`.

لم يوجد ملف `.openai/hosting.json`، ولذلك بقي المشروع على Firebase Hosting وبنيته الحالية.

## 3. السبب الحقيقي لكل مشكلة

### 3.1 غموض التبويبات والفلاتر

كان شرط التبويب يطبّق بعد تحميل صفحة عامة من الصور:

```js
activeTab === "gallery" && img.showInGallery
activeTab === "site" && img.usageCount > 0
```

المشاكل:

1. تبويب صور الموقع كان يعني «مستخدمة الآن» بدل «مخصصة للموقع».
2. التصفية كانت محلية على أول صفحة محملة، لذلك قد يظهر التبويب فارغًا مع وجود صور مطابقة في صفحات لاحقة.
3. فلتر الحالة كان يظهر داخل كل التبويبات، رغم أن بعض خياراته متعارضة أو زائدة عن معنى التبويب.

### 3.2 فراغ تبويب صور الموقع

لم يكن هناك حقل مستقل لصور الموقع. اعتمد التبويب على `usageCount > 0`، لذلك:

- الصورة المحفوظة للموقع وغير المستخدمة حاليًا لا تظهر.
- الصورة المستخدمة تظهر حتى لو لم توجد فكرة مستقلة عن «مخصصة للموقع».
- بيانات Phase 1 القديمة لا تحتوي أصلًا على `siteAsset`.

### 3.3 تعطل زر العامة/الخاصة

تتبع التدفق أثبت أن الواجهة تستدعي:

```text
Media.jsx
  -> toggleImagePublic()
  -> getSecureFunctions()
  -> httpsCallable("mutateImage")
  -> mutateImage Cloud Function
```

`getSecureFunctions()` يستخدم Functions في `us-central1`، ويتطلب App Check مهيأ قبل إنشاء الاستدعاء. هذا صحيح أمنيًا.

الفحص القرائي الفعلي للمشروع أكد:

- الحساب النشط: مسجل الدخول.
- المشروع النشط: `mitchabrim-jce2026`.
- `mutateImage` في `us-central1`: غير موجودة، وطلب الوصف أعاد 404.
- `saveSiteContentSection` في `us-central1`: غير موجودة، وطلب الوصف أعاد 404.

إذًا السبب المباشر لتعطل الزر في النسخة المنشورة هو أن Hosting/الواجهة تعتمد على callable غير منشورة. Firestore Rules تمنع تغيير الخصوصية مباشرة من العميل عمدًا، لذلك لا يوجد مسار بديل ضعيف.

هناك رفض صحيح إضافي عند التحويل إلى خاصة:

- يجب أن تكون `imageReferenceSchemaVersion === 2`.
- يجب ألا تكون الصورة في الجاليريا.
- يجب ألا تكون مستخدمة فعليًا.
- بعد هذا الإصلاح يجب ألا تكون `siteAsset`.

كان الخطأ العام في الواجهة يخفي الفرق بين Function غير منشورة، App Check، Auth، الترحيل، الجاليريا، والاستخدام الفعلي.

## 4. الحل النهائي ولماذا

اختير `siteAsset` كـBoolean داخل وثيقة الصورة نفسها لأنه:

- أبسط من إنشاء مجموعة مراجع جديدة.
- لا يضيف N+1 reads.
- يمكن الاستعلام عنه وتقسيمه إلى صفحات مباشرة.
- مستقل عن الجاليريا والفئة.
- متوافق مع `usageRefs` الموجود.
- يمكن حمايته داخل نفس `mutateImage` والمعاملة الحالية.

لم تتم إضافة `usageType` أو collection جديدة لأن المطلوب تصنيف بسيط، بينما مواقع الاستخدام الفعلية ممثلة بالفعل في `usageRefs`.

## 5. نموذج البيانات قبل وبعد

### قبل

```js
{
  isPublic,
  showInGallery,
  usageRefs,
  usageCount,
  status,
  // بقية بيانات الصورة
}
```

### بعد

```js
{
  isPublic,
  showInGallery,
  siteAsset,
  usageRefs,
  usageCount,
  status,
  // بقية بيانات الصورة
}
```

القواعد الدلالية:

```text
showInGallery == true  => isPublic == true
siteAsset == true      => isPublic == true
usageCount > 0         => استخدام فعلي، وليس مجرد تصنيف
```

رفع صورة جديدة أو إنشاء صورة خارجية يبدأ بـ:

```js
siteAsset: false
```

حفظ قسم عام يستخدم صورة مدارة يضبط `siteAsset: true` تلقائيًا في المعاملة نفسها؛ لا يزيله تلقائيًا عند توقف الاستخدام، حتى يبقى قرار إزالة الصورة من مخزن صور الموقع صريحًا.

## 6. سلوك التبويبات والفلاتر بعد الإصلاح

### כל התמונות

- استعلام جميع الصور النشطة المقسمة إلى صفحات.
- يسمح بفلتر الحالة، والفئة، والبحث، والتاريخ، والترتيب.

### תמונות הגלריה

- شرط ثابت في استعلام Firestore:

```js
where("showInGallery", "==", true)
```

- لا يستطيع فلتر محلي إلغاء هذا الشرط.
- يبقى البحث والفئة والتاريخ والترتيب عوامل تضييق فقط.

### תמונות האתר

- شرط ثابت في استعلام Firestore:

```js
where("siteAsset", "==", true)
```

- لا يعتمد على `usageCount` أو `category`.
- يعرض الصور المخصصة للموقع سواء كانت مستخدمة الآن أم محفوظة لاستخدام لاحق.

أُخفي فلتر «الحالة» من تبويبي الجاليريا والموقع لأنه زائد أو مربك فيهما، وبقيت الفلاتر غير المتعارضة.

لا يحتاج الاستعلامان إلى composite index جديد؛ اختُبرا مع `orderBy(documentId())` وpagination على Emulator.

## 7. إضافة وإزالة صورة من صور الموقع

أضيف زران واضحان إلى البطاقة ونافذة التفاصيل:

- `הוסף לתמונות האתר`
- `הסר מתמונות האתר`

### الإضافة

تستدعي:

```text
mutateImage({ operation: "add-site-asset" })
```

والنتيجة:

- الصورة الخاصة المدارة تنقل بأمان إلى مسار Storage العام.
- تصبح `isPublic: true`.
- تصبح `siteAsset: true`.
- لا تتغير `showInGallery`.
- العملية محمية بـApp Check وAuthentication والتحقق من Admin فعّال.
- قفل العملية الحالي يمنع تنفيذ عمليتين متعارضتين.

### الإزالة

تستدعي:

```text
mutateImage({ operation: "remove-site-asset" })
```

وتقوم فقط بضبط:

```js
siteAsset: false
```

ولا:

- تحذف الصورة.
- تغير الخصوصية.
- تضيفها أو تزيلها من الجاليريا.

إذا كان `usageRefs` غير فارغ أو `usageCount > 0`، ترفض Function الإزالة وتعيد مواقع الاستخدام المتاحة إلى الواجهة.

## 8. قواعد الحذف والخصوصية

تمنع Function الحذف أو التحويل إلى خاصة إذا تحقق أي مما يلي:

- `usageRefs` غير فارغ.
- `usageCount > 0` حتى لو كانت `usageRefs` ناقصة.
- `siteAsset === true`.
- `showInGallery === true`.
- ترحيل مراجع الموقع لم يصل إلى `imageReferenceSchemaVersion: 2`.

الحماية في Function هي المصدر الحاسم. فحوص الواجهة موجودة لتحسين الرسالة فقط ولا يمكن الاعتماد عليها لتجاوز الخادم.

Firestore Rules:

- تمنع العميل من تغيير `siteAsset`.
- تمنع إنشاء `siteAsset: true` مباشرة من الواجهة.
- تسمح للصورة الجديدة أن تبدأ بـ`siteAsset: false`.
- تفرض أن `siteAsset: true` لا يمكن أن تكون مع `isPublic: false`.
- لا توسع صلاحيات المستخدم العام أو المتطوع.

لم تتغير Storage Rules في هذا الإصلاح؛ النقل والحذف المديران يبقيان داخل Function بواسطة Admin SDK.

## 9. تحسين الأخطاء

أصبحت الواجهة تميز برسائل آمنة ومفهومة بين:

- صورة مستخدمة، مع العدد وأسماء المواقع عند توفرها.
- صورة مصنفة كصورة موقع.
- صورة موجودة في الجاليريا.
- ترحيل المراجع غير مكتمل.
- الصورة غير موجودة.
- `mutateImage` غير منشورة/غير متاحة.
- App Check غير مهيأ أو فشل.
- المستخدم غير موثق أو غير مخول.
- فشل شبكة.
- رد callable غير متوافق بين Hosting وFunction.

كما أصبحت الخدمة تتحقق من:

- وجود `imageId`.
- وجود `response.data.image` لعمليات التحديث.
- وجود `response.data.deleted === true` للحذف.

وبذلك لا تظهر العملية ناجحة إذا أعادت Function ردًا قديمًا أو ناقصًا.

## 10. Migration / Backfill

أضيف:

```text
frontend/scripts/image-site-asset-backfill.mjs
```

الوضع الافتراضي Dry-run:

```powershell
cd frontend
$env:GCLOUD_PROJECT = "mitchabrim-jce2026"
$env:FIRESTORE_ACCESS_TOKEN = gcloud auth print-access-token
npm.cmd run backfill:image-site-assets:dry-run
```

يبلغ عن:

- `scanned`
- `planned`
- `alreadyExplicit`
- `invalidExisting`
- `plannedTrue`
- `plannedFalse`
- `inferredFromUsage`
- `inferredFromLegacyCategory`

منطق الصور القديمة:

- إذا كان `siteAsset` Boolean موجودًا، لا يغيره مطلقًا.
- إذا كان الحقل مفقودًا:
  - `true` عند وجود `usageRefs` أو `usageCount > 0`.
  - `true` عند الفئة القديمة `תמונות אתר פרסומי` كترحيل legacy فقط.
  - `false` لبقية الصور.
- إذا كانت قيمة موجودة من نوع غير Boolean، يسجل `invalidExisting` ويرفض apply.

تطبيق Production محمي بتأكيدين صريحين:

```powershell
node scripts/image-site-asset-backfill.mjs --apply --production --confirm-project=mitchabrim-jce2026
```

لم يُنفذ Dry-run أو Apply على Production في هذا العمل. اختُبر Dry-run ثم Apply ثم Dry-run بقيمة `planned = 0` على Emulator فقط.

## 11. الملفات المعدلة

- `frontend/src/admin/Media.jsx`
  - تثبيت معنى التبويبات، أزرار صور الموقع، الشارات، التأكيدات ورسائل الخطأ.
- `frontend/src/services/imagesService.js`
  - تطبيع `siteAsset`، استعلامات pagination حسب التبويب، وعمليات callable موحدة مع فحص الرد.
- `frontend/src/utils/imageLibraryFilters.js`
  - شروط نقية وثابتة لهوية التبويب وفلاتر التضييق.
- `frontend/functions/src/imageMutationCore.js`
  - عمليتا إضافة/إزالة صورة موقع والحمايات الخادمية.
- `frontend/functions/src/siteContentImageCore.js`
  - تعليم الصورة كـ`siteAsset` عند استخدامها فعليًا في قسم عام.
- `frontend/firestore.rules`
  - invariant بين `siteAsset` و`isPublic` ومنع تزوير التصنيف من العميل.
- `frontend/scripts/image-site-asset-backfill.mjs`
  - backfill آمن وidempotent وDry-run افتراضي.
- `frontend/package.json`
  - أوامر الاختبار وDry-run.
- `frontend/tests/image-management-usability.test.mjs`
  - اختبارات التبويبات، الحمايات، callable، الواجهة والترحيل.
- `frontend/tests/image-management-phase1.test.mjs`
  - تحديث عقد الاختبار ليتوافق مع helper callable الموحد.
- `frontend/tests/image-management-phase2.test.mjs`
  - التحقق من تعليم الصورة المستخدمة كصورة موقع.
- `frontend/tests/sec-03.rules.test.mjs`
  - اختبارات Rules والاستعلامات وbackfill على Emulator.

لم تعدل:

- `frontend/storage.rules`
- `frontend/firestore.indexes.json`

## 12. الاختبارات والنتائج

### اختبارات Node

```text
test:image-management             5/5 ناجحة
test:image-management-phase2      9/9 ناجحة
test:image-management-usability   5/5 ناجحة
test:categories                   6/6 ناجحة
الإجمالي                          25/25 ناجحة
```

غطت:

- ثبات معنى التبويبات.
- استقلال `siteAsset` عن الجاليريا.
- تحويل صورة خاصة إلى صورة موقع عامة دون إضافتها للجاليريا.
- إزالة التصنيف دون تغيير الخصوصية أو الجاليريا.
- منع الحذف والخصوصية لصور الموقع.
- منع إزالة التصنيف عند وجود `usageRefs` أو `usageCount`.
- عدم الكتابة فوق Boolean صحيح في الترحيل.
- عدم استخدام category إلا لترحيل legacy.
- فحص عقود الواجهة والخدمة والـFunction والقواعد.

### Firebase Emulator

نجح `test:sec03`، بما يشمل:

- Admin فقط ينشئ metadata وفق القيود.
- المتطوع والعام لا يكتبان.
- العميل Admin لا يزور `siteAsset`.
- `siteAsset: false` صالح للصورة الجديدة.
- الاستعلام المقسم للجاليريا وصور الموقع.
- Dry-run لترحيل `siteAsset`.
- Apply على Emulator فقط.
- Dry-run لاحق بقيمة `planned = 0`.
- اختبارات Storage lifecycle والترحيلات السابقة.

رسائل `PERMISSION_DENIED` الظاهرة في سجل الاختبار هي الحالات السلبية المتوقعة التي أثبتت رفض الصلاحيات غير المسموحة.

## 13. نتيجة Production build

نجح:

```text
npm.cmd run build:production
2525 modules transformed
Hosting artifact verification passed
```

بقي تحذير Vite الموجود عن حجم chunk الرئيسي، وهو تحذير أداء غير مانع وغير ناتج عن هذا الإصلاح.

## 14. ما يحتاج لاحقًا إلى نشر أو تشغيل

لم ينفذ أي أمر نشر.

حالة Production المقروءة تثبت أن Functions الخاصة بالمرحلة الثانية غير موجودة. لذلك يحتاج الإصدار المتكامل إلى:

1. نشر Functions:

```powershell
firebase deploy --only functions:mutateImage,functions:saveSiteContentSection --project mitchabrim-jce2026
```

2. تشغيل Dry-run لترحيل مراجع صور الموقع الحالي والتأكد من عدم وجود `unmatched` أو `ambiguous` أو `invalid`.
3. تطبيق ترحيل مراجع الصور فقط بعد مراجعة النتيجة، ثم التحقق من `imageReferenceSchemaVersion: 2`.
4. تشغيل Dry-run لـ`siteAsset`.
5. إذا كان `invalidExisting == 0`، تطبيق backfill مرة واحدة ثم إعادة Dry-run والتأكد من `planned == 0`.
6. نشر Firestore Rules:

```powershell
firebase deploy --only firestore:rules --project mitchabrim-jce2026
```

7. نشر Hosting:

```powershell
firebase deploy --only hosting --project mitchabrim-jce2026
```

8. إذا لم تكن Storage Rules الخاصة بالمرحلة الثانية منشورة ضمن إصدار سابق، تنشر بصورة منفصلة بعد التحقق:

```powershell
firebase deploy --only storage --project mitchabrim-jce2026
```

لا يلزم نشر Firestore Indexes لهذا الإصلاح.

يفضل منع عمليات إدارة الصور ومحتوى الموقع أثناء نافذة الترحيل القصيرة، وتنفيذ الترتيب التالي: Functions، ترحيل المراجع، backfill `siteAsset`، Rules، Hosting، ثم التحقق اليدوي.

## 15. التحقق اليدوي المقترح بعد النشر

بحساب Admin فعّال:

1. فتح كل تبويب والتأكد أن pagination لا يعرض عنصرًا خارج شرطه.
2. إضافة صورة خاصة إلى صور الموقع:
   - تصبح عامة.
   - تظهر في تبويب صور الموقع.
   - لا تظهر في الجاليريا.
3. محاولة جعلها خاصة أو حذفها:
   - ترفض برسالة تصنيف صورة الموقع.
4. إزالة صورة موقع غير مستخدمة:
   - تختفي من التبويب.
   - تبقى في المخزن.
   - تبقى عامة.
5. ربط صورة بقسم عام:
   - تصبح `siteAsset`.
   - يظهر مكان الاستخدام.
6. محاولة إزالة تصنيفها أو حذفها:
   - ترفض وتعرض مواقع الاستخدام.
7. اختبار العامة/الخاصة لصورة ليست في الجاليريا وليست صورة موقع وغير مستخدمة.
8. اختبار مستخدم غير مخول والتأكد من الرفض دون تغيير جزئي.
9. اختبار فشل App Check أو الشبكة والتأكد من الرسالة المفهومة وعدم تغير Firestore أو Storage.

## 16. الحكم النهائي

الإصلاح البرمجي مكتمل محليًا، والاختبارات وProduction build ناجحة.

النسخة المنشورة لن تستفيد من الإصلاح قبل نشر Functions وRules وHosting وتنفيذ الترحيلين بالترتيب الآمن. لا يوجد دليل على مشكلة CORS أو IAM أو Storage Rules في التدفق الحالي؛ السبب المؤكد لتعطل زر العامة/الخاصة في Production هو غياب `mutateImage` المنشورة، مع وجود حواجز ترحيل صحيحة لعمليات التحويل إلى خاصة والحذف.

لم يتم تعديل Production، ولم ينفذ Deploy، ولم ينفذ أي migration على Production.
