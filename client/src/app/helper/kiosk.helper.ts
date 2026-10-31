/**
 * The master on the box's own touch display. The kiosk opens it with ?touchDisplay=1 (provisioning/roles/kiosk), and
 * there a long press must not open Chromium's context menu, from which one could leave the master. The flag is kept in
 * the sessionStorage, since the master reloads and navigates without it.
 */
export class KioskHelper {
  private static readonly PARAMETER = 'touchDisplay';
  private static readonly STORAGE_KEY = 'buzzerbox.touchDisplay';
  public static readonly CSS_CLASS = 'bb-touch-display';

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
   * On the touch display: no context menu and no selecting text by a long press (styles.scss)
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
    document.documentElement.classList.add(KioskHelper.CSS_CLASS);
    window.addEventListener('contextmenu', event => event.preventDefault(), {capture: true});
  }
}
