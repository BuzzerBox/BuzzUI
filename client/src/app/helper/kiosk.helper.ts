import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';

/**
 * The master on the box's own touch display. The kiosk opens it with ?touchDisplay=1 (provisioning/roles/kiosk), and
 * nothing there may leave the master: no context menu by a long press, no logout, no other role and no new windows
 * (which would be a whole browser). The flag is kept in the sessionStorage, since the master reloads and navigates
 * without it.
 */
export class KioskHelper {
  private static readonly PARAMETER = 'touchDisplay';
  private static readonly STORAGE_KEY = 'buzzerbox.touchDisplay';
  public static readonly CSS_CLASS = 'bb-touch-display';
  private static active = false;

  private constructor() {
    // making it private to avoid this class being instantiated
  }

  /**
   * Whether the page runs on the box's touch display, remembering it once the URL said so
   */
  public static isTouchDisplay(search: string, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined): boolean {
    if (new URLSearchParams(search).get(KioskHelper.PARAMETER) === '1') {
      try {
        storage?.setItem(KioskHelper.STORAGE_KEY, '1');
      } catch {
        // the URL still counts for this page
      }
      return true;
    }
    try {
      return storage?.getItem(KioskHelper.STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }

  /**
   * Whether this page is the master on the box's touch display, once apply() ran
   */
  public static isActive(): boolean {
    return KioskHelper.active;
  }

  /**
   * On the touch display: no context menu, no selecting text by a long press (styles.scss) and no links that open a
   * new window
   */
  public static apply(): void {
    let storage: Storage | undefined;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = undefined;
    }
    if (!KioskHelper.isTouchDisplay(window.location.search, storage)) {
      return;
    }
    KioskHelper.active = true;
    document.documentElement.classList.add(KioskHelper.CSS_CLASS);
    window.addEventListener('contextmenu', event => event.preventDefault(), {capture: true});
    window.addEventListener('click', event => {
      const link = event.target instanceof Element ? event.target.closest('a[target]') : null;
      if (link && link.getAttribute('target') !== '_self') {
        event.preventDefault();
      }
    }, {capture: true});
  }
}

/**
 * Keeps the touch display on the master: the pages for choosing a role, the screen and the dev board send it there
 */
export const touchDisplayGuard: CanActivateFn = () => KioskHelper.isActive() ? inject(Router).parseUrl('/master') : true;
