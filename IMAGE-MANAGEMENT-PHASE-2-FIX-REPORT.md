# تقرير إصلاح المرحلة الثانية لنظام إدارة الصور

## 1. النتيجة التنفيذية

تم تنفيذ المرحلة الثانية محليًا وتحويل `מאגר תמונות` إلى مصدر مركزي قابل
للتتبع لصور الجاليريا وصور أقسام الموقع العام.

الحل المختار يجمع بين:

- مرجع صريح داخل محتوى الموقع:

  ```js
  {
    imageId: "...",
    imageUrl: "..."
  }
  ```

- مراجع عكسية داخل وثيقة الصورة نفسها:

  ```js
  usageRefs: [
    {
      key,
      section,
      documentId,
      field,
      label
    }
  ],
  usageCount: 1
  ```

`imageId` هو المرجع الموثوق للحماية، بينما يبقى `imageUrl` محفوظًا لعرض سريع
ولتوافق الموقع العام مع البيانات القديمة. لا تعتمد الحماية على اسم الصورة أو
الفئة أو URL يرسله العميل.

أضيفت Cloud Functions محمية بـApp Check وتتحقق من Admin فعّال:

- `saveSiteContentSection`
- `mutateImage`

الحذف، التحويل إلى خاص، ونقل الملف بين public/private أصبحت عمليات خادمية.
تعديل بيانات القسم يعيد بناء المراجع العكسية في transaction واحدة. لا يمكن
حذف صورة مستخدمة أو جعلها خاصة، ولا يمكن حذف صورة من الجاليريا قبل إزالتها
منها.

لم يتم Deploy، ولم تُكتب أي بيانات مرحلة ثانية على Production، ولم يُشغّل
migration المرحلة الثانية على Production.

## 2. التحقق من المرحلة الأولى

تمت قراءة:

- `IMAGE-MANAGEMENT-SAFETY-AUDIT.md`
- `IMAGE-MANAGEMENT-PHASE-1-FIX-REPORT.md`

ثم تمت مقارنة النتائج بالمصدر الحالي. ثبت وجود المرحلة الأولى فعليًا:

- `isPublic` منفصل عن `showInGallery`.
- الفئة لا تغيّر الخصوصية أو الجاليريا تلقائيًا.
- الصورة الخاصة لا يمكن أن تحمل `showInGallery: true`.
- صفحة الإدارة تستخدم صفحات من 24 وثيقة وcursor.
- أداة `image-gallery-visibility-backfill.mjs` موجودة.
- Firestore Rules تستثني `images` من fallback العام.
- backfill الخاص بـ`showInGallery` سبق تشغيله، لكن المرحلة الثانية لا تفترض
  ذلك لإخفاء البيانات القديمة؛ normalizer ما زال متوافقًا.

لم يُعاد تنفيذ المرحلة الأولى ولم تُحذف مسارات التوافق الخاصة بها.

## 3. تدقيق جميع استخدامات الصور الحالية

### 3.1 الصور الديناميكية داخل `siteContent/home`

| القسم | الحقل | مكان العرض |
|---|---|---|
| Hero | `hero.imageMain` | الصورة الدائرية الرئيسية |
| Hero | `hero.imageTopLeft` | الصورة الدائرية العلوية |
| Hero | `hero.imageBottom` | الصورة الدائرية السفلية |
| About | `about.image` | قسم من نحن |
| Quote | `quote.image` | صورة صاحبة الاقتباس |
| Activities | `activities.details.{slug}.image` | صفحات تفاصيل الأنشطة |
| Partners | `partners.items[i].logo` أو `imageUrl` | شعارات الشركاء الديناميكية |
| Team | `team.members[i].img` | صور أعضاء الفريق |
| Press | `press.facebook.image` | صورة بطاقة Facebook |
| Press | `press.ynet.image` | صورة بطاقة Ynet |

كل هذه الحقول كانت سابقًا string URL فقط.

### 3.2 صور الجاليريا

الجاليريا لا تعتمد على `siteContent.gallery.slides`. مصدرها الفعلي هو مجموعة:

```text
images
```

ومعيار العرض:

```text
isPublic == true && showInGallery == true
```

