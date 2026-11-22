import {Type} from '@angular/core';
import {Routes} from '@angular/router';
import type {IBoxSettingDefinition, TLanguage} from '../../../../shared/shared';
import type {IScreenTheme} from '../themes/screen-themes';
import type {IBoxSettingGroup} from '../master/box-settings/box-setting-fields';

/**
 * What an extension adds to the client (see docs/extensions.md). Every part is optional. The extensions are listed in
 * extensions.ts, which a build with other extensions replaces (fileReplacements in its angular.json).
 */
export interface IClientExtension {
  /** Unique and stable, the same as its server part's, e.g. 'serial-buzzers' */
  id: string;
  /** Pages of the master, under /master/; like the core's, they should use RouteGuard */
  masterRoutes?: Routes;
  /** Standalone components shown as cards on the master's home page, below the core's */
  homeCards?: Type<unknown>[];
  /** Looks for the screens, after the core's; their CSS variables come with the extension's styles */
  screenThemes?: IScreenTheme[];
  /** Settings of buzzerbox.txt, registered in BoxSettingsHelper, see IBoxSettingDefinition */
  boxSettings?: IBoxSettingDefinition[];
  /** Groups of those settings on the master's settings page */
  boxSettingGroups?: IBoxSettingGroup[];
  /**
   * Texts, by language, merged into the app's (client/src/i18n); an extension should keep its own under
   * "ext.<id>." so they never clash with the core's
   */
  translations?: Partial<Record<TLanguage, Record<string, unknown>>>;
}
