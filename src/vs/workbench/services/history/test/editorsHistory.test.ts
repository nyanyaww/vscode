/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { EditorOptions, EditorInput, IEditorInputFactoryRegistry, Extensions as EditorExtensions, IEditorInputFactory } from 'vs/workbench/common/editor';
import { URI } from 'vs/base/common/uri';
import { workbenchInstantiationService, TestStorageService, TestEditorInput } from 'vs/workbench/test/workbenchTestServices';
import { Registry } from 'vs/platform/registry/common/platform';
import { EditorPart } from 'vs/workbench/browser/parts/editor/editorPart';
import { IEditorRegistry, EditorDescriptor, Extensions } from 'vs/workbench/browser/editor';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { GroupDirection } from 'vs/workbench/services/editor/common/editorGroupsService';
import { EditorActivation } from 'vs/platform/editor/common/editor';
import { BaseEditor } from 'vs/workbench/browser/parts/editor/baseEditor';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { TestThemeService } from 'vs/platform/theme/test/common/testThemeService';
import { CancellationToken } from 'vs/base/common/cancellation';
import { EditorsHistory } from 'vs/workbench/services/history/browser/history';
import { WillSaveStateReason } from 'vs/platform/storage/common/storage';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class TestEditorControl extends BaseEditor {

	constructor() { super('MyTestEditorForEditorHistory', NullTelemetryService, new TestThemeService(), new TestStorageService()); }

	async setInput(input: EditorInput, options: EditorOptions | undefined, token: CancellationToken): Promise<void> {
		super.setInput(input, options, token);

		await input.resolve();
	}

	getId(): string { return 'MyTestEditorForEditorHistory'; }
	layout(): void { }
	createEditor(): any { }
}

class HistoryTestEditorInput extends TestEditorInput {
	getTypeId() { return 'testEditorInputForEditorsHistory'; }
}

interface ISerializedTestInput {
	resource: string;
}

class HistoryTestEditorInputFactory implements IEditorInputFactory {

	canSerialize(editorInput: EditorInput): boolean {
		return true;
	}

	serialize(editorInput: EditorInput): string {
		let testEditorInput = <HistoryTestEditorInput>editorInput;
		let testInput: ISerializedTestInput = {
			resource: testEditorInput.resource.toString()
		};

		return JSON.stringify(testInput);
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): EditorInput {
		let testInput: ISerializedTestInput = JSON.parse(serializedEditorInput);

		return new HistoryTestEditorInput(URI.parse(testInput.resource));
	}
}