`siteContent.gallery` يحتوي نصوص عنوان القسم ووصفه فقط في التدفق الفعلي.
الحقل الافتراضي `gallery.slides` بقي للتوافق لكنه ليس مصدر صور الجاليريا
الحالية ولم يُرحّل عشوائيًا.

### 3.3 الصور المحلية أو الثابتة

هذه الصور لا تأتي من `images` ولا يجب إنشاء مراجع Firestore وهمية لها:

- `/logo.webp` في Hero وصفحات الدخول.
- صور fallback للأنشطة في `src/data/activities.js`.
- شعارات الشركاء الافتراضية المستوردة من assets.
- صور Hero الخاصة بصفحات Admin داخل `public/admin-heroes`.
- الأصول التصميمية الثابتة داخل `src/assets`.

### 3.4 حقول URL ليست صورًا

حقول مثل:

- `press.facebook.url`
- `press.ynet.url`
- روابط الشبكات الاجتماعية

هي روابط صفحات وليست صورًا. لم تُفحص بالمطابقة العامة حسب اسم `url`، بل تم
استخدام قائمة حقول صور صريحة لتفادي ربط خاطئ.

## 4. خريطة البيانات قبل التعديل

### وثيقة الصورة

```js
{
  title,
  category,
  notes,
  url,
  storagePath,
  uploadedAt,
  displayDate,
  isPublic,
  showInGallery
}
```

### حقل صورة في محتوى الموقع

```js
hero.imageMain = "https://..."
```

لم يوجد ارتباط عكسي، ولذلك لم يكن حذف الصورة أو تغيير خصوصيتها قادرًا على
معرفة أثر العملية في الموقع العام.

## 5. التصميم النهائي للمراجع ولماذا اختير

### التصميم المختار

يُخزن المرجع في موضع الاستخدام:

```js
hero.imageMain = {
  imageId: "managed-image-id",
  imageUrl: "https://..."
}
```

وتُخزن قائمة الاستخدامات في وثيقة الصورة:

```js
{
  usageRefs: [
    {
      key: "home:hero:imageMain",
      section: "hero",
      documentId: "home",
      field: "imageMain",
      label: "דף הבית — Hero — תמונה ראשית"
    }
  ],
  usageCount: 1,
  status: "active"
}
```

### لماذا لم تُنشأ مجموعة `imageUsages`

حجم المشروع الحالي وعدد حقول الصور محدودان. تخزين المراجع العكسية في وثيقة
الصورة يحقق:

- قراءة usage مع الصورة نفسها.
- عدم وجود N+1 في صفحة الإدارة.
- منع الحذف/الخصوصية بقراءة وثيقة الصورة فقط.
- عدم الحاجة إلى query أو index جديد لكل بطاقة.
- تحديث ذري مع `siteContent/home`.

مجموعة مستقلة كانت ستحتاج مزامنة count أو query لكل صورة، أو استعلامًا إضافيًا
لكل صفحة. يمكن إعادة تقييمها فقط إذا تجاوزت قائمة الاستخدامات حد وثيقة
Firestore مستقبلًا، وهو غير متوقع في البنية الحالية.

### الحقول الإضافية

- `usageRefs`: المراجع العكسية الموثوقة.
- `usageCount`: عدد الاستخدامات لتصفية وعرض سريع دون قراءة إضافية.
- `status`: حاليًا `active` أو حالة انتقالية `deleting`.
- `mutationLock`: حقل خادمي مؤقت لمنع سباق بين حفظ محتوى الموقع ونقل/حذف
  الصورة.
- `cleanupSourcePath`: يُكتب فقط إذا اكتمل النقل وفشل حذف النسخة القديمة،
  فيحفظ دليل cleanup بدل إخفاء الفشل.
- `imageReferenceSchemaVersion: 2` داخل `siteContent/home`: علامة أن migration
  اكتمل وأن العمليات المدمرة أصبحت آمنة.

## 6. الحفاظ على `imageUrl` والتوافق

أضيف `resolveSiteImageUrl()`، ويقبل:

- string URL قديم.
- `{ imageId, imageUrl }` جديد.

تم تحديث المستهلكين:

- Hero.
- About.
- Quote.
- Team.
- Partners.
- Press.
- Activity Detail.

