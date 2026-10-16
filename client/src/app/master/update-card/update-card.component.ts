import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {isEqual} from 'lodash-es';
import {EUpdateSignatures, EUpdateStates, IUpdateBundle, IUpdateInfoPacket, IUpdateStatus} from '../../../../../shared/shared';
import versionInfo from '../../../../../version.json';
import {GameService} from '../../services/game.service';

/**
 * Shows the installed version and the update bundles on the USB sticks, and installs one of them. Installing restarts
 * the server, so this is only shown while no game is set up.
 */
@Component({
    selector: 'app-update-card',
    templateUrl: './update-card.component.html',
    styleUrls: ['./update-card.component.css'],
    standalone: false
})
export class UpdateCardComponent implements OnInit, OnDestroy {
  public readonly EUpdateStates = EUpdateStates;
  // the version of this page, which is outdated after an update until it is reloaded
  public readonly pageVersion = versionInfo.version;

  public info: IUpdateInfoPacket;
  // the bundle whose installation has to be confirmed
  public confirmFileName: string = null;
  // whether the warning about a bundle without a valid signature was accepted
  public isRiskAccepted = false;
  // between clicking install and the server reporting how the update goes
  public isStarting = false;
  public startError: string = null;
  private statusWhenStarting: IUpdateStatus;
  private subscriptions: Subscription[] = [];

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.subscriptions.push(this.game.observeUpdateInfo().subscribe(info => {
      this.info = info;
      if (this.isStarting && !isEqual(info.status, this.statusWhenStarting)) {
        this.isStarting = false;
      }
    }));
    this.subscriptions.push(this.game.observeInstallUpdateResponses().subscribe(response => {
      if (!response.wasSuccessful) {
        this.isStarting = false;
        this.startError = response.reason ?? 'Das Update konnte nicht gestartet werden.';
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public isUpdating(): boolean {
    return this.isStarting || this.info?.status?.state === EUpdateStates.RUNNING;
  }

  public isPageOutdated(): boolean {
    return this.info != null && this.info.installedVersion !== this.pageVersion && !this.isUpdating();
  }

  public getBundleLabel(bundle: IUpdateBundle): string {
    if (bundle.isNewer) {
      return 'neuer';
    }
    return bundle.version === this.info.installedVersion ? 'installiert' : 'älter';
  }

  public isSigned(bundle: IUpdateBundle): boolean {
    return bundle.signature === EUpdateSignatures.VALID;
  }

  public getSignatureProblem(bundle: IUpdateBundle): string {
    switch (bundle.signature) {
      case EUpdateSignatures.MISSING:
        return 'nicht signiert';
      case EUpdateSignatures.NO_PUBLIC_KEY:
        return 'Signatur nicht prüfbar, die BuzzerBox hat keinen Schlüssel';
      default:
        return 'ungültige Signatur';
    }
  }

  /**
   * The bundle waiting for confirmation, if it has no valid signature, for which a warning is shown
   */
  public getUnsignedBundleToConfirm(): IUpdateBundle | undefined {
    return this.info.bundles.find(bundle => bundle.fileName === this.confirmFileName && !this.isSigned(bundle));
  }

  public askToConfirm(bundle: IUpdateBundle): void {
    this.confirmFileName = bundle.fileName;
    this.isRiskAccepted = false;
  }

  public install(bundle: IUpdateBundle): void {
    const allowUnsigned = !this.isSigned(bundle);
    if (allowUnsigned && !this.isRiskAccepted) {
      return;
    }
    this.confirmFileName = null;
    this.isRiskAccepted = false;
    this.startError = null;
    this.isStarting = true;
    this.statusWhenStarting = this.info.status;
    this.game.installUpdate(bundle.fileName, allowUnsigned);
  }

  public reload(): void {
    window.location.reload();
  }
}
