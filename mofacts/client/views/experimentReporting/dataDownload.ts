import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import './dataDownload.html';
import '../shared/adminUi/adminUi';
import { ReactiveVar } from 'meteor/reactive-var';
import { clientConsole } from '../..';
import { getActiveUiLocale } from '../../lib/interfaceLocaleState';
import { translatePlatformString } from '../../lib/interfaceI18n';
import {
  rejectLoad,
  resolveLoad,
  startLoad,
  type LoadableState,
} from '../../lib/adminUi/loadableState';
import { createTemplateLifetime, type TemplateLifetime } from '../../lib/adminUi/templateLifetime';
import { createScopedAsyncCommandRegistry, type ScopedAsyncCommandRegistry } from '../../lib/adminUi/scopedAsyncCommandRegistry';
import { normalizeDataDownloadRows, type DataDownloadRow } from './dataDownloadState';

const MeteorCompat = Meteor as typeof Meteor & { callAsync: (name: string, ...args: any[]) => Promise<any> };

type DownloadMessage = Readonly<{
  level: 'info' | 'success' | 'warning' | 'error';
  text: string;
}>;

type DataDownloadInstance = Blaze.TemplateInstance & {
  filesPresentation: ReactiveVar<LoadableState<DataDownloadRow[]>>;
  downloadMessages: ReactiveVar<Record<string, DownloadMessage>>;
  downloadCommandRegistry: ScopedAsyncCommandRegistry<DownloadMessage>;
  filesLifetime: TemplateLifetime;
  nextFilesRequestId: number;
};

