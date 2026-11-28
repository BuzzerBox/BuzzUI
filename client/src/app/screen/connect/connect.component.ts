import {Component, ElementRef, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {GameService} from '../../services/game.service';
import {Subscription} from 'rxjs';
import {ConfigService} from '../../services/config.service';
import {ScreenThemeHelper} from '../../themes/screen-theme.helper';
import {BreathHelper} from '../../helper/breath.helper';

@Component({
    selector: 'app-connect',
    templateUrl: './connect.component.html',
    styleUrls: ['./connect.component.css'],
    standalone: false
})
export class ConnectComponent implements OnInit, OnDestroy {
  public isWebsocketConnected = false;
  // the theme of the screen's last game, until the next one is set up
  private readonly theme = ScreenThemeHelper.getStored();
  public readonly isShowStyle = this.theme.style === 'show';
  // the classic theme's spinner: as large as before on big screens, but no more than half of a small one
  public readonly spinnerDiameter = Math.round(Math.min(400, window.innerHeight * 0.5, window.innerWidth * 0.5));
  // how to get to the master, shown to the person hosting while the screen waits
  public readonly join = ConfigService.get().join;
  private isWebsocketConnectedSubscription: Subscription;
  // the logo breathing, for a minute after the screen changed (show themes only)
  private logo?: Element;
  private breath?: Animation;

  @ViewChild('logo') set logoRef(ref: ElementRef<HTMLImageElement> | undefined) {
    if (ref?.nativeElement !== this.logo) {
      this.logo = ref?.nativeElement;
      this.breathe();
    }
  }

  constructor(private game: GameService) {
    game.useAsScreen();
    ScreenThemeHelper.apply(this.theme.id);
    this.isWebsocketConnectedSubscription = this.game.observeIsWebsocketConnected().subscribe(isConnected => {
      if (isConnected && !this.isWebsocketConnected) {
        this.isWebsocketConnected = true;
        // a new message: the logo breathes again for a while
        this.breathe();
      }
    });
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.breath?.cancel();
    this.isWebsocketConnectedSubscription.unsubscribe();
  }

  private breathe(): void {
    if (this.logo) {
      this.breath = BreathHelper.breathe(this.logo, this.breath);
    } else {
      this.breath?.cancel();
      this.breath = undefined;
    }
  }

}
