import fs from "node:fs";
import path from "node:path";

const filePath = path.resolve(
  "src/components/workspace/workspace-sections/machine-valuation/mv-asset-images-hub.tsx",
);
let src = fs.readFileSync(filePath, "utf8");

if (!src.includes("useMvI18n")) {
  src = src.replace(
    'import { mvFetchJson } from "./mv-api-client";',
    'import { mvFetchJson } from "./mv-api-client";\nimport { useMvI18n, type MvT } from "./mv-i18n";\nimport { getMvT, readMvLanguage } from "./mv-i18n/helpers";',
  );
}

src = src.replace(
  'const numberFormatter = new Intl.NumberFormat("ar-SA");\nconst dateTimeFormatter = new Intl.DateTimeFormat("ar-SA", {\n  dateStyle: "medium",\n  timeStyle: "short",\n});',
  "",
);

src = src.replace(
  "function formatAssetSearchDate(ms: number): string {",
  "function formatAssetSearchDate(ms: number, dateTimeFormatter: Intl.DateTimeFormat): string {",
);

src = src.replace(
  'function buildImageTree(files: MvDriveFile[]) {\n  const root = createFolderNode("صور الأصول", "");',
  'function buildImageTree(files: MvDriveFile[], rootLabel: string) {\n  const root = createFolderNode(rootLabel, "");',
);

src = src.replace(
  'function previewFolderKindLabel(node: ImageFolderNode): "أصل" | "مجلد" {\n  return isAssetFolderNode(node) ? "أصل" : "مجلد";\n}',
  'function previewFolderKindLabel(node: ImageFolderNode, t: MvT): string {\n  return isAssetFolderNode(node) ? t("assetImages.kind.asset") : t("assetImages.kind.folder");\n}',
);

src = src.replace(
  `function previewFolderStatsLabel(node: ImageFolderNode): string {
  if (isAssetFolderNode(node)) {
    return \`\${numberFormatter.format(node.imageCount)} صورة\`;
  }
  return \`\${numberFormatter.format(countDescendantAssetFolders(node))} أصل · \${numberFormatter.format(
    countDescendantRegularFolders(node),
  )} مجلد\`;
}`,
  `function previewFolderStatsLabel(
  node: ImageFolderNode,
  t: MvT,
  numberFormatter: Intl.NumberFormat,
): string {
  if (isAssetFolderNode(node)) {
    return t("assetImages.meta.imageCount", { count: numberFormatter.format(node.imageCount) });
  }
  return t("assetImages.meta.assetFolderCount", {
    assets: numberFormatter.format(countDescendantAssetFolders(node)),
    folders: numberFormatter.format(countDescendantRegularFolders(node)),
  });
}`,
);

src = src.replace(
  /let message = "تعذر رفع الصور\.";/g,
  'let message = getMvT(readMvLanguage())("assetImages.upload.genericFailed");',
);

src = src.replace(
  'export default function MvAssetImagesHub({ projectId, projectName }: MvAssetImagesHubProps) {\n  const { toast } = useToast();',
  `export default function MvAssetImagesHub({ projectId, projectName }: MvAssetImagesHubProps) {
  const { t, dir, isArabic } = useMvI18n();
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US"),
    [isArabic],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [isArabic],
  );
  const previewKindLabel = useCallback(
    (node: ImageFolderNode) => previewFolderKindLabel(node, t),
    [t],
  );
  const previewStatsLabel = useCallback(
    (node: ImageFolderNode) => previewFolderStatsLabel(node, t, numberFormatter),
    [t, numberFormatter],
  );
  const { toast } = useToast();`,
);

src = src.replace(
  '          phase: params.phase ?? "جاري التحضير…",',
  '          phase: params.phase ?? t("assetImages.upload.phase.preparing"),',
);

src = src.replace(
  '    () => buildImageTree(driveFilesForUploadTree),',
  '    () => buildImageTree(driveFilesForUploadTree, t("assetImages.rootLabel")),',
);
src = src.replace(
  '    [driveFilesForUploadTree],',
  '    [driveFilesForUploadTree, t],',
);

src = src.replace(
  '    const rootNode = createFolderNode("صور الأصول", "__pv_root__");',
  '    const rootNode = createFolderNode(t("assetImages.rootLabel"), "__pv_root__");',
);