suite('Editors History', function () {

	function registerTestEditorInput(): void {
		Registry.as<IEditorRegistry>(Extensions.Editors).registerEditor(EditorDescriptor.create(TestEditorControl, 'MyTestEditorForEditorHistory', 'My Test Editor For History Editor Service'), [new SyncDescriptor(TestEditorInput)]);
	}

	function registerEditorInputFactory() {
		Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories).registerEditorInputFactory('testEditorInputForEditorsHistory', HistoryTestEditorInputFactory);
	}

	registerEditorInputFactory();
	registerTestEditorInput();

	test('basics (single group)', async () => {
		const instantiationService = workbenchInstantiationService();

		const part = instantiationService.createInstance(EditorPart);
		part.create(document.createElement('div'));
		part.layout(400, 300);

		await part.whenRestored;

		const history = new EditorsHistory(part, new TestStorageService());

		let currentHistory = history.editors;
		assert.equal(currentHistory.length, 0);

		const input1 = new HistoryTestEditorInput(URI.parse('foo://bar1'));

		await part.activeGroup.openEditor(input1, EditorOptions.create({ pinned: true }));

		currentHistory = history.editors;
		assert.equal(currentHistory.length, 1);
		assert.equal(currentHistory[0].groupId, part.activeGroup.id);
		assert.equal(currentHistory[0].editor, input1);

		const input2 = new HistoryTestEditorInput(URI.parse('foo://bar2'));
		const input3 = new HistoryTestEditorInput(URI.parse('foo://bar3'));

		await part.activeGroup.openEditor(input2, EditorOptions.create({ pinned: true }));
		await part.activeGroup.openEditor(input3, EditorOptions.create({ pinned: true }));

		currentHistory = history.editors;
		assert.equal(currentHistory.length, 3);
		assert.equal(currentHistory[0].groupId, part.activeGroup.id);
		assert.equal(currentHistory[0].editor, input3);
		assert.equal(currentHistory[1].groupId, part.activeGroup.id);
		assert.equal(currentHistory[1].editor, input2);
		assert.equal(currentHistory[2].groupId, part.activeGroup.id);
		assert.equal(currentHistory[2].editor, input1);

		await part.activeGroup.openEditor(input2, EditorOptions.create({ pinned: true }));

		currentHistory = history.editors;
		assert.equal(currentHistory.length, 3);
		assert.equal(currentHistory[0].groupId, part.activeGroup.id);
		assert.equal(currentHistory[0].editor, input2);
		assert.equal(currentHistory[1].groupId, part.activeGroup.id);
		assert.equal(currentHistory[1].editor, input3);
		assert.equal(currentHistory[2].groupId, part.activeGroup.id);
		assert.equal(currentHistory[2].editor, input1);

		await part.activeGroup.closeEditor(input1);
		currentHistory = history.editors;
		assert.equal(currentHistory.length, 2);
		assert.equal(currentHistory[0].groupId, part.activeGroup.id);
		assert.equal(currentHistory[0].editor, input2);
		assert.equal(currentHistory[1].groupId, part.activeGroup.id);
		assert.equal(currentHistory[1].editor, input3);

		await part.activeGroup.closeAllEditors();
		currentHistory = history.editors;
		assert.equal(currentHistory.length, 0);

		part.dispose();
	});

	test('basics (multi group)', async () => {
		const instantiationService = workbenchInstantiationService();

		const part = instantiationService.createInstance(EditorPart);
		part.create(document.createElement('div'));
		part.layout(400, 300);

		await part.whenRestored;

		const rootGroup = part.activeGroup;

		const history = new EditorsHistory(part, new TestStorageService());

		let currentHistory = history.editors;
		assert.equal(currentHistory.length, 0);

		const sideGroup = part.addGroup(rootGroup, GroupDirection.RIGHT);

		const input1 = new HistoryTestEditorInput(URI.parse('foo://bar1'));

		await rootGroup.openEditor(input1, EditorOptions.create({ pinned: true, activation: EditorActivation.ACTIVATE }));
		await sideGroup.openEditor(input1, EditorOptions.create({ pinned: true, activation: EditorActivation.ACTIVATE }));

		currentHistory = history.editors;
		assert.equal(currentHistory.length, 2);
		assert.equal(currentHistory[0].groupId, sideGroup.id);
		assert.equal(currentHistory[0].editor, input1);
		assert.equal(currentHistory[1].groupId, rootGroup.id);
		assert.equal(currentHistory[1].editor, input1);

		await rootGroup.openEditor(input1, EditorOptions.create({ pinned: true, activation: EditorActivation.ACTIVATE }));

		currentHistory = history.editors;
		assert.equal(currentHistory.length, 2);
		assert.equal(currentHistory[0].groupId, rootGroup.id);
		assert.equal(currentHistory[0].editor, input1);
		assert.equal(currentHistory[1].groupId, sideGroup.id);
		assert.equal(currentHistory[1].editor, input1);

		// Opening an editor inactive should not change
		// the most recent editor, but rather put it behind
		const input2 = new HistoryTestEditorInput(URI.parse('foo://bar2'));

		await rootGroup.openEditor(input2, EditorOptions.create({ inactive: true }));

		currentHistory = history.editors;
		assert.equal(currentHistory.length, 3);
		assert.equal(currentHistory[0].groupId, rootGroup.id);
		assert.equal(currentHistory[0].editor, input1);
		assert.equal(currentHistory[1].groupId, rootGroup.id);
		assert.equal(currentHistory[1].editor, input2);
		assert.equal(currentHistory[2].groupId, sideGroup.id);
		assert.equal(currentHistory[2].editor, input1);

		await rootGroup.closeAllEditors();

		currentHistory = history.editors;
		assert.equal(currentHistory.length, 1);
		assert.equal(currentHistory[0].groupId, sideGroup.id);
		assert.equal(currentHistory[0].editor, input1);

		await sideGroup.closeAllEditors();

		currentHistory = history.editors;
		assert.equal(currentHistory.length, 0);

		part.dispose();
	});

	test('copy group', async () => {
		const instantiationService = workbenchInstantiationService();

		const part = instantiationService.createInstance(EditorPart);
		part.create(document.createElement('div'));
		part.layout(400, 300);

		await part.whenRestored;

		const history = new EditorsHistory(part, new TestStorageService());

		const input1 = new HistoryTestEditorInput(URI.parse('foo://bar1'));
		const input2 = new HistoryTestEditorInput(URI.parse('foo://bar2'));
		const input3 = new HistoryTestEditorInput(URI.parse('foo://bar3'));

		const rootGroup = part.activeGroup;

		await rootGroup.openEditor(input1, EditorOptions.create({ pinned: true }));
		await rootGroup.openEditor(input2, EditorOptions.create({ pinned: true }));
		await rootGroup.openEditor(input3, EditorOptions.create({ pinned: true }));

		let currentHistory = history.editors;
		assert.equal(currentHistory.length, 3);
		assert.equal(currentHistory[0].groupId, rootGroup.id);
		assert.equal(currentHistory[0].editor, input3);
		assert.equal(currentHistory[1].groupId, rootGroup.id);
		assert.equal(currentHistory[1].editor, input2);
		assert.equal(currentHistory[2].groupId, rootGroup.id);
		assert.equal(currentHistory[2].editor, input1);

		const copiedGroup = part.copyGroup(rootGroup, rootGroup, GroupDirection.RIGHT);
		copiedGroup.setActive(true);

		currentHistory = history.editors;
		assert.equal(currentHistory.length, 6);
		assert.equal(currentHistory[0].groupId, copiedGroup.id);
		assert.equal(currentHistory[0].editor, input3);
		assert.equal(currentHistory[1].groupId, rootGroup.id);
		assert.equal(currentHistory[1].editor, input3);
		assert.equal(currentHistory[2].groupId, copiedGroup.id);
		assert.equal(currentHistory[2].editor, input2);
		assert.equal(currentHistory[3].groupId, copiedGroup.id);
		assert.equal(currentHistory[3].editor, input1);
		assert.equal(currentHistory[4].groupId, rootGroup.id);
		assert.equal(currentHistory[4].editor, input2);
		assert.equal(currentHistory[5].groupId, rootGroup.id);
		assert.equal(currentHistory[5].editor, input1);

		part.dispose();
	});

	test('initial editors are part of history and state is persisted & restored (single group)', async () => {
		const instantiationService = workbenchInstantiationService();
		instantiationService.invokeFunction(accessor => Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories).start(accessor));

		const part = instantiationService.createInstance(EditorPart);
		part.create(document.createElement('div'));
		part.layout(400, 300);

		await part.whenRestored;

		const rootGroup = part.activeGroup;

		const input1 = new HistoryTestEditorInput(URI.parse('foo://bar1'));
		const input2 = new HistoryTestEditorInput(URI.parse('foo://bar2'));
		const input3 = new HistoryTestEditorInput(URI.parse('foo://bar3'));

		await rootGroup.openEditor(input1, EditorOptions.create({ pinned: true }));
		await rootGroup.openEditor(input2, EditorOptions.create({ pinned: true }));
		await rootGroup.openEditor(input3, EditorOptions.create({ pinned: true }));

		const storage = new TestStorageService();
		const history = new EditorsHistory(part, storage);
		await part.whenRestored;

		let currentHistory = history.editors;
		assert.equal(currentHistory.length, 3);
		assert.equal(currentHistory[0].groupId, rootGroup.id);
		assert.equal(currentHistory[0].editor, input3);
		assert.equal(currentHistory[1].groupId, rootGroup.id);
		assert.equal(currentHistory[1].editor, input2);
		assert.equal(currentHistory[2].groupId, rootGroup.id);
		assert.equal(currentHistory[2].editor, input1);

		storage._onWillSaveState.fire({ reason: WillSaveStateReason.SHUTDOWN });

		const restoredHistory = new EditorsHistory(part, storage);
		await part.whenRestored;

		currentHistory = restoredHistory.editors;
		assert.equal(currentHistory.length, 3);
		assert.equal(currentHistory[0].groupId, rootGroup.id);
		assert.equal(currentHistory[0].editor, input3);
		assert.equal(currentHistory[1].groupId, rootGroup.id);
		assert.equal(currentHistory[1].editor, input2);
		assert.equal(currentHistory[2].groupId, rootGroup.id);
		assert.equal(currentHistory[2].editor, input1);

		part.dispose();
	});

	test('initial editors are part of history (multi group)', async () => {
		const instantiationService = workbenchInstantiationService();

		const part = instantiationService.createInstance(EditorPart);
		part.create(document.createElement('div'));
		part.layout(400, 300);

		await part.whenRestored;

		const rootGroup = part.activeGroup;

		const input1 = new HistoryTestEditorInput(URI.parse('foo://bar1'));
		const input2 = new HistoryTestEditorInput(URI.parse('foo://bar2'));
		const input3 = new HistoryTestEditorInput(URI.parse('foo://bar3'));

		await rootGroup.openEditor(input1, EditorOptions.create({ pinned: true }));
		await rootGroup.openEditor(input2, EditorOptions.create({ pinned: true }));

		const sideGroup = part.addGroup(rootGroup, GroupDirection.RIGHT);
		await sideGroup.openEditor(input3, EditorOptions.create({ pinned: true }));

		const storage = new TestStorageService();
		const history = new EditorsHistory(part, storage);
		await part.whenRestored;

		let currentHistory = history.editors;
		assert.equal(currentHistory.length, 3);
		assert.equal(currentHistory[0].groupId, sideGroup.id);
		assert.equal(currentHistory[0].editor, input3);
		assert.equal(currentHistory[1].groupId, rootGroup.id);
		assert.equal(currentHistory[1].editor, input2);
		assert.equal(currentHistory[2].groupId, rootGroup.id);
		assert.equal(currentHistory[2].editor, input1);

		storage._onWillSaveState.fire({ reason: WillSaveStateReason.SHUTDOWN });

		const restoredHistory = new EditorsHistory(part, storage);
		await part.whenRestored;

		currentHistory = restoredHistory.editors;
		assert.equal(currentHistory.length, 3);
		assert.equal(currentHistory[0].groupId, sideGroup.id);
		assert.equal(currentHistory[0].editor, input3);
		assert.equal(currentHistory[1].groupId, rootGroup.id);
		assert.equal(currentHistory[1].editor, input2);
		assert.equal(currentHistory[2].groupId, rootGroup.id);
		assert.equal(currentHistory[2].editor, input1);

		part.dispose();
	});

	test('history does not restore editors that cannot be serialized', async () => {
		const instantiationService = workbenchInstantiationService();
		instantiationService.invokeFunction(accessor => Registry.as<IEditorInputFactoryRegistry>(EditorExtensions.EditorInputFactories).start(accessor));

		const part = instantiationService.createInstance(EditorPart);
		part.create(document.createElement('div'));
		part.layout(400, 300);

		await part.whenRestored;

		const rootGroup = part.activeGroup;

		const input1 = new TestEditorInput(URI.parse('foo://bar1'));

		await rootGroup.openEditor(input1, EditorOptions.create({ pinned: true }));

		const storage = new TestStorageService();
		const history = new EditorsHistory(part, storage);
		await part.whenRestored;

		let currentHistory = history.editors;
		assert.equal(currentHistory.length, 1);
		assert.equal(currentHistory[0].groupId, rootGroup.id);
		assert.equal(currentHistory[0].editor, input1);

		storage._onWillSaveState.fire({ reason: WillSaveStateReason.SHUTDOWN });

		const restoredHistory = new EditorsHistory(part, storage);
		await part.whenRestored;

		currentHistory = restoredHistory.editors;
		assert.equal(currentHistory.length, 0);

		part.dispose();
	});
});