لذلك يعمل الموقع أثناء فترة الانتقال قبل migration وبعده. لا يُحذف URL القديم
مباشرة، ولا يُطلب تحميل وثيقة الصورة لكل عرض عام.

عند حفظ قسم عبر Function:

- مرجع `imageId` صحيح يُتحقق منه ويُحفظ.
- URL يطابق صورة عامة واحدة يُحوّل إلى reference.
- URL خارجي أو غير مطابق يبقى string ولا يُخمن.
- صورة خاصة أو غير نشطة تُرفض ولا تُربط بقسم عام.

أداة migration لا تغير مرجعًا صحيحًا موجودًا، ولا تستبدل `imageUrl` داخله.

## 7. حفظ محتوى الموقع بصورة محمية

`saveSection()` لم يعد يكتب مباشرة إلى Firestore، بل يستدعي:

```text
saveSiteContentSection
```

الـFunction:

1. تتحقق من Authentication.
2. تتحقق من وثيقة المستخدم: `role == admin` و`status == active`.
3. تحدد حقول الصور من خريطة صريحة حسب القسم.
4. تقرأ مجموعة الصور مرة واحدة داخل transaction؛ لا تنفذ query لكل حقل.
5. تطابق URL مع صورة واحدة فقط أو تتحقق من `imageId`.
6. تمنع ربط صورة خاصة/غير نشطة/قيد mutation.
7. تبني `usageRefs` الجديدة وتزيل مراجع القسم القديمة.
8. تحدث وثائق الصور المتأثرة و`siteContent/home` ذريًا.
9. ترفض القسم الأكبر من 200KB.
10. ترفض العملية إن احتاجت أكثر من 450 كتابة مرجع ضمن transaction واحدة.

الروابط الخارجية تبقى قابلة للعرض، لكنها تُعرض في Admin كروابط خارجية/قديمة
غير محمية حتى تُستبدل بصورة من المخزن.

## 8. العمليات الحساسة

### `mutateImage`

تدعم:

- `make-public`
- `make-private`
- `publish-and-add-gallery`
- `delete`

وهي:

- في `us-central1`.
- `enforceAppCheck: true`.
- تتحقق خادميًا من Admin فعّال.
- لا تثق بـ`usageCount` أو usages من العميل؛ تقرأ وثيقة الصورة.
- تستخدم `mutationLock` لمنع إضافة مرجع جديد أثناء نقل/حذف الصورة.
- تنقل الملف بواسطة Admin Storage بين public/private.
- تستخدم مسار الصورة الموثق في Firestore، لا مسارًا يرسله العميل.

### منع الحذف

الحذف يرفض عندما:

- `usageRefs` غير فارغة.
- `showInGallery == true`.
- migration المراجع لم يكتمل.

قبل حذف الملف، تتحول الوثيقة إلى `status: deleting` و`isPublic: false` ضمن
transaction. إذا فشل جزء خارجي يمكن إعادة العملية؛ حالة `deleting` قابلة
للاستئناف ولا تظهر في الاستعلام العام. حذف Storage يستخدم `ignoreNotFound`
ليكون idempotent.

### منع التحويل إلى خاص

التحويل إلى خاص يرفض عندما:

- الصورة مستخدمة في أي قسم عام.
- الصورة ما زالت في الجاليريا.
- migration لم يثبت اكتماله.

لا يحدث أي تغيير جزئي قبل اجتياز هذه الفحوص. أثناء النقل يمنع lock حفظ مرجع
جديد للصورة. إذا فشل النسخ تُحذف النسخة الجديدة ويُرفع lock. إذا نجح تحديث
Firestore وفشل حذف المصدر القديم، تبقى النسخة الجديدة العاملة وتُسجل
`cleanupSourcePath` بدل ترك مرجع مكسور.

### الإضافة الآمنة من الخاص إلى الجاليريا

الواجهة تعرض تأكيدًا صريحًا:

```text
פרסום והוספה לגלריה
```

وتنفذ `publish-and-add-gallery` كعملية خادمية واحدة بدل نداءين منفصلين قد
يتركان حالة نصف مكتملة.

### soft-delete

لم يُعتمد soft-delete دائم في هذه المرحلة، لأن:

