export enum EGameStatesMaster {
  STARTING,
  MASTER_ACCEPTED,
  RECEIVED_PRESETUP_DATA,
  // the game is over and the scores are shown
  END,
  READY_TO_START,
  PLAYING,
  // the server refused this master since another one is connected
  REJECTED
}
