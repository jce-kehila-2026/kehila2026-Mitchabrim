# إصلاح بيانات المشاريع والبرلمانات

## السبب المباشر

تحميل القائمتين يبدأ بقراءة المستندات الرئيسية، ثم ينفذ استعلامات `collectionGroup` لجلب العلاقات دفعة واحدة:

- المشاريع: `elderlyParticipants`.
- البرلمانات: `participants` و`meetings`.
- تفاصيل جلسات البرلمان: `attendance` و`expenses`.

القواعد الحالية كانت تسمح بالقراءة والكتابة عبر المسارات المباشرة، لكنها لم تتضمن قواعد صريحة لاستعلامات Collection Group. لذلك كانت Firebase تعيد:

```text
permission-denied
No matching allow statements
```

وبسبب وجود الاستعلامات داخل `Promise.all`، كان فشل استعلام العلاقات يُسقط تحميل القائمة كلها.

تم التحقق على Firestore Emulator أن:

- إنشاء مستند مشروع وبرلمان وبياناتهما الفرعية ينجح للمسؤول.
- قراءة `projects` و`parliaments` المرتبة حسب `createdAt` تنجح.
- أول استعلام Collection Group يفشل قبل الإصلاح بالرسالة أعلاه.

إذًا الإضافة والتعديل لم يكونا مرفوضين من القواعد؛ المشكلة المباشرة كانت في قراءة العلاقات أثناء تحميل الصفحتين.

## الملفات المعدلة

- `frontend/firestore.rules`
- `frontend/tests/projects-parliaments-data.firebase.test.mjs`

لم تتغير صفحات المشاريع أو البرلمانات ولا خدماتهما، لأن الاستعلامات صحيحة والمشكلة المثبتة كانت في Rules فقط.

## الحل

أضيفت قواعد `read` صريحة لاستعلامات Collection Group التالية:

- `elderlyParticipants`
- `participants`
- `meetings`
- `attendance`
- `expenses`

بقيت الصلاحية محصورة في `isAdmin()` فقط. لم تُمنح أي صلاحية إضافية للمستخدم العام أو المتطوع، ولم تتغير صلاحيات الكتابة.

## Rules أو Indexes

- يلزم نشر Firestore Rules.
- لا يلزم تعديل أو نشر Firestore Indexes؛ الاستعلامات تعتمد على `documentId()` ولا ظهر خطأ فهرس.

## نتيجة الفحص وProduction build

- الاختبار المحصور على Firestore Emulator: ناجح.
- قراءة المشاريع والبرلمانات وعلاقاتها: ناجحة بعد الإصلاح.
- المستخدم غير المخول: ما زال مرفوضًا.
- `test:perf03`: ناجح.
- `npm.cmd run build:production`: ناجح، وتم التحقق من artifact.

## ما يحتاج Deploy لاحقًا

لهذا الإصلاح فقط:

```powershell
firebase deploy --only firestore:rules --project mitchabrim-jce2026
```

لا يحتاج Hosting أو Functions أو Indexes. لم يُنفذ Deploy ولم تُعدّل Production.