- الحذف لا يُسمح به إلا لصورة غير مستخدمة وغير موجودة في الجاليريا.
- إبقاء كل ملف محذوف يزيد Storage دون سياسة احتفاظ مطلوبة.
- حالة `deleting` القابلة للاستئناف توفر حماية فشل العملية دون تحويل النظام
  إلى أرشيف دائم غير مطلوب.

يمكن إضافة Trash بسياسة احتفاظ لاحقة إذا أصبحت استعادة الصور المحذوفة مطلبًا.

## 9. واجهة `מאגר תמונות`

أضيفت ثلاثة تبويبات واضحة:

1. `כל התמונות`
2. `תמונות הגלריה`
3. `תמונות האתר`

### كل الصور

يعرض:

- عامة/خاصة.
- في الجاليريا أو لا.
- مستخدمة في الموقع أو غير مستخدمة.
- عدد أماكن الاستخدام.
- أول أماكن الاستخدام وأسماء الأقسام.
- البحث، التصنيف، الحالة، والترتيب.
- تحميلًا تدريجيًا من 24 صورة.

### صور الجاليريا

يعرض `showInGallery == true` ضمن الصفحات المحملة. يمكن:

- إزالة الصورة من الجاليريا دون حذفها.
- إضافة صورة عامة.
- نشر صورة خاصة وإضافتها عبر تأكيد وFunction واحدة.

إزالة الصورة من الجاليريا لا تغير `isPublic`.

لم يُضف ترتيب يدوي للجاليريا في هذه المرحلة؛ التدفق الحالي يرتب الصور بحسب
تاريخ الرفع. إضافة حقل ترتيب وواجهة drag-and-drop لم تكن ضرورية لتحقيق أمان
المراجع وكانت ستضيف writes وتزامنًا غير مبرر.

### صور الموقع

يعرض الصور التي `usageCount > 0` فقط، مع أسماء أماكن الاستخدام. لا يستخدم
الفئة أو اسم الصورة أو URL وحده لتحديد التبويب.

### حماية الخطأ البشري

- أزرار نصية بدل أيقونات مبهمة.
- تأكيد قبل النشر/الخصوصية/الجاليريا/الحذف.
- loading و`pendingImageIds` يمنعان الضغط المكرر والتعارض.
- محاولة حذف/إخفاء صورة مستخدمة تفتح التفاصيل وتعرض العدد.
- رسائل واضحة لأسباب:
  - الصورة مستخدمة.
  - ما زالت في الجاليريا.
  - رابط خارجي.
  - migration غير مكتمل.
- نافذة التفاصيل تعرض جميع usage labels.
- RTL وأزرار لمس بارتفاع 44px على الهاتف.

## 10. أداة audit وmigration

أضيف:

```text
frontend/scripts/site-image-reference-migration.mjs
```

### الوضع الافتراضي

```powershell
npm.cmd run migrate:site-image-references:dry-run
```

هو dry-run فقط.

### التصنيف

الأداة تخرج:

- `matched`
- `alreadyReferenced`
- `unmatched`
- `ambiguous`
- `external`
- `invalid`
- `siteSectionsPlanned`
- `imagesPlanned`
- `schemaVersionPlanned`
- قائمة issues محدودة إلى 100 حالة

### المطابقة

المطابقة تستخدم:

- `imageId` الموجود.
- URL موحد.
- Firebase download URL بعد إزالة query/token من مفتاح المقارنة فقط.
- URL وثيقة الصورة في `images`.

لا تخمن عند:

- أكثر من صورة للـURL نفسه.
- `imageId` غير موجود.
- صورة خاصة/غير نشطة.
- قيمة غير صالحة.

الروابط الخارجية لا تُعدل تلقائيًا.

### شروط الأمان

- default dry-run.
- Production apply يتطلب:
  - `--apply`
  - `--production`
  - `--confirm-project=<project-id>`
  - `GCLOUD_PROJECT`
  - access token قصير العمر داخل environment.
- لا يطبع token.
- يرفض apply إن وجد `unmatched` أو `ambiguous` أو `invalid`.
- يستخدم `updateTime` preconditions.
- يرفض أكثر من 50,000 صورة.
- يرفض أكثر من 450 write.
- كل writes ضمن commit ذري واحد.
- idempotent؛ إعادة dry-run بعد apply تنتج صفر تغييرات مخططة.
- لا يغير مراجع `imageId` الصحيحة.
- علامة schema version لا تُكتب إلا ضمن apply ناجح.

