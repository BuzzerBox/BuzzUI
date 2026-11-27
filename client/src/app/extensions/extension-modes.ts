import {InjectionToken} from '@angular/core';
import {CanActivateFn, Route, Routes} from '@angular/router';
import {IClientExtension, IClientExtensionMode} from './client-extension';
import {CLIENT_EXTENSIONS} from './extensions';

/**
 * The extensions of this build, for those that look them up while the app runs (e.g. the route guards), so that specs
 * can provide others
 */
export const CLIENT_EXTENSION_LIST = new InjectionToken<IClientExtension[]>('CLIENT_EXTENSION_LIST', {
  providedIn: 'root',
  factory: () => CLIENT_EXTENSIONS
});

/**
 * The modes of the extensions, see IClientExtensionMode
 */
export class ExtensionModeHelper {

  /** The mode of the extension with that ID, or undefined (no ID, or an extension without a mode) */
  public static getMode(extensions: IClientExtension[], extensionId: string | null): IClientExtensionMode | undefined {
    return extensionId == null ? undefined : extensions.find(extension => extension.id === extensionId)?.mode;
  }

  /** The paths of routes as their config has them, which the guards compare with the route they're asked about */
  public static getPaths(routes: Routes | undefined): string[] {
    return (routes ?? []).map(route => route.path).filter((path): path is string => path != null);
  }

  /** The routes with a guard of the core in front of their own */
  public static guard(routes: Routes, guard: unknown): Routes {
    return routes.map((route: Route) => ({...route, canActivate: [guard as CanActivateFn, ...(route.canActivate ?? [])]}));
  }
}
