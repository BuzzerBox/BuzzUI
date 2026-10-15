import {Injectable, isDevMode} from '@angular/core';
import config from '../../../../config.json';
import configDev from '../../../../config.dev.json';
import { defaultsDeep } from 'lodash-es';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private constructor() {}

  /**
   * Get the config dependent on the running mode
   */
  public static getConfig(): typeof config {
    if (isDevMode()) {
      return defaultsDeep(configDev, config);
    } else {
      return config;
    }
  }

  /**
   * An alias for getConfig()
   * @see getConfig
   */
  public static get(): typeof config {
    return this.getConfig();
  }

  /**
   * The host of the game server. If the config leaves it empty, it's the host this page was loaded from, so the app
   * keeps working when the server's IP address or hostname changes.
   */
  public static getServerAddress(): string {
    return this.get().server.address || window.location.hostname;
  }

  /**
   * The URL of the game server's WebSocket. Behind a reverse proxy (config.reverseProxy), it's /ws on the page's own
   * origin, so the proxy's TLS and login cover it too.
   */
  public static getWebSocketUrl(): string {
    if (this.get().reverseProxy) {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return protocol + '://' + window.location.host + '/ws';
    }
    return this.get().server.webSocketProtocol + '://' + this.getServerAddress() + ':' + this.get().server.port;
  }

  /**
   * The URL the file server serves the media under. Behind a reverse proxy (config.reverseProxy), it's on the page's
   * own origin.
   */
  public static getMediaUrl(): string {
    const fileServer = this.get().fileServer;
    if (this.get().reverseProxy) {
      return window.location.origin + fileServer.publicPath;
    }
    return 'http://' + this.getServerAddress() + ':' + fileServer.port + fileServer.publicPath;
  }

  public static isDevMode(): boolean {
    return isDevMode();
  }
}