### نتائج Emulator

تم تشغيل:

- dry-run: لم يكتب.
- apply-emulator: نجح.
- verify dry-run: `siteSectionsPlanned = 0` و`imagesPlanned = 0`.

حالة الاختبار تضمنت:

- URL مطابقًا تم تحويله.
- URL خارجيًا بقي دون تعديل.
- usage عكسيًا تم إنشاؤه.
- مرجعًا غامضًا في unit test لم يتم تخمينه.

لم تُشغل الأداة ضد Production، تطبيقًا لشرط أن يكون الاختبار على Emulator فقط.
لذلك أعداد Production الفعلية لـunmatched/ambiguous/external غير معروفة حتى
تشغيل dry-run لاحقًا.

## 11. قفل الأمان قبل migration

هناك نافذة نشر محتملة: Functions/Hosting الجديدة قد تصل قبل اكتمال المراجع.
لمنع حذف صورة مستخدمة خلال هذه الفترة، `mutateImage` ترفض:

- delete.
- make-private.

ما لم يكن:

```text
siteContent/home.imageReferenceSchemaVersion == 2
```

هذه العلامة لا يكتبها Hosting ولا Function حفظ قسم واحد، بل migration المكتمل
فقط. لذلك عدم اكتمال migration لا يكسر الموقع، لكنه يبقي العمليات المدمرة
مقفلة برسالة واضحة.

## 12. Firestore Rules

### الصور

- القراءة العامة: `isPublic == true` والصورة active أو legacy بلا status.
- الإنشاء: Admin فعّال فقط، مع:
  - invariant الجاليريا.
  - usage فارغ.
  - status active.
  - عدم حقن mutation lock.
- تحديث العميل: Admin فقط، ومحصور في:
  - title.
  - category.
  - notes.
  - displayDate.
  - showInGallery.
  - updatedAt.
- العميل لا يستطيع:
  - تغيير `isPublic`.
  - تغيير `storagePath` أو `url`.
  - تزوير `usageRefs` أو `usageCount`.
  - حذف الوثيقة.
- fallback لا يستطيع تجاوز قواعد `images`.

### محتوى الموقع

- القراءة عامة كما كانت.
- إنشاء وثيقة seed الأولى Admin فقط للتوافق.
- update/delete من العميل ممنوعان.
- التحديث يتم عبر Function.
- `siteContent` مستثناة من fallback الإداري.

لم تتوسع صلاحيات المتطوع أو المستخدم العام.

## 13. Storage Rules

المسارات المدارة:

```text
images/public/{imageId}/{fileName}
images/private/{imageId}/{fileName}
```

- الملفات العامة قابلة للقراءة العامة.
- الملفات الخاصة Admin فقط.
- Admin يستطيع إنشاء upload صالح حتى 5MB.
- العميل لا يستطيع overwrite ملف مُدار.
- العميل لا يستطيع حذف ملف له وثيقة `images/{imageId}`.
- يسمح بتنظيف upload يتيم فقط إذا فشل إنشاء وثيقة الصورة.
- نقل وحذف الصور المدارة يتمان عبر Admin SDK داخل Function.
- مسار legacy المسطح بقي مؤقتًا لـSEC-03 migration والتوافق، ولا تستخدمه
  الرفعات الجديدة.

## 14. Indexes

لم يُعدل `firestore.indexes.json`.

الأسباب:

- usages موجودة في وثيقة الصورة، فلا يوجد query إلى `imageUsages`.
- تبويب الموقع يقرأ `usageCount` ضمن الصفحة المحملة.
- pagination تستخدم document ID.
- الجاليريا تستخدم التدفق الحالي.
- لا يوجد استعلام مركب جديد يحتاج index.

## 15. أثر الأداء والقراءات

### فتح `מאגר תמונות`

- 24 قراءة للصورة في الصفحة الأولى بدل المجموعة كاملة.
- صفر queries إضافية للـusage.
- تبديل التبويب والفلاتر على الصور المحملة لا يضيف reads.
- كل صفحة إضافية تقرأ 24 وثيقة تقريبًا.