function reportingText(key: Parameters<typeof translatePlatformString>[1], values?: Parameters<typeof translatePlatformString>[2]): string {
  return translatePlatformString(getActiveUiLocale(), key, values);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readyLoadValue<T>(state: LoadableState<T>): T | null {
  return state.status === 'ready' || state.status === 'empty' || state.status === 'refreshing' || state.status === 'refresh-error'
    ? state.value
    : null;
}

function loadErrorMessage<T>(state: LoadableState<T>): string {
  return state.status === 'error' || state.status === 'refresh-error' ? state.message : '';
}

function loadPending<T>(state: LoadableState<T>): boolean {
  return state.status === 'idle' || state.status === 'loading' || state.status === 'refreshing';
}

function rowAccessibleName(row: DataDownloadRow): string {
  return String(row?.disp || row?.content?.fileName || row?._id || '').trim();
}

function setDownloadMessage(instance: DataDownloadInstance, scope: string, text: string | null, level: DownloadMessage['level'] = 'info'): void {
  const messages = { ...instance.downloadMessages.get() };
  if (text) messages[scope] = { text, level };
  else delete messages[scope];
  instance.downloadMessages.set(messages);
}

function downloadMessageFor(instance: DataDownloadInstance, scope: string): DownloadMessage | null {
  return instance.downloadMessages.get()[scope] || null;
}

function loadDownloadableFiles(instance: DataDownloadInstance): void {
  const requestId = ++instance.nextFilesRequestId;
  const generation = instance.filesLifetime.begin();
  instance.filesPresentation.set(startLoad(instance.filesPresentation.get(), requestId));

  MeteorCompat.callAsync('getAccessableTDFSForUser', Meteor.userId())
    .then((result) => {
      if (!instance.filesLifetime.isCurrent(generation)) return;
      const rows = normalizeDataDownloadRows(result);
      instance.filesPresentation.set(resolveLoad(
        instance.filesPresentation.get(),
        requestId,
        rows,
        (value) => value.length === 0,
      ));
    })
    .catch((error) => {
      if (!instance.filesLifetime.isCurrent(generation)) return;
      clientConsole(1, '[DataDownload] Failed to load data:', error);
      instance.filesPresentation.set(rejectLoad(
        instance.filesPresentation.get(),
        requestId,
        { message: reportingText('reporting.couldNotLoadDownloadableData'), retryable: true },
      ));
    });
}

Template.dataDownload.onCreated(function(this: DataDownloadInstance) {
  this.filesPresentation = new ReactiveVar<LoadableState<DataDownloadRow[]>>({ status: 'idle' });
  this.downloadMessages = new ReactiveVar<Record<string, DownloadMessage>>({});
  this.downloadCommandRegistry = createScopedAsyncCommandRegistry<DownloadMessage>((scope, state) => {
    if (state.status === 'pending') setDownloadMessage(this, scope, reportingText('reporting.preparingDownload'), 'info');
    else if (state.status === 'success') setDownloadMessage(this, scope, state.result.text, state.result.level);
    else if (state.status === 'error') setDownloadMessage(this, scope, state.message, 'error');
  });
  this.filesLifetime = createTemplateLifetime();
  this.nextFilesRequestId = 0;
  loadDownloadableFiles(this);
});

Template.dataDownload.onDestroyed(function(this: DataDownloadInstance) {
  this.filesLifetime.destroy();
  this.downloadCommandRegistry.destroy();
});

Template.dataDownload.helpers({
  isLoading(): boolean {
    return loadPending((Template.instance() as DataDownloadInstance).filesPresentation.get());
  },
  loadErrorText(): string {
    return loadErrorMessage((Template.instance() as DataDownloadInstance).filesPresentation.get());
  },
  downloadFilesTableLabel(): string {
    return reportingText('reporting.dataFromOwnedTdfs');
  },
  downloadFilesTableData() {
    const instance = Template.instance() as DataDownloadInstance;
    const filesPresentation = instance.filesPresentation.get();
    return {
      rows: (readyLoadValue(filesPresentation) || []).map((row) => ({
        ...row,
        downloadMessage: downloadMessageFor(instance, `tdf:${row._id}`),
        downloadBusy: instance.downloadCommandRegistry.getState(`tdf:${row._id}`).status === 'pending',
      })),
      isLoading: loadPending(filesPresentation),
      loadErrorText: loadErrorMessage(filesPresentation),
    };
  },
  historyDownloadMessage(): DownloadMessage | null {
    const instance = Template.instance() as DataDownloadInstance;
    return downloadMessageFor(instance, 'history');
  },
  ownedDownloadMessage(): DownloadMessage | null {
    const instance = Template.instance() as DataDownloadInstance;
    return downloadMessageFor(instance, 'owned');
  },
  historyDownloadBusy(): boolean {
    return (Template.instance() as DataDownloadInstance).downloadCommandRegistry.getState('history').status === 'pending';
  },
  ownedDownloadBusy(): boolean {
    return (Template.instance() as DataDownloadInstance).downloadCommandRegistry.getState('owned').status === 'pending';
  },
  reportingText(key: Parameters<typeof translatePlatformString>[1], options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
    return reportingText(key, options?.hash);
  },
});

Template.dataDownloadFilesTable.helpers({
  reportingText(key: Parameters<typeof translatePlatformString>[1], options?: { hash?: Parameters<typeof translatePlatformString>[2] }) {
    return reportingText(key, options?.hash);
  },
  downloadFileAriaLabel(row: DataDownloadRow): string {
    const target = rowAccessibleName(row);
    const action = reportingText('reporting.downloadDataFile');
    return target ? `${action}: ${target}` : action;
  },
  rootOmnibusAriaLabel(row: DataDownloadRow): string {
    const target = rowAccessibleName(row);
    const action = reportingText('reporting.downloadRootOmnibus');
    return target ? `${action}: ${target}` : action;
  },
});

Template.dataDownload.events({
  'click [data-download-load-retry]'(event: Event, instance: DataDownloadInstance) {
    event.preventDefault();
    loadDownloadableFiles(instance);
  },
  'click .data-download-link'(event: any, instance: DataDownloadInstance) {
    event.preventDefault();
    const fileId = event.currentTarget.getAttribute('data-fileId');
    if (fileId) {
      makeDataDownloadMethodCall(instance, `tdf:${fileId}`, 'downloadDataById', fileId);
    }
  },
  'click .root-omnibus-download-link'(event: any, instance: DataDownloadInstance) {
    event.preventDefault();
    const fileId = event.currentTarget.getAttribute('data-fileId');
    if (!fileId) {
      return;
    }
    makeDataDownloadMethodCall(instance, `tdf:${fileId}`, 'downloadDataById', fileId, true);
  },
  'click #userDataDownloadLink'(event: any, instance: DataDownloadInstance) {
    event.preventDefault();
    makeDataDownloadMethodCall(instance, 'owned', 'downloadDataByTeacher', Meteor.userId());
  },
  'click #ownHistoryDownloadButton'(event: any, instance: DataDownloadInstance) {
    event.preventDefault();
    makeDataDownloadMethodCall(instance, 'history', 'downloadOwnHistoryAcrossTdfs');
  },
});

function makeDataDownloadMethodCall(instance: DataDownloadInstance, scope: string, methodName: string, ...args: any[]): void {
  void instance.downloadCommandRegistry.run(scope, async () => {
    const response = await MeteorCompat.callAsync(methodName, ...args);
    if (response?.downloadUrl) {
      startDownloadFromUrl(response.downloadUrl);
    } else {
      createData(response);
    }
    return { text: reportingText('reporting.downloadStarted'), level: 'success' };
  }, {
    getErrorMessage: (error) => reportingText('reporting.downloadFailed', { error: errorMessage(error) }),
    onFailure: (error) => {
      const message = errorMessage(error);
      clientConsole(1, '[DataDownload] Download failed:', message);
    },
  });
}

function startDownloadFromUrl(url: string): void {
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style.display = 'none';
  // Keep same-origin file links out of FlowRouter; the server names the file.
  a.download = '';
  a.href = url;
  a.click();
  document.body.removeChild(a);
}

function encodeUtf16Le(str: string): ArrayBuffer {
  const buf = new ArrayBuffer(2 + str.length * 2);
  const view = new DataView(buf);
  view.setUint8(0, 0xFF);
  view.setUint8(1, 0xFE);
  for (let i = 0; i < str.length; i++) {
    view.setUint16(2 + i * 2, str.charCodeAt(i), true);
  }
  return buf;
}

function createData(result: any): void {
  let blobData: ArrayBuffer | string = result.content;
  let mimeType: string = result.contentType;
  if (result.contentType === 'text/tab-separated-values') {
    blobData = encodeUtf16Le(result.content);
    mimeType = 'text/tab-separated-values; charset=utf-16le';
  }
  const blob = new Blob([blobData], { type: mimeType });
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style.display = 'none';
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = result.fileName;
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
