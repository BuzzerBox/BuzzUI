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
  /**
   * Pages of the master, under /master/, while no game is set up and no mode is on; like the core's, they should use
   * RouteGuard
   */
  masterRoutes?: Routes;
  /** A mode that takes over the master and the screens, e.g. another game, see IClientExtensionMode */
  mode?: IClientExtensionMode;
  /**
   * Pages outside the master and the screens, e.g. for guests on the box's WiFi; their paths should start with the
   * extension's ID. The touch display of the box doesn't show them.
   */
  publicRoutes?: Routes;
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

/**
 * A mode of an extension: switched on from its button on the master's home page while no game is set up, it shows its
 * own pages on the master and the screens until it is switched off (GameService.setActiveExtension()). The server
 * keeps it, so a master that rejoins and a screen that is reloaded show its pages again. See docs/extensions.md.
 */
export interface IClientExtensionMode {
  /** The Material icon of its button on the home page */
  icon: string;
  /** The texts of its button: its title and a line below it */
  titleKey: string;
  textKey: string;
  /**
   * The master's pages while the mode is on, under /master/; the first one, which must not have parameters, is where
   * the master goes. The core guards them, so that they're only shown while the mode is on.
   */
  masterRoutes: Routes;
  /** The same for the screens, under /screen/ */
  screenRoutes: Routes;
}