### تبويب صور الموقع

لا يوجد N+1؛ `usageRefs` و`usageCount` ضمن وثيقة الصورة.

### حفظ قسم

- قراءة وثيقة المستخدم.
- قراءة `siteContent/home`.
- قراءة مجموعة الصور مرة واحدة داخل transaction.
- كتابة القسم والصور التي تغيرت usages لها فقط.

هذا scan إداري عند الحفظ، وليس عند فتح الموقع أو لوحة الصور. حجم المشروع
الحالي صغير، ويمنع التصميم استعلامًا لكل حقل. إذا أصبحت مجموعة الصور كبيرة
جدًا، يمكن لاحقًا الانتقال إلى lookup مفهرس لمعرفات/URLs المعنية.

### الموقع العام

لا توجد قراءة إضافية للصورة من أجل `imageId`. العرض يستخدم `imageUrl` المرافق.
الجاليريا تحتفظ بعدد queries السابق.

### حجم البناء

حجم `Media` الناتج يقارب 37KB قبل gzip، و`siteImageReferences` chunk صغير.
بقي تحذير Vite العام عن chunk الرئيسي الأكبر من 500KB؛ ليس سببه نظام المراجع
ولا يمنع البناء، لكنه بند code-splitting عام.

## 16. الملفات المعدلة ودور كل ملف

### Functions

- `frontend/functions/index.js`
  - تصدير `mutateImage` و`saveSiteContentSection`.
- `frontend/functions/src/imageReferencePolicy.js`
  - خريطة حقول الصور، المطابقة، التصنيف، والـcanonical references.
- `frontend/functions/src/siteContentImageCore.js`
  - حفظ القسم والمراجع العكسية ذريًا.
- `frontend/functions/src/imageMutationCore.js`
  - الحذف، الخصوصية، نقل Storage، locks، والحمايات.

### Frontend

- `frontend/src/utils/siteImageReferences.js`
  - قراءة string legacy أو reference جديد.
- `frontend/src/services/siteContentService.js`
  - نقل حفظ الأقسام إلى callable.
- `frontend/src/services/imagesService.js`
  - نقل العمليات الحساسة إلى callable، وإضافة status/usage normalization.
- `frontend/src/admin/Media.jsx`
  - التبويبات، usages، التأكيدات، الحمايات ورسائل الخطأ.
- `frontend/src/admin/SiteContent.jsx`
  - استقبال القسم canonical بعد الحفظ.
- `frontend/src/components/admin/site-content/fields.jsx`
  - دعم reference وعرض حالته.
- `frontend/src/styles/site-content-admin.css`
  - حالة المرجع وإظهارها RTL.
- مكونات العرض العام:
  - `HeroSection.jsx`
  - `AboutSection.jsx`
  - `QuoteSection.jsx`
  - `TeamSection.jsx`
  - `PartnersSection.jsx`
  - `PressSection.jsx`
  - `ActivityDetail.jsx`
  - دعم `imageUrl` وreference معًا.

### Rules وScripts

- `frontend/firestore.rules`
  - منع تجاوز المراجع والعمليات الحساسة.
- `frontend/storage.rules`
  - منع العميل من حذف/نقل الملفات المدارة.
- `frontend/scripts/site-image-reference-migration.mjs`
  - dry-run/audit/migration.
- `frontend/scripts/sec-03-migrate-images.mjs`
  - تحديث أداة Emulator القديمة كي تستخدم صلاحية owner عند تحديث الحقول
    التي أصبحت server-only.
- `frontend/package.json`
  - أوامر الاختبار وdry-run.

### Tests

- `frontend/tests/image-management-phase2.test.mjs`
  - مراجع، مطابقة، ambiguity، migration، الحمايات، UI، والحفظ الذري.
- `frontend/tests/image-management-phase1.test.mjs`
  - تحديث توقعات الخصوصية بعد نقلها إلى callable.
- `frontend/tests/sec-03.rules.test.mjs`
  - Firestore/Storage والمراجع والترحيل على Emulator.

كما تم الحفاظ على تغييرات المرحلة الأولى والتغييرات السابقة الموجودة في
worktree وعدم إلغائها.

## 17. الاختبارات ونتائجها

### Node

```text
npm.cmd run test:image-management
5 passed, 0 failed
```