src = src.replace(/previewFolderKindLabel\(/g, "previewKindLabel(");
src = src.replace(/previewFolderStatsLabel\(/g, "previewStatsLabel(");

src = src.replace(
  /formatAssetSearchDate\((recentAtMs|latestMs)\)/g,
  "formatAssetSearchDate($1, dateTimeFormatter)",
);

src = src.replace(
  /(\}, \[)(previewPhotoFolders, filesByPicAssetId, projectId)(\]\);)/,
  "$1previewPhotoFolders, filesByPicAssetId, projectId, t$3",
);

// Exact-match replacements only (longest first to avoid partial overlaps)
const exactReplacements = [
  ['placeholder="ابحث باسم الأصل، المجلد، الصورة، الشيت، المسار، أو أي معلومة..."', 'placeholder={t("assetImages.search.placeholder")}'],
  ['"تم عرض الدفعة الأولى، ويجري استكمال بقية الصور في الخلفية"', 't("assetImages.progress.firstBatchShown")'],
  ['"جارٍ تحميل الدفعة الأولى من صور الأصول"', 't("assetImages.progress.firstBatchLoading")'],
  ['"تم الاحتفاظ بالصور المحمّلة ويمكن استكمال بقية البيانات"', 't("assetImages.progress.partialKept")'],
  ['"اكتب عبارة بحث أو اختر المضاف مؤخراً أو حدد نوع النتائج قبل التطبيق."', 't("assetImages.search.invalid")'],
  ['"لم يتم العثور على صور صالحة للرفع."', 't("assetImages.upload.noValidImages")'],
  ['"اختر مجلدًا فعليًا داخل صور الأصول قبل الرفع."', 't("assetImages.upload.selectFolderFirst")'],
  ['"داخل الأصل يسمح برفع الصور مباشرة فقط، ولا يمكن إنشاء مجلدات داخله."', 't("assetImages.upload.noDirectInAsset")'],
  ['"لا يمكن رفع صور مباشرة في مجلد رئيسي. أنشئ أصلًا أولا أو ارفع مجلدًا كاملًا."', 't("assetImages.upload.noDirectInRoot")'],
  ['"لا يمكن إنشاء مجلدات داخل أصل موجود. اختر مجلداً عادياً أو الجذر."', 't("assetImages.upload.cannotCreateInsideAsset")'],
  ['"يوجد مجلد عادي بنفس اسم الأصل المطلوب. اختر اسم أصل مختلفاً."', 't("assetImages.upload.duplicateAssetName")'],
  ['"لم يُعثر على مجلد «صور المعاينة» في المشروع."', 't("assetImages.upload.photosRootNotFound")'],
  ['"اختر مجلدًا فعليًا داخل صور الأصول أو افتح الجذر لإنشاء مجلد جديد."', 't("assetImages.upload.selectFolderOrRootForFolder")'],
  ['"اختر مجلدًا فعليًا داخل صور الأصول أو افتح الجذر لإنشاء أصل جديد."', 't("assetImages.upload.selectFolderOrRootForAsset")'],
  ['"حذف هذه الصورة من الأصل؟"', 't("assetImages.delete.imageConfirm")'],
  ['"لا توجد صور محددة للحذف."', 't("assetImages.delete.noSelection")'],
  ['"لا يمكن حذف مجلد صور الأصول الرئيسي."', 't("assetImages.delete.cannotDeleteRoot")'],
  ['"لا يمكن حذف هذا المجلد الافتراضي."', 't("assetImages.delete.cannotDeleteDefault")'],
  ['"لا توجد أصول فعلية قابلة للحذف داخل هذا التجميع."', 't("assetImages.delete.noDeletableInGroup")'],
  ['"لا توجد صور قابلة للحذف في هذا المجلد."', 't("assetImages.delete.noDeletableInFolder")'],
  ['"لا توجد عناصر فعلية قابلة للحذف."', 't("assetImages.delete.noDeletableItems")'],
  ['"اختر مجلدًا داخل صور الأصول لحذف صوره."', 't("assetImages.toast.selectFolderToDelete")'],
  ['"لا توجد صور مباشرة قابلة للحذف في هذا المجلد."', 't("assetImages.toast.noDirectDeletableImages")'],
  ['"انتظر انتهاء الرفع أو ألغِ المعاينات قبل تغيير الترتيب."', 't("assetImages.reorder.waitUpload")'],
  ['"انتظر انتهاء الرفع قبل نقل أو إعادة ترتيب الصور."', 't("assetImages.reorder.waitUploadMove")'],
  ['"بعض صور التطبيق لا تملك ملفًا فعليًا لإعادة ترتيبها. ارفعها للنظام أولًا."', 't("assetImages.reorder.displayOnly")'],
  ['"تعذر حفظ التغيير."', 't("errors.generic.saveFailed")'],
  ['"تعذر تعديل الاسم."', 't("errors.generic.renameFailed")'],
  ['"تعذر نقل العنصر."', 't("errors.generic.moveFailed")'],
  ['"تعذر حفظ الترتيب."', 't("assetImages.toast.reorderSaveFailed")'],
  ['"تعذر حفظ الموقع."', 't("assetImages.toast.locationSaveFailed")'],
  ['"تعذر حذف الصورة."', 't("assetImages.delete.imageFailed")'],
  ['"تعذر حذف الصور المحددة."', 't("assetImages.delete.selectedFailed")'],
  ['"تعذر حذف بعض الصور، تمت إعادة المزامنة."', 't("errors.generic.partialDeleteResync")'],
  ['"تعذر حذف بعض العناصر، تمت إعادة المزامنة."', 't("errors.generic.partialDeleteResync")'],
  ['"تعذر حذف التجميع."', 't("assetImages.toast.groupDeleteFailed")'],
  ['"تم حذف التجميع وكل أصوله."', 't("assetImages.toast.groupDeleted")'],
  ['"تم حذf الصورة."', 't("assetImages.toast.imageDeleted")'],
  ['"تم حذف الصورة."', 't("assetImages.toast.imageDeleted")'],
  ['"تم حذف صور المجلد."', 't("assetImages.toast.folderImagesDeleted")'],
  ['"تم حذف الصور المحددة للتقرير."', 't("assetImages.toast.selectedForReportDeleted")'],
  ['"تم حذف صور المسار الحالي."', 't("assetImages.toast.currentPathDeleted")'],
  ['"تم حذف صور مجلد المعاينة الحالي."', 't("assetImages.toast.previewFolderDeleted")'],
  ['"تعذر حفظ اختيار الصور للتقرير."', 't("assetImages.toast.reportSelectionSaveFailed")'],
  ['"تعذر تحديث اختيار الصورة للتقرير."', 't("assetImages.toast.imageReportToggleFailed")'],
  ['"تعذر تحديث تضمين كل الصور في التقرير."', 't("assetImages.toast.bulkReportToggleFailed")'],
  ['"تعذر حفظ إعداد عرض الصور في التقرير."', 't("assetImages.toast.reportDisplaySaveFailed")'],
  ['"تعذر تحديث اختيار المجلد للتقرير."', 't("assetImages.toast.folderReportToggleFailed")'],
  ['"تم إنشاء المجلد الرئيسي."', 't("assetImages.create.folderSuccess")'],
  ['"تم إنشاء الأصل."', 't("assetImages.create.assetSuccess")'],
  ['"تعذر إنشاء المجلد."', 't("assetImages.create.folderFailed")'],
  ['"تعذr إنشاء الأصل."', 't("assetImages.create.assetFailed")'],
  ['"تعذر إنشاء الأصل."', 't("assetImages.create.assetFailed")'],
  ['"تم تعديل اسم الأصل."', 't("assetImages.rename.assetSuccess")'],
  ['"تم تعديل اسم المجلد."', 't("assetImages.rename.folderSuccess")'],
  ['"تم نقل الأصل."', 't("assetImages.move.assetSuccess")'],
  ['"تم نقل المجلد."', 't("assetImages.move.folderSuccess")'],
  ['"تم حذف الأصل."', 't("assetImages.toast.assetDeleted")'],
  ['"تم حذف المجلد."', 't("assetImages.toast.folderDeleted")'],
  ['"تعذر حذف الأصل."', 't("assetImages.toast.assetDeleteFailed")'],
  ['"تعذر حذف المجلد."', 't("assetImages.toast.folderDeleteFailed")'],
  ['"تعذر رفع الصور."', 't("assetImages.upload.genericFailed")'],
  ['"تعذر رفع المجلد والصور."', 't("assetImages.upload.folderFailed")'],
  ['"اكتمل الرفع"', 't("assetImages.upload.phase.complete")'],
  ['"تعذر الرفع"', 't("assetImages.upload.phase.failed")'],
  ['"لا توجد صور للرفع"', 't("assetImages.upload.noImagesToUpload")'],
  ['"تعذر رفع المجلد"', 't("assetImages.upload.folderFailed")'],
  ['"رفع الصور…"', 't("assetImages.upload.phase.uploading")'],
  ['"تجهيز المجلد والصور…"', 't("assetImages.upload.folderPreparing")'],
  ['"تحضير رفع الصور…"', 't("assetImages.upload.prepareUpload")'],
  ['"بدء رفع الصور…"', 't("assetImages.upload.startUpload")'],
  ['"اكتمل رفع المجلد"', 't("assetImages.upload.folderUploadComplete")'],
  ['"اكتمل رفع الصور"', 't("assetImages.upload.imagesUploadComplete")'],
  ['{ label: "تحديد صور الأصول" }', '{ label: t("assetImages.breadcrumb") }'],
  ['title="أصل"', 'title={t("assetImages.kind.asset")}'],
  ['title="رجوع خطوة للأعلى"', 'title={t("assetImages.actions.backUp")}'],
  ['aria-label="رجوع خطوة للأعلى"', 'aria-label={t("assetImages.actions.backUp")}'],
  ['title="اسحب لنقل الصورة أو تغيير ترتيبها"', 'title={t("assetImages.actions.dragHint")}'],
  ['title="اسحب لتغيير ترتيب العرض"', 'title={t("assetImages.drag.reorderDisplay")}'],
  ['aria-label="عرض الصور في التقرير"', 'aria-label={t("assetImages.report.toggleAll")}'],
  ['aria-label="إجراءات الصورة"', 'aria-label={t("assetImages.actions.imageMenu")}'],
  ['aria-label="إجراءات المجلد"', 'aria-label={t("assetImages.actions.folderMenu")}'],
  ['aria-label="إجراءات الصور"', 'aria-label={t("assetImages.actions.bulkMenu")}'],
  ['aria-label="تحديث من الخادم"', 'aria-label={t("assetImages.actions.refreshFromServer")}'],
  ['title="إعادة جلب مجلدات الأصول من الخادم"', 'title={t("assetImages.actions.refreshFromServerTitle")}'],
  ['<span>تنزيل صور الأصول</span>', '<span>{t("assetImages.actions.download")}</span>'],
  ['<span>عرض الصور في التقرير</span>', '<span>{t("assetImages.report.toggleAll")}</span>'],
  ['"حذف التجميع الحالي"', 't("assetImages.actions.deleteCurrentGroup")'],
  ['label: "صور الأصول"', 'label: t("assetImages.rootLabel")'],
  ['folderName: folderName || "صور الأصول"', 'folderName: folderName || t("assetImages.rootLabel")'],
  ['?? targetNode?.name ?? "صور الأصول"', '?? targetNode?.name ?? t("assetImages.rootLabel")'],
  ['const label = folder.isSynthetic ? "التجميع" : previewKindLabel(folder)', 'const label = folder.isSynthetic ? t("assetImages.kind.group") : previewKindLabel(folder)'],
  ['? previewKindLabel(selectedPreviewFolderNode) : "المجلد"', '? previewKindLabel(selectedPreviewFolderNode) : t("assetImages.kind.folder")'],
  ['? previewKindLabel(moveDialogFolder) : "العنصر"', '? previewKindLabel(moveDialogFolder) : t("assetImages.move.itemFallback")'],
  ['const defaultName = kind === "folder" ? "مجلد رئيسي جديد" : "أصل جديد"', 'const defaultName = kind === "folder" ? t("assetImages.create.defaultFolder") : t("assetImages.create.defaultAsset")'],
  ['const promptLabel = kind === "folder" ? "اسم المجلد الرئيسي الجديد" : "اسم الأصل الجديد"', 'const promptLabel = kind === "folder" ? t("assetImages.create.promptFolder") : t("assetImages.create.promptAsset")'],
  ['{idx === 0 ? "صور الأصول" : node.name}', '{idx === 0 ? t("assetImages.rootLabel") : node.name}'],
  ['{activeContentNode.path === "__pv_root__" ? "جذr" : previewKindLabel(activeContentNode)}', '{activeContentNode.path === "__pv_root__" ? t("assetImages.root") : previewKindLabel(activeContentNode)}'],
  ['{activeContentNode.path === "__pv_root__" ? "جذر" : previewKindLabel(activeContentNode)}', '{activeContentNode.path === "__pv_root__" ? t("assetImages.root") : previewKindLabel(activeContentNode)}'],
  ['{activeLocationIsAssetFolder ? "رفع صور" : "رفع صور/مجلدات"}', '{activeLocationIsAssetFolder ? t("assetImages.actions.uploadImages") : t("assetImages.actions.uploadImagesOrFolders")}'],
  ['{lightboxFile && isViewFileVideo(lightboxFile) ? "معاينة الفيديو" : "معاينة الصورة"}', '{lightboxFile && isViewFileVideo(lightboxFile) ? t("assetImages.lightbox.previewVideo") : t("assetImages.lightbox.previewImage")}'],
  ['{selected ? "إخفاء من التقرير" : "إظهار في التقرير"}', '{selected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}'],
  ['{folderSelected ? "إخفاء من التقرير" : "إظهار في التقرير"}', '{folderSelected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}'],
  ['{imageSelected ? "إخفاء من التقرير" : "إظهار في التقرير"}', '{imageSelected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}'],
  ['{isVideoRow ? "فتح الفيديو" : "فتح الصورة"}', '{isVideoRow ? t("assetImages.actions.openVideo") : t("assetImages.actions.openImage")}'],
  ['{isVideoCell ? "فتح الفيديو" : "فتح الصورة"}', '{isVideoCell ? t("assetImages.actions.openVideo") : t("assetImages.actions.openImage")}'],
  ['{isVideoRow ? "حذف الفيديو" : "حذف الصورة"}', '{isVideoRow ? t("assetImages.actions.deleteVideo") : t("assetImages.actions.deleteImage")}'],
  ['aria-label={selected ? "إخفاء الصورة من التقرير" : "إظهar الصورة في التقرير"}', 'aria-label={selected ? t("assetImages.report.hideImage") : t("assetImages.report.showImage")}'],
  ['aria-label={selected ? "إخفاء الصورة من التقرير" : "إظهار الصورة في التقرير"}', 'aria-label={selected ? t("assetImages.report.hideImage") : t("assetImages.report.showImage")}'],
  ['aria-label={selected ? "إخفاء صور المجلد من التقرير" : "إظهار صور المجلد في التقرير"}', 'aria-label={selected ? t("assetImages.report.hideFolder") : t("assetImages.report.showFolder")}'],
  ['aria-label={selected ? "إخفاء من التقرير" : "إظهار في التقرير"}', 'aria-label={selected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}'],
  ['aria-label={folderSelected ? "إخفاء من التقرير" : "إظهار في التقرير"}', 'aria-label={folderSelected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}'],
  ['aria-label={imageSelected ? "إخفاء الصورة من التقرير" : "إظهار الصورة في التقرير"}', 'aria-label={imageSelected ? t("assetImages.report.hideImage") : t("assetImages.report.showImage")}'],
  ['aria-label={isVideoRow ? "إجراءات الفيديو" : "إجراءات الصورة"}', 'aria-label={t("assetImages.actions.imageMenu")}'],
  ['aria-label={isVideoCell ? "إجراءات الفيديو" : "إجراءات الصورة"}', 'aria-label={t("assetImages.actions.imageMenu")}'],
  ['aria-label={expanded ? "طي المجلد" : "فتح المجلد"}', 'aria-label={expanded ? t("assetImages.tree.collapseFolder") : t("assetImages.tree.expandFolder")}'],
  ['aria-label={appExpanded ? "طي صور الأصول" : "فتح صور الأصول"}', 'aria-label={appExpanded ? t("assetImages.tree.collapseRoot") : t("assetImages.tree.expandRoot")}'],
  ['{selected ? "إخفاء صور المجلد من التقرير" : "إظهار صور المجلد في التقرير"}', '{selected ? t("assetImages.report.hideFolder") : t("assetImages.report.showFolder")}'],
  ['>استكمال الآن<', '>{t("assetImages.progress.resumeNow")}<'],
  ['>إنشاء مجلدات الصور<', '>{t("assetImages.actions.createFolders")}<'],
  ['>إنشاء<', '>{t("assetImages.actions.create")}<'],
  ['>مجلد عادي<', '>{t("assetImages.actions.regularFolder")}<'],
  ['>مجلد أصل<', '>{t("assetImages.actions.assetFolder")}<'],
  ['>رفع صور<', '>{t("assetImages.actions.uploadImages")}<'],
  ['>رفع مجلد<', '>{t("assetImages.actions.uploadFolder")}<'],
  ['>بحث<', '>{t("assetImages.actions.search")}<'],
  ['>تعديل البحث<', '>{t("assetImages.search.edit")}<'],
  ['>مسح<', '>{t("common.clear")}<'],
  ['>حذف الصور المحددة للتقرير<', '>{t("assetImages.actions.deleteSelectedForReport")}<'],
  ['>حذف صور المسار الحالي<', '>{t("assetImages.actions.deleteCurrentPath")}<'],
  ['>إنشاء مجلد داخل هذا المكان<', '>{t("assetImages.actions.createSubfolder")}<'],
  ['>إنشاء أصل داخل هذا المكان<', '>{t("assetImages.actions.createSubAsset")}<'],
  ['>حذف صور المجلد<', '>{t("assetImages.actions.deleteFolderImages")}<'],
  ['>حذf الصورة<', '>{t("assetImages.actions.deleteImage")}<'],
  ['>حذف الصورة<', '>{t("assetImages.actions.deleteImage")}<'],
  ['>بحث صور الأصول<', '>{t("assetImages.search.title")}<'],
  ['>كل شيء<', '>{t("assetImages.search.modeAll")}<'],
  ['>المضاف مؤخراً<', '>{t("assetImages.search.modeRecent")}<'],
  ['>الكل<', '>{t("assetImages.search.kindAll")}<'],
  ['>المجلدات<', '>{t("assetImages.search.kindFolders")}<'],
  ['>الصور<', '>{t("assetImages.search.kindImages")}<'],
  ['>تطبيق<', '>{t("assetImages.search.apply")}<'],
  ['>لا توجد وجهات متاحة للنقل.<', '>{t("assetImages.move.noDestinations")}<'],
  ['>اختر مجلد أصل من الشجرة<', '>{t("assetImages.empty.selectFolderFromTree")}<'],
  ['>لا توجد نتائج لهذا البحث<', '>{t("assetImages.empty.noSearchResults")}<'],
  ['description: error instanceof Error ? error.message : "تعذر رفع الصور."', 'description: error instanceof Error ? error.message : t("assetImages.upload.genericFailed")'],
  ['description: error instanceof Error ? error.message : "تعذر رفع المجلد والصور."', 'description: error instanceof Error ? error.message : t("assetImages.upload.folderFailed")'],
  ['toast({ description: kind === "folder" ? "تم إنشاء المجلد الرئيسي." : "تم إنشاء الأصل." })', 'toast({ description: kind === "folder" ? t("assetImages.create.folderSuccess") : t("assetImages.create.assetSuccess") })'],
  ['toast({ variant: "destructive", description: kind === "folder" ? "تعذر إنشاء المجلد." : "تعذر إنشاء الأصل." })', 'toast({ variant: "destructive", description: kind === "folder" ? t("assetImages.create.folderFailed") : t("assetImages.create.assetFailed") })'],
  ['toast({ description: label === "أصل" ? "تم تعديل اسم الأصل." : "تم تعديل اسم المجلد." })', 'toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.rename.assetSuccess") : t("assetImages.rename.folderSuccess") })'],
  ['toast({ description: label === "أصل" ? "تم نقل الأصل." : "تم نقل المجلد." })', 'toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.move.assetSuccess") : t("assetImages.move.folderSuccess") })'],
  ['toast({ description: label === "أصل" ? "تم حذف الأصل." : "تم حذf المجلد." })', 'toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.toast.assetDeleted") : t("assetImages.toast.folderDeleted") })'],
  ['toast({ description: label === "أصل" ? "تم حذف الأصل." : "تم حذف المجلد." })', 'toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.toast.assetDeleted") : t("assetImages.toast.folderDeleted") })'],
  ['toast({ variant: "destructive", description: label === "أصل" ? "تعذr حذf الأصل." : "تعذr حذf المجلد." })', 'toast({ variant: "destructive", description: label === t("assetImages.kind.asset") ? t("assetImages.toast.assetDeleteFailed") : t("assetImages.toast.folderDeleteFailed") })'],
  ['toast({ variant: "destructive", description: label === "أصل" ? "تعذر حذف الأصل." : "تعذر حذف المجلد." })', 'toast({ variant: "destructive", description: label === t("assetImages.kind.asset") ? t("assetImages.toast.assetDeleteFailed") : t("assetImages.toast.folderDeleteFailed") })'],
  ['const nextName = window.prompt(`اسم ${label} الجديد`, folder.name)?.trim()', 'const nextName = window.prompt(t("assetImages.rename.promptNewName", { kind: label }), folder.name)?.trim()'],
  ['{result.kind === "folder" ? (result.folderKind === "asset" ? "أصل" : "مجلد") : "صورة"}', '{result.kind === "folder" ? (result.folderKind === "asset" ? t("assetImages.kind.asset") : t("assetImages.kind.folder")) : t("assetImages.meta.image")}'],
  ['{numberFormatter.format(selectedCount)} للتقرير', '{t("assetImages.report.selectedCount", { count: numberFormatter.format(selectedCount) })}'],
  ['{numberFormatter.format(assetSearchResults.length)} نتيجة مطبقة على مساحة العمل', '{t("assetImages.search.resultsApplied", { count: numberFormatter.format(assetSearchResults.length) })}'],
  ['{numberFormatter.format(assetSearchStats.folders)} مجلد', '{t("assetImages.search.statsFolder", { count: numberFormatter.format(assetSearchStats.folders) })}'],
  ['{numberFormatter.format(assetSearchStats.images)} صورة', '{t("assetImages.search.statsImage", { count: numberFormatter.format(assetSearchStats.images) })}'],
  ['اكتب عبارة البحث أو اختر المضاف مؤخراً، ثم اضغط تطبيق لعرض النتائج في مساحة الصفحة.', '{t("assetImages.search.description")}'],
  ['عدّل عبارة البحث أو اختر المضاف مؤخراً من زر البحث.', '{t("assetImages.empty.noSearchResultsHint")}'],
  ['اسحب الصور إلى المجلد أو استخدم أزرار الرفع بالأعلى.', '{t("assetImages.empty.noContentHint")}'],
  ['اختر الجذر أو مجلداً عادياً كوجهة. لا يمكن نقل العناصر داخل أصل.', '{t("assetImages.move.description")}'],
  ['dir="rtl"', 'dir={dir}'],
];

