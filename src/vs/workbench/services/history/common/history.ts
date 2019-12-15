/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IResourceInput } from 'vs/platform/editor/common/editor';
import { IEditorInput, IEditorIdentifier, GroupIdentifier } from 'vs/workbench/common/editor';
import { URI } from 'vs/base/common/uri';

export const IHistoryService = createDecorator<IHistoryService>('historyService');

export interface INavigateAcrossEditorsOptions {
	inGroup?: GroupIdentifier;
}

export interface IHistoryService {

	_serviceBrand: undefined;

	/**
	 * Re-opens the last closed editor if any.
	 */
	reopenLastClosedEditor(): void;

	/**
	 * Navigates to the last location where an edit happened.
	 */
	openLastEditLocation(): void;

	/**
	 * Navigate forwards in history.
	 *
	 * @param options allows to be more specific to navigate across
	 * editors of all groups or a specific group.
	 */
	forward(options?: INavigateAcrossEditorsOptions): void;

	/**
	 * Navigate backwards in history.
	 *
	 * @param options allows to be more specific to navigate across
	 * editors of all groups or a specific group.
	 */
	back(options?: INavigateAcrossEditorsOptions): void;

	/**
	 * Navigate forward or backwards to previous entry in history.
	 */
	last(): void;

	/**
	 * Removes an entry from history.
	 */
	remove(input: IEditorInput | IResourceInput): void;

	/**
	 * Clears all history.
	 */
	clear(): void;

	/**
	 * Clear list of recently opened editors.
	 */
	clearRecentlyOpened(): void;

	/**
	 * Get the entire history of editors that were opened.
	 */
	getHistory(): Array<IEditorInput | IResourceInput>;

	/**
	 * Looking at the editor history, returns the workspace root of the last file that was
	 * inside the workspace and part of the editor history.
	 *
	 * @param schemeFilter filter to restrict roots by scheme.
	 */
	getLastActiveWorkspaceRoot(schemeFilter?: string): URI | undefined;

	/**
	 * Looking at the editor history, returns the resource of the last file that was opened.
	 *
	 * @param schemeFilter filter to restrict roots by scheme.
	 */
	getLastActiveFile(schemeFilter: string): URI | undefined;

	/**
	 * Get a list of most recently used editors that are open.
	 */
	getMostRecentlyUsedOpenEditors(): Array<IEditorIdentifier>;
}