```text
npm.cmd run test:image-management-phase2
9 passed, 0 failed
```

```text
npm.cmd run test:categories
6 passed, 0 failed
```

```text
node --test tests/media-public-copy.test.mjs
           tests/public-gallery-presentation.test.mjs
           tests/partners-wave.test.mjs
6 passed, 0 failed
```

الإجمالي المحدد: **26 ناجحًا، 0 فاشل**.

التغطية تشمل:

- صورة عامة ليست بالضرورة في الجاليريا.
- صورة خاصة لا تدخل الجاليريا بصمت.
- publish-and-add صريح.
- إزالة الجاليريا لا تحذف الصورة.
- منع حذف/إخفاء صورة مستخدمة.
- السماح بحذف غير مستخدمة وفق السياسة.
- عدم التخمين في ambiguity.
- fallback للروابط القديمة.
- عدم وجود N+1 في التبويبات.
- قفل العمليات قبل schema migration.
- transaction حفظ القسم والمراجع.

### Firebase Emulator

```text
npm.cmd run test:sec03
passed
```

شمل:

- anonymous والمتطوع لا يكتبان الصور أو siteContent.
- Admin لا يستطيع تزوير usages.
- Admin لا يستطيع تغيير الخصوصية أو حذف الوثيقة من العميل.
- Storage يمنع حذف ملف مُدار.
- يسمح بتنظيف upload يتيم.
- القراءة العامة/الخاصة.
- invariants الجاليريا.
- pagination والاستعلام العام.
- dry-run/apply/verify لترحيل المراجع.
- SEC-03 storage migration.

رسائل `PERMISSION_DENIED` في المخرجات متوقعة لحالات الرفض. تحذير Java
deprecated صادر من Firebase Storage Rules Emulator ولم يؤثر في النتيجة.

### فحص Functions وScripts

نجحت فحوص `node --check` لـ:

- `functions/index.js`
- `functions/src/imageMutationCore.js`
- `functions/src/siteContentImageCore.js`
- `scripts/site-image-reference-migration.mjs`

## 18. نتيجة Production build

نُفذ:

```text
npm.cmd run build:production
```

النتيجة: **نجح**.

- 2524 module تم تحويلها.
- ظهر chunk مستقل لـ`siteImageReferences`.
- ظهرت النسخ الجديدة من `Media` و`SiteContent` و`imagesService`.
- نجح فحص متغيرات Production دون طباعة قيم.
- نجح Hosting artifact verification.
- التحذير الوحيد هو chunk-size العام.

لم يُنشر `dist`.

## 19. المخاطر المتبقية

1. أعداد Production الفعلية للروابط external/unmatched/ambiguous غير معروفة
   لأن dry-run Production لم يُشغل في هذه المهمة.
2. الروابط الخارجية تبقى قابلة للعرض لكنها غير محمية من دورة حياة المزود
   الخارجي.
3. `cleanupSourcePath` يحتاج مراقبة/أداة cleanup إذا ظهر بعد فشل حذف مصدر نادر.
4. تبويبات Admin تطبق على الصفحات المحملة. البحث الشامل server-side يمكن
   إضافته عند نمو البيانات.
5. scan الصور عند حفظ قسم مناسب للحجم الحالي، لكنه يحتاج إعادة تقييم عند عشرات
   الآلاف من الصور.
6. مسار Storage legacy ما زال موجودًا للتوافق؛ يمكن إغلاقه بعد إثبات أن SEC-03
   migration مكتمل وعدم وجود ملفات مسطحة.
7. لا يوجد Trash دائم؛ الحذف غير قابل للاستعادة بعد اكتماله.
8. التشغيل الفعلي للـFunctions الجديدة وIAM/Cloud Run لا يمكن التحقق منه قبل
   النشر. Firebase callable يجب أن يبقى قابلًا للوصول إلى طبقة App Check/Auth،
   مع التحقق من invoker بعد النشر إذا كانت سياسة المؤسسة تقيده.

لا يوجد blocker برمجي يمنع النشر المرحلي. توجد بوابة تشغيل مقصودة: إن أظهر
dry-run Production أي unmatched/ambiguous/invalid فلن يعمل apply، وستظل عمليات
الحذف والتحويل إلى خاص مقفلة حتى المراجعة.

