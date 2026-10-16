import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {IStorageLocation} from '../../../../../shared/shared';
import {StorageService} from '../../services/storage.service';
import {FormatHelper} from '../../helper/format.helper';

/**
 * Lets the master choose between the box and the USB sticks. Sticks can be plugged in or pulled out any time, so the
 * list is refreshed while it is shown.
 */
@Component({
    selector: 'app-storage-locations',
    templateUrl: './storage-locations.component.html',
    styleUrls: ['./storage-locations.component.css'],
    standalone: false
})
export class StorageLocationsComponent implements OnInit, OnDestroy {
  private static readonly REFRESH_INTERVAL_IN_MS = 5000;

  /**
   * Emits the chosen location whenever another one is chosen, or null if there is none
   */
  @Output() selectedChange = new EventEmitter<IStorageLocation | null>();
  /**
   * Only offers the USB sticks, e.g. to copy media from
   */
  @Input() usbOnly = false;
  /**
   * The id of the location to choose first, if it is there
   */
  @Input() initialId: string = null;

  public locations: IStorageLocation[] = null;
  public selected: IStorageLocation = null;
  public error: string = null;
  private interval: ReturnType<typeof setInterval>;

  constructor(private storage: StorageService) { }

  ngOnInit(): void {
    this.refresh();
    this.interval = setInterval(() => this.refresh(), StorageLocationsComponent.REFRESH_INTERVAL_IN_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
  }

  public async refresh(): Promise<void> {
    if (!this.storage.isAvailable()) {
      this.error = 'Nur die Spielleitung kann auf den Speicher zugreifen.';
      return;
    }
    try {
      this.locations = (await this.storage.getLocations()).filter(location => !this.usbOnly || location.type === 'usb');
      this.error = null;
    } catch (e) {
      this.error = StorageService.getErrorMessage(e);
      return;
    }
    const stillThere = this.locations.find(location => location.id === this.selected?.id);
    if (stillThere) {
      // with the free space as it is now
      this.selected = stillThere;
    } else {
      this.select(this.locations.find(location => location.id === this.initialId) ?? this.locations[0] ?? null);
    }
  }

  public select(location: IStorageLocation | null): void {
    this.selected = location;
    this.selectedChange.emit(location);
  }

  public selectById(id: string): void {
    this.select(this.locations.find(location => location.id === id) ?? null);
  }

  public getSpace(location: IStorageLocation): string {
    if (location.freeBytes == null) {
      return '';
    }
    return FormatHelper.formatBytes(location.freeBytes) + ' frei';
  }
}
