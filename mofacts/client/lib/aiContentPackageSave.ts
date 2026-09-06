import { buildImportPackageFromDraftLessons } from './importPackageBuilder';
import { getImportFileNames, sanitizeImportName } from './importCompositionBuilder';
import type { BuiltImportPackage, ImportDraftLesson } from './normalizedImportTypes';
import type { CreatedOutput } from './aiContentTypes';
import { uploadPackageAsset } from './packageUploadClient';
import type { AiContentSaveContract } from '../../common/aiContentContract';

export type GeneratedNameConflict = {
  entryIndex: number;
  tdfFile: string;
  title: string;
};

type UploadHandle = {
  on: (eventName: 'start' | 'progress' | 'end', callback: (...args: any[]) => void) => void;
  start: () => void;
};

export type AiContentPackageSaveDeps = {
  dynamicAssets: {
    insert: (options: { file: File; chunkSize: 'dynamic'; meta: Record<string, unknown> }, autoStart: false) => UploadHandle;
    link: (file: Record<string, unknown>) => string;
  };
  callAsync: (name: string, ...args: any[]) => Promise<any>;
  getUploadIntegrity: (file: File) => Promise<unknown>;
  refreshAssets?: () => void;
  logCleanupError?: (error: unknown) => void;
  makeFile?: (parts: BlobPart[], fileName: string, options: FilePropertyBag) => File;
};

export function readGeneratedNameConflict(error: unknown): GeneratedNameConflict | null {
  const meteorError = error as { error?: unknown; details?: unknown };
  if (meteorError?.error !== 'generated-package-name-conflict') {
    return null;
  }
  try {
    const parsed = JSON.parse(String(meteorError.details || '{}'));
    const entryIndex = Number(parsed.entryIndex);
    const tdfFile = String(parsed.tdfFile || '').trim();
    const title = String(parsed.title || tdfFile || '').trim();
    if (!Number.isInteger(entryIndex) || entryIndex < 0 || !tdfFile) {
      return null;
    }
    return { entryIndex, tdfFile, title };
  } catch {
    return null;
  }
}

export function renameDraftLesson(draft: ImportDraftLesson, newName: string): void {
  const displayTitle = String(newName || '').replace(/\s+/g, ' ').trim() || 'AI Created Lesson';
  const safeName = sanitizeImportName(displayTitle, 'AI_Created_Lesson');
  const { stimFileName } = getImportFileNames(safeName);
  draft.title = displayTitle;
  const generatedTutor = draft.generatedBaseline.tutor as { setspec?: Record<string, unknown> };
  const workingTutor = draft.workingCopy.tutor as { setspec?: Record<string, unknown> };
  generatedTutor.setspec = generatedTutor.setspec || {};
  workingTutor.setspec = workingTutor.setspec || {};
  generatedTutor.setspec.lessonname = displayTitle;
  generatedTutor.setspec.stimulusfile = stimFileName;
  workingTutor.setspec.lessonname = displayTitle;
  workingTutor.setspec.stimulusfile = stimFileName;
}

export function suggestedReplacementName(conflict: GeneratedNameConflict): string {
  return sanitizeImportName(`${conflict.title}_2`, 'AI_Created_Lesson');
}

export function buildSaveEntries(builtPackage: BuiltImportPackage): Array<Record<string, unknown>> {
  return builtPackage.lessons.map((lesson, index) => {
    const manifest = (builtPackage.manifest[index] || {}) as Record<string, unknown>;
    const tdfName = String(manifest.tdfName || lesson.title || '').trim();
    const { safeName, stimFileName, tdfFileName } = getImportFileNames(tdfName);
    const tutor = JSON.parse(JSON.stringify(lesson.workingCopy.tutor || {}));
    const stimuli = JSON.parse(JSON.stringify(lesson.workingCopy.stimuli || {}));
    tutor.setspec = tutor.setspec || {};
    tutor.setspec.lessonname = safeName;
    tutor.setspec.stimulusfile = String(manifest.stimFile || stimFileName);
    return {
      moduleId: (lesson.sourceConfig as { moduleId?: unknown })?.moduleId || manifest.moduleId || 'learningSession',
      artifactKind: manifest.artifactKind || (lesson.sourceConfig as { moduleId?: unknown })?.moduleId || 'learningSession',
      title: safeName,
      tdfFile: String(manifest.tdfFile || tdfFileName),
      stimFile: String(manifest.stimFile || stimFileName),
      itemCount: Number(manifest.cardCount || lesson.stats?.totalItems || 0),
      tutor,
      stimuli,
    };
  });
}

export function uploadBuiltPackage(
  builtPackage: BuiltImportPackage,
  creationSummary: string,
  deps: AiContentPackageSaveDeps,
  saveContract: AiContentSaveContract,
): Promise<CreatedOutput[]> {
  return (async () => {
    const firstManifest = Array.isArray(builtPackage.manifest) && builtPackage.manifest.length > 0
      ? builtPackage.manifest[0]
      : null;
    const archiveName = sanitizeImportName(firstManifest?.tdfName, 'ai-learning-content');
    const fileName = `${archiveName}.zip`;
    const makeFile = deps.makeFile || ((parts, name, options) => new File(parts, name, options));
    const file = makeFile([builtPackage.zipBlob], fileName, { type: 'application/zip' });
    const { asset, integrity: uploadIntegrity } = await uploadPackageAsset({
      dynamicAssets: deps.dynamicAssets,
      file,
      getUploadIntegrity: deps.getUploadIntegrity as (file: File) => Promise<Partial<{ expectedSize: number; sha256?: string }>>,
    });
    try {
      const outputs = await deps.callAsync('saveAiGeneratedPackageContent', {
              packageAssetId: asset._id,
              packageFileName: fileName,
              uploadIntegrity,
              creationSummary,
              contract: saveContract,
            });
      deps.refreshAssets?.();
      return outputs as CreatedOutput[];
    } catch (processError) {
      try {
        await deps.callAsync('removeAssetById', asset._id);
      } catch (cleanupError) {
        deps.logCleanupError?.(cleanupError);
      }
      throw processError;
    }
  })();
}

export async function buildUploadWithNameConflictRetry(
  drafts: ImportDraftLesson[],
  creationSummary: string,
  deps: AiContentPackageSaveDeps & {
    promptForReplacementName: (conflict: GeneratedNameConflict) => string | null;
  },
  saveContract: AiContentSaveContract,
): Promise<{ builtPackage: BuiltImportPackage; outputs: CreatedOutput[] }> {
  if (drafts.length !== 1) throw new Error('AI Content Creator saves exactly one Learning or Test content system.');
  const maxAttempts = drafts.length + 3;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const builtPackage = await buildImportPackageFromDraftLessons(drafts, { preserveLessonTitle: true });
    try {
      const outputs = await uploadBuiltPackage(builtPackage, creationSummary, deps, saveContract);
      return { builtPackage, outputs };
    } catch (error) {
      const conflict = readGeneratedNameConflict(error);
      if (!conflict || !drafts[conflict.entryIndex]) throw error;
      const newName = deps.promptForReplacementName(conflict);
      if (!newName) throw new Error('Generated content save canceled because the name already exists.');
      renameDraftLesson(drafts[conflict.entryIndex]!, newName);
    }
  }
  throw new Error('Generated content could not be saved after repeated name conflicts.');
}