## 20. ترتيب النشر والترحيل لاحقًا

لم يُنفذ أي أمر أدناه. الترتيب الآمن:

### 1. تحقق ونسخة احتياطية

- تأكيد الحساب والمشروع `mitchabrim-jce2026`.
- export/backup لـFirestore وبيانات الصور الملائمة.
- الاحتفاظ بـProduction build جديد.

### 2. نشر Functions أولًا

```powershell
cd frontend
npx firebase deploy --only functions:mutateImage,functions:saveSiteContentSection --project mitchabrim-jce2026
```

ثم التحقق من:

- Function region: `us-central1`.
- App Check enforcement.
- callable OPTIONS/POST يصلان للخدمة.
- Cloud Run invoker إن كانت سياسة المشروع تتطلبه.

### 3. نشر Hosting

```powershell
npm.cmd run build:production
npx firebase deploy --only hosting --project mitchabrim-jce2026
```

الموقع الجديد يقرأ string وreference، لذلك لا ينكسر قبل migration.

### 4. نشر Firestore وStorage Rules

بعد أن أصبح Hosting يستخدم Functions:

```powershell
npx firebase deploy --only firestore:rules,storage --project mitchabrim-jce2026
```

هذا يمنع العميل من تجاوز الحماية.

### 5. تشغيل dry-run فقط

بعد توفير access token قصير العمر في الجلسة دون طباعته:

```powershell
$env:GCLOUD_PROJECT = "mitchabrim-jce2026"
$env:FIRESTORE_ACCESS_TOKEN = "<SHORT_LIVED_ACCESS_TOKEN>"
npm.cmd run migrate:site-image-references:dry-run
```

مراجعة:

- matched.
- alreadyReferenced.
- unmatched.
- ambiguous.
- external.
- invalid.
- issues.
- عدد writes.

إذا كان `unmatched` أو `ambiguous` أو `invalid` أكبر من صفر: **التوقف وعدم
تشغيل apply**.

الروابط external لا تمنع apply لأنها تبقى دون تعديل، لكن يجب توثيقها واستبدال
المهم منها لاحقًا بصورة مُدارة.

### 6. apply مؤكد مرة واحدة

بعد المراجعة فقط:

```powershell
node scripts/site-image-reference-migration.mjs --apply --production --confirm-project=mitchabrim-jce2026
```

### 7. verify dry-run

إعادة dry-run. المتوقع:

```text
siteSectionsPlanned = 0
imagesPlanned = 0
schemaVersionPlanned = false
```

وبوجود:

```text
imageReferenceSchemaVersion = 2
```

تُفتح تلقائيًا عمليات delete/make-private الآمنة.

### 8. تحقق يدوي

- فحص Hero/About/Activities/Team/Partners/Press.
- فتح تبويبات الصور الثلاثة.
- حذف صورة غير مستخدمة.
- رفض حذف صورة Hero.
- رفض جعل صورة مستخدمة خاصة.
- إزالة صورة من الجاليريا دون حذفها.
- نشر صورة خاصة وإضافتها للجاليريا.
- مستخدم غير مخول.
- فشل App Check.
- Desktop وMobile.
- مراقبة Logs و`cleanupSourcePath`.

## 21. الموارد التي تحتاج نشرًا

- **Hosting:** نعم.
- **Cloud Functions:** نعم:
  - `mutateImage`
  - `saveSiteContentSection`
- **Firestore Rules:** نعم.
- **Storage Rules:** نعم.
- **Firestore Indexes:** لا.
- **Migration:** نعم، dry-run ثم apply بعد مراجعة Production.
- **بيانات Production ضمن هذه المهمة:** لم تُعدل.
- **Deploy ضمن هذه المهمة:** لم يُنفذ.

## 22. الحكم النهائي

المرحلة الثانية **مكتملة محليًا وقابلة للنشر المرحلي**. الاختبارات والبناء
ناجحان، ولا يوجد blocker برمجي. تفعيل الحذف والتحويل إلى خاص في Production
يتطلب اكتمال ترتيب النشر ثم نجاح migration؛ قبل ذلك تبقى العمليات المدمرة
مقفلة عمدًا دون كسر الموقع العام.
