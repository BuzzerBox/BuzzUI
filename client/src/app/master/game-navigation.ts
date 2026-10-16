/**
 * What the editor (the setup) gets in the navigation state (history.state) to edit a stored game; without it, it
 * creates a new one
 */
export interface IEditorNavigationState {
  locationId: string;
  gameName: string;
  /**
   * The version whose questions the editor starts with; saving them makes a new version. The latest without it.
   */
  baseVersion?: number;
}

/**
 * What the editor gets in the navigation state to create a new game, on the location chosen in the game manager
 */
export interface INewGameNavigationState {
  newGameLocationId: string;
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
