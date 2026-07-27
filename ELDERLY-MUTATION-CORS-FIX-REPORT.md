# تقرير إصلاح عمليات المواطنين المسنين (`mutateElderly`)

## الحكم النهائي

**تحتاج صلاحية Owner فقط.** الكود المحلي صالح ومختبر، وأُنشئت Cloud Function
`mutateElderly` بنجاح وأصبحت `ACTIVE`، لكن الحساب الوحيد المسجل محليًا
`gonatsu123@gmail.com` يملك `roles/editor` ولا يملك
`run.services.setIamPolicy`. مالك المشروع الظاهر في IAM هو
`ahmadbk179@gmail.com`. بقيت سياسة IAM للخدمة فارغة وطلبات preflight ترجع
`403`.

## السبب الجذري الحقيقي

المشروع المحدد في `frontend/.firebaserc` وإعدادات Vite هو
`mitchabrim-jce2026`. أظهر الأمر:

```text
firebase functions:list --project mitchabrim-jce2026
```

أن الدوال المنشورة الوحيدة كانت `inviteUser` و`submitJoinRequest`. الدالة
`mutateElderly` لم تكن منشورة، رغم أنها موجودة في الكود المحلي ومصدّرة من
`frontend/functions/index.js`. تمت محاولة النشر المحدود لاحقًا؛ نجح إنشاء الدالة
وتشغيل revision، وفشل فقط ضبط IAM invoker.

لهذا تفشل الإضافة والتعديل والحذف معًا: العمليات الثلاث تمر عبر نفس الدالة
`mutateElderly`.

## لماذا ظهرت رسالة CORS و`FirebaseError: internal`

في البداية كانت الواجهة ترسل الطلب إلى عنوان دالة غير منشورة. بعد إنشاء الدالة
بقي Cloud Run invoker غير مضبوط، ولذلك يرجع Google Frontend حاليًا
`HTTP 403 Forbidden` لطلب OPTIONS قبل وصوله إلى كود Callable. رد البنية التحتية
هذا لا يحتوي ترويسات CORS، فيحجبه المتصفح ويعرض CORS/preflight failure. بعد ذلك
لا يستطيع Firebase SDK فك رد Callable قياسي، فيظهر الخطأ العام
`FirebaseError: internal`.

إذًا CORS عرض ثانوي لمورد مفقود، وليس نقصًا في ترويسة يجب إضافتها يدويًا.

## فحص التدفق والأمان

- الواجهة تستدعي `httpsCallable(functions, "mutateElderly")`، وليس `fetch`.
- `getFunctions(app, "us-central1")` يطابق منطقة الدالة المحلية.
- `getSecureFunctions()` ينتظر الحصول على App Check token قبل إنشاء الاستدعاء.
- الدالة معرفة بـ`onCall` في الجيل الثاني، في `us-central1`، ومع
  `enforceAppCheck: true`.
- Authentication يصل عبر `request.auth.uid`.
- الخادم يتحقق أيضًا من أن وثيقة المستخدم موجودة، ودورها `admin`، وحالتها
  `active`.
- لا حاجة إلى CORS يدوي، ولا إلى تعطيل App Check أو Authentication، ولا إلى
  تغيير Firestore Rules.
- المعاملة الواحدة تشمل سجل المواطن وتحديث حالة المتطوع المرتبط، لذلك لا توجد
  كتابة جزئية عند فشل التحقق أو العلاقة.

## الفرق بين المحلي والمنشور

الكود المحلي يصدّر `mutateElderly` ويحتوي منطق create/update/delete. كانت حالة
Firebase المنشورة لا تحتوي المورد، ثم أُنشئ المورد في 2026-07-28 وأصبح
`ACTIVE`. الفرق المتبقي هو IAM: سياسة `inviteUser` العاملة تحتوي
`allUsers -> roles/run.invoker`، بينما سياسة `mutateElderly` فارغة.

## الملفات المعدلة

- `frontend/scripts/run-db-01-tests.mjs`
  - جعل اكتشاف JDK صالحًا لأي JDK مثبت ومدعوم (21+) بدل مسار ثابت لـJDK 25.
- `frontend/tests/db-01.unit.test.mjs`
  - إضافة اختبارات انحدار لاتساق Callable والمنطقة وApp Check ومسار
    `getSecureFunctions`.
