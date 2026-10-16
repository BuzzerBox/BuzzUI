/**
 * What the editor (the setup) gets in the navigation state (history.state) to edit a stored game; without it, it
 * creates a new one
 */
export interface IEditorNavigationState {
  locationId: string;
  gameName: string;
}

/**
 * What the page that prepares a game for playing gets in the navigation state
 */
export interface IPrepareNavigationState {
  locationId: string;
  gameName: string;
  gameVersion: number;
  /**
   * The state to continue; a new state is started without it
   */
  stateName?: string;
}