exactReplacements.sort((a, b) => b[0].length - a[0].length);
for (const [from, to] of exactReplacements) {
  if (src.includes(from)) src = src.split(from).join(to);
}

// Template literal replacements via regex
src = src.replace(
  /description: `تم حفظ \$\{numberFormatter\.format\(uploadedRows\.length\)\} صورة في الخادم\.`/g,
  'description: t("assetImages.upload.savedCount", { count: numberFormatter.format(uploadedRows.length) })',
);
src = src.replace(
  /description: `تم حفظ \$\{numberFormatter\.format\(uploadedRows\.length\)\} صورة في المجلد\.`/g,
  'description: t("assetImages.upload.savedInFolder", { count: numberFormatter.format(uploadedRows.length) })',
);
src = src.replace(
  /\? `تم حفظ \$\{numberFormatter\.format\(totalImages\)\} صورة في مجلد «\$\{rootFolderLabel\}»\.`\s*: `تم حفظ \$\{numberFormatter\.format\(totalImages\)\} صورة\.`/g,
  '? t("assetImages.upload.savedInNamedFolder", { count: numberFormatter.format(totalImages), name: rootFolderLabel })\n            : t("assetImages.upload.savedCount", { count: numberFormatter.format(totalImages) })',
);
src = src.replace(
  /if \(!window\.confirm\(`حذف \$\{numberFormatter\.format\(ids\.length\)\} صورة؟`\)\) return;/g,
  'if (!window.confirm(t("assetImages.delete.imagesConfirm", { count: numberFormatter.format(ids.length) }))) return;',
);
src = src.replace(
  /phase: `معاينة صور «\$\{folderDisplayName\}» \(\$\{numberFormatter\.format\(completedInGroup\)\}\/\$\{numberFormatter\.format\(groupTotal\)\}\)`/g,
  'phase: t("assetImages.upload.previewImages", { name: folderDisplayName, current: numberFormatter.format(completedInGroup), total: numberFormatter.format(groupTotal) })',
);
src = src.replace(
  /phase: `رفع «\$\{folderDisplayName\}» إلى الخادم \(\$\{numberFormatter\.format\(uploaded\)\}\/\$\{numberFormatter\.format\(total\)\}\)`/g,
  'phase: t("assetImages.upload.uploadToServer", { name: folderDisplayName, current: numberFormatter.format(uploaded), total: numberFormatter.format(total) })',
);
src = src.replace(
  /pushGlobalProgress\(`إنشاء المجلد «\$\{creatingLabel\}»…`/g,
  'pushGlobalProgress(t("assetImages.upload.creatingFolder", { name: creatingLabel })',
);
src = src.replace(
  /`اكتمل مجلد «\$\{group\.folderName\}»`/g,
  't("assetImages.upload.folderComplete", { name: group.folderName })',
);
src = src.replace(
  /\? `مجلد «\$\{rootFolderLabel\}»`/g,
  '? t("assetImages.upload.folderLabel", { name: rootFolderLabel })',
);
src = src.replace(
  /: `\$\{numberFormatter\.format\(totalImages\)\} صورة`/g,
  ': t("assetImages.upload.imageCountLabel", { count: numberFormatter.format(totalImages) })',
);
src = src.replace(
  /label: `\«\$\{folderDisplayName\}\» — \$\{numberFormatter\.format\(patch\.completedInGroup\)\} \/ \$\{numberFormatter\.format\(patch\.groupTotal\)\} صورة`/g,
  'label: t("assetImages.upload.uploadProgressLabel", { name: folderDisplayName, current: numberFormatter.format(patch.completedInGroup), total: numberFormatter.format(patch.groupTotal) })',
);
src = src.replace(
  /label: `\$\{numberFormatter\.format\(groupTotal\)\} صورة`/g,
  'label: t("assetImages.upload.imageCountLabel", { count: numberFormatter.format(groupTotal) })',
);
src = src.replace(
  /\? `المجلد: \$\{activeAssetUploadJob\.folderName\} · \$\{numberFormatter\.format\(activeAssetUploadJob\.current\)\} \/ \$\{numberFormatter\.format\(activeAssetUploadJob\.total\)\}`\s*: `\$\{numberFormatter\.format\(activeAssetUploadJob\.current\)\} \/ \$\{numberFormatter\.format\(activeAssetUploadJob\.total\)\} صورة`/g,
  '? t("assetImages.upload.jobFolderProgress", { name: activeAssetUploadJob.folderName, current: numberFormatter.format(activeAssetUploadJob.current), total: numberFormatter.format(activeAssetUploadJob.total) })\n                : t("assetImages.upload.imageCountLabel", { count: `${numberFormatter.format(activeAssetUploadJob.current)} / ${numberFormatter.format(activeAssetUploadJob.total)}` })',
);

// appliedAssetSearchTitle useMemo body
src = src.replace(
  `    const kindLabel =
      appliedAssetSearch.kind === "folder"
        ? "المجلدات فقط"
        : appliedAssetSearch.kind === "image"
          ? "الصور فقط"
          : "";
    const suffix = kindLabel ? \` - \${kindLabel}\` : "";
    if (appliedAssetSearch.mode === "recent" && query) return \`المضاف مؤخراً المطابق لـ «\${query}»\${suffix}\`;
    if (appliedAssetSearch.mode === "recent") return \`المضاف مؤخراً\${suffix}\`;
    if (query) return \`نتائج البحث عن «\${query}»\${suffix}\`;
    return \`نتائج البحث\${suffix}\`;
  }, [appliedAssetSearch]);`,
  `    const kindLabel =
      appliedAssetSearch.kind === "folder"
        ? t("assetImages.search.mode.foldersOnly")
        : appliedAssetSearch.kind === "image"
          ? t("assetImages.search.mode.imagesOnly")
          : "";
    const suffix = kindLabel ? \` - \${kindLabel}\` : "";
    if (appliedAssetSearch.mode === "recent" && query) {
      return \`\${t("assetImages.search.mode.recentWithQuery", { query })}\${suffix}\`;
    }
    if (appliedAssetSearch.mode === "recent") return \`\${t("assetImages.search.mode.recent")}\${suffix}\`;
    if (query) return \`\${t("assetImages.search.mode.query", { query })}\${suffix}\`;
    return \`\${t("assetImages.search.mode.generic")}\${suffix}\`;
  }, [appliedAssetSearch, t]);`,
);

// asset search row chips
src = src.replace(
  `"صورة",
          isDisplayOnlyPicAssetImage(file) ? "من بيانات الأصل" : "ملف محفوظ",
          file.includeInReport === true ? "ضمن التقرير" : "خارج التقرير",
          recentLabel ? \`أضيفت \${recentLabel}\` : null,`,
  `t("assetImages.meta.image"),
          isDisplayOnlyPicAssetImage(file) ? t("assetImages.meta.fromAssetData") : t("assetImages.meta.savedFile"),
          file.includeInReport === true ? t("assetImages.report.include") : t("assetImages.report.exclude"),
          recentLabel ? t("assetImages.meta.addedRecently", { when: recentLabel }) : null,`,
);

src = src.replace(
  /node\.sheetName \? `شيت \$\{node\.sheetName\}` : null,\s*recentLabel \? `آخر إضافة \$\{recentLabel\}` : null,/g,
  'node.sheetName ? t("assetImages.meta.sheet", { name: node.sheetName }) : null,\n          recentLabel ? t("assetImages.meta.lastAdded", { when: recentLabel }) : null,',
);

src = src.replace(
  /previewKindLabel\(node\),\s*\.\.\.\(node\.imageCount[\s\S]*?\[`\$\{numberFormatter\.format\(node\.imageCount\)\} صورة`\]/g,
  (match) => match.replace(/`\$\{numberFormatter\.format\(node\.imageCount\)\} صورة`/, 't("assetImages.meta.imageCount", { count: numberFormatter.format(node.imageCount) })'),
);

fs.writeFileSync(filePath, src);
console.log("Hub i18n migration pass 2 complete");