- `frontend/tests/db-01.firebase.test.mjs`
  - تحديث بيانات اختبار العمليات الثلاث لتطابق تحقق رقم الهاتف الحالي.
- `ELDERLY-MUTATION-CORS-FIX-REPORT.md`
  - هذا التقرير.

لم يُعدّل منطق البيانات أو Firestore Rules أو إعدادات App Check/Auth، ولم تُضف
ترويسات CORS.

يوجد تعديل سابق وغير متعلق بالمهمة في
`frontend/src/admin/SiteContent.jsx`، ولم يتم لمسه.

## ما الذي يحتاج إلى إكمال

المورد المطلوب تحديدًا:

```text
Cloud Functions (2nd gen): mutateElderly
Project: mitchabrim-jce2026
Region: us-central1
```

نُفذ أمر النشر المحدود:

```powershell
firebase deploy --only functions:mutateElderly --project mitchabrim-jce2026
```

نجح إنشاء الدالة، لكن Firebase CLI فشل في ضبط invoker. يجب أن ينفذ حساب يملك
`run.services.setIamPolicy` (مثل Project Owner أو Cloud Run Admin) الأمر:

```powershell
gcloud run services add-iam-policy-binding mutateelderly `
  --region us-central1 `
  --project mitchabrim-jce2026 `
  --member=allUsers `
  --role=roles/run.invoker
```

هذا لا يعطل App Check أو Firebase Authentication؛ إنه يسمح فقط بوصول HTTP إلى
غلاف Callable، بينما تبقى `enforceAppCheck: true` وفحوص المستخدم والمدير داخل
الدالة. لا يلزم نشر Hosting أو Firestore Rules.

يمكن للـOwner بدل تنفيذ أمر الخدمة أن يمنح الحساب الحالي `roles/run.admin`
مؤقتًا أو دائمًا، ثم يعيد الحساب الحالي أمر `add-iam-policy-binding`. الصلاحية
الناقصة تحديدًا هي `run.services.setIamPolicy`، و`roles/editor` لا يحتويها.

## تدقيق IAM التنفيذي بتاريخ 2026-07-28

### الحالة قبل محاولة التعديل

- `gcloud` يعمل: Google Cloud SDK `577.0.0`.
- الحساب النشط والوحيد المسجل: `gonatsu123@gmail.com`.
- المشروع النشط: `mitchabrim-jce2026`.
- الخدمة: `mutateelderly` في `us-central1`.
- revision الجاهز: `mutateelderly-00001-qeg`.
- حالة الخدمة: `Ready=True`.
- IAM للخدمة:

```json
{
  "etag": "ACAB"
}
```

أي لا يوجد binding لـ`allUsers/roles.run.invoker`.

### الأمر المنفذ

```powershell
gcloud run services add-iam-policy-binding mutateelderly `
  --region us-central1 `
  --project mitchabrim-jce2026 `
  --member=allUsers `
  --role=roles/run.invoker
```

### نتيجة الأمر وحالة IAM بعده

فشل الأمر دون تغيير السياسة:

```text
PERMISSION_DENIED: Permission 'run.services.setIamPolicy' denied
Authenticated as: gonatsu123@gmail.com
```

إعادة قراءة IAM بعد المحاولة أعادت السياسة الفارغة نفسها. فحص IAM للمشروع
أثبت:

```text
roles/editor  user:gonatsu123@gmail.com
roles/owner   user:ahmadbk179@gmail.com
```

الدور الجاهز المناسب هو `roles/run.admin` لأنه يحتوي
`run.services.getIamPolicy` و`run.services.setIamPolicy`، أو يمكن للـOwner تنفيذ
أمر binding مباشرة.

### نتيجة preflight وCallable

- `OPTIONS` من `Origin: http://localhost:8080`: `HTTP 403 Forbidden`.
- `POST` إلى Callable: `HTTP 403 Forbidden`.
- الرد صادر من `Google Frontend` بلا `Access-Control-Allow-Origin`.
- Logs تسجل أن الطلب غير مخوّل على مستوى Cloud Run؛ لا يصل التنفيذ إلى فحص
  App Check أو Firebase Auth أو validation داخل `mutateElderly`.
- لذلك CORS و`FirebaseError: internal` سيستمران حتى يضيف Owner الـbinding.

### نتائج العمليات الإنتاجية

| الاختبار | النتيجة الحالية |
|---|---|
| إضافة مواطن مسن | محجوبة قبل الدالة بواسطة Cloud Run IAM؛ لا كتابة |
| تعديل مواطن مسن | محجوبة قبل الدالة بواسطة Cloud Run IAM؛ لا كتابة |
| حذف مواطن مسن | محجوبة قبل الدالة بواسطة Cloud Run IAM؛ لا كتابة |
| مدخل غير صالح | لا يصل إلى validation بسبب IAM |
| مستخدم غير مخوّل | لا يصل إلى App Check/Auth بسبب IAM |

اختبارات Emulator المحلية للإضافة والتعديل والحذف والرفض والـrollback نجحت.
لا يمكن الادعاء بنجاح الاختبارات الإنتاجية قبل تعديل IAM؛ كما لم تُستخدم أي
طريقة لتجاوز App Check أو Authentication.

### الإجراء الوحيد المتبقي للـOwner

على `ahmadbk179@gmail.com` تنفيذ أمر `add-iam-policy-binding` أعلاه، أو منحه
للحساب الحالي صلاحية Cloud Run Admin بهذا الأمر:

```powershell
gcloud projects add-iam-policy-binding mitchabrim-jce2026 `
  --member=user:gonatsu123@gmail.com `
  --role=roles/run.admin
```

بعدها يجب إعادة فحص IAM وOPTIONS ثم تنفيذ الاختبارات الإنتاجية الخمسة ومراجعة
Logs. لا يلزم Deploy جديد؛ النسخة المنشورة هي النسخة التي أُنشئت من الكود
الحالي، والمشكلة المثبتة المتبقية IAM فقط.

## الاختبارات والنتائج

- `npm run test:db01`: **نجح**
  - 6/6 اختبارات وحدة.
  - نجح Firestore/Auth Emulator.
  - غطى رفض غير المدير، rollback عند فقد المتطوع، الإضافة، إعادة محاولة الإضافة
    دون تكرار، تعديل سجل قديم مع حفظ الحقول، حذف سجلين متزامنين، وتحديث حالة
    المتطوع ذريًا.
- `npm run test:elderly-settings`: **نجح، 8/8**.
- `npm run build`: **نجح**.
- استيراد `functions/index.js` مع تبعيات الإنتاج: **نجح**.
- `firebase functions:list --project mitchabrim-jce2026`: **أكد غياب
  `mutateElderly` قبل النشر، ثم أكد ظهورها كـv2 callable و`ACTIVE` بعد محاولة
  النشر**.
- فحص IAM: `inviteUser` تحتوي `allUsers/roles.run.invoker`، و`mutateElderly`
  بلا bindings.
- طلب OPTIONS بعد إنشاء الدالة: **`HTTP 403 Forbidden` من Google Frontend**،
  ما يثبت أن الطلب لا يصل إلى كود Callable بسبب IAM.

## خطوات التحقق اليدوي بعد النشر

1. شغّل `functions:list` وتأكد أن `mutateElderly` ظاهرة كـcallable v2 في
   `us-central1`.
2. في localhost استخدم App Check debug token مسجلًا للمشروع، وسجّل الدخول
   بحساب وثيقته `role=admin` و`status=active`.
3. أضف مواطنًا جديدًا برقم هاتف صالح، وتأكد من ظهور سجل واحد فقط وحقول البحث
   والتوقيت.
4. عدّل سجلًا موجودًا، وتأكد من حفظ الحقول المعدلة وبقاء الحقول غير المعدلة.
5. احذف السجل، وتأكد من اختفائه وتحديث حالة المتطوع المرتبط بصورة صحيحة.
6. اختبر متطوعًا غير موجود ومدخلات غير صالحة؛ يجب ظهور خطأ Callable واضح بلا
   كتابة جزئية.
7. راقب Network: يجب أن ينجح preflight وألا يظهر CORS أو
   `FirebaseError: internal`.
8. راقب Logs وتأكد من عدم وجود App Check rejection؛ إن حدث، سجّل debug token
   الصحيح بدل تعطيل enforcement.
