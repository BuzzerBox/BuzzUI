import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChange, SimpleChanges} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {Subscription} from 'rxjs';
import {IDirectoryTree, StringHelper, FileExtensionsService, StorageApiHelper} from '../../../../../shared/shared';
import {IGameRef, StorageService} from '../../services/storage.service';
import {DialogCopyMediaComponent, IDialogCopyMediaData} from '../dialog-copy-media/dialog-copy-media.component';
import {NestedTreeControl} from '@angular/cdk/tree';
import {MatTreeNestedDataSource} from '@angular/material/tree';
import {IMediaSelection} from '../interfaces/IMediaSelection';

@Component({
    selector: 'app-select-media',
    templateUrl: './select-media.component.html',
    styleUrls: ['./select-media.component.css'],
    standalone: false
})
export class SelectMediaComponent implements OnInit, OnChanges, OnDestroy {
  treeControl = new NestedTreeControl<IDirectoryTree>(node => node.children);
  dataSource = new MatTreeNestedDataSource<IDirectoryTree>();
  activeNode: IDirectoryTree;
  @Output() locationChange: EventEmitter<IMediaSelection> = new EventEmitter<IMediaSelection>();
  /**
   * The selected file or folder, relative to the game's media
   */
  @Input() fileLocation: string;
  /**
   * The game whose media are offered
   */
  @Input() game: IGameRef;
  // the selected media file or folder if it isn't in the media folder (e.g. the USB stick is missing)
  public missingLocation: string | null = null;

  public uploading = false;
  // whether the media are shown to choose from; they always are while nothing is selected
  public browsing = false;
  // the game's media folder, whose content the tree shows
  private root: IDirectoryTree | null = null;
  private hasFetchedData = false;
  private fetching: Promise<void> = null;
  private subscription: Subscription;


  constructor(private storage: StorageService, private cdr: ChangeDetectorRef, private dialog: MatDialog, private snackBar: MatSnackBar) {
    // every picker of the game shows media that were added in one of them
    this.subscription = this.storage.observeGameMediaChanges().subscribe(ref => {
      if (ref.gameName === this.game?.gameName && ref.location.id === this.game?.location.id) {
        this.reload();
      }
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private async reload(): Promise<void> {
    this.hasFetchedData = false;
    await this.getData();
    if (this.fileLocation) {
      this.activeNode = (await this.getNodeByFilePath(this.fileLocation, this.root)) ?? undefined;
      this.missingLocation = this.activeNode == null ? this.fileLocation : null;
    }
    this.cdr.markForCheck();
  }

  /**
   * Uploads files from this device into the game's media
   */
  async upload(files: FileList): Promise<void> {
    this.uploading = true;
    for (const file of Array.from(files ?? [])) {
      if (!FileExtensionsService.isSupportedExtension(FileExtensionsService.getExtension(file.name)) || !StorageApiHelper.isValidName(file.name)) {
        this.snackBar.open(`${file.name} wird übersprungen: Nur Bilder, Videos und Audiodateien mit gültigem Namen können hochgeladen werden.`, 'OK', {duration: 6000});
        continue;
      }
      try {
        await this.storage.uploadGameMedia(this.game, '', file).toPromise();
      } catch (e) {
        const reason = StorageService.isConflict(e) ? 'Es gibt schon eine Datei mit diesem Namen.' : StorageService.getErrorMessage(e);
        this.snackBar.open(`${file.name} wurde nicht hochgeladen: ${reason}`, 'OK', {duration: 6000});
      }
    }
    this.uploading = false;
  }

  openCopyDialog(): void {
    this.dialog.open<DialogCopyMediaComponent, IDialogCopyMediaData>(DialogCopyMediaComponent, {data: {game: this.game}, width: '800px'});
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes.game && changes.game.previousValue !== changes.game.currentValue) {
      if (changes.fileLocation) {
        this.hasFetchedData = false;
        await this.getData();
      } else {
        await this.reload();
      }
    }
    const locationVarName = 'fileLocation';
    if (changes.hasOwnProperty(locationVarName) && changes[locationVarName] != null) {
      const locChangeObject: SimpleChange = changes[locationVarName];
      if (StringHelper.isEmpty(locChangeObject.currentValue as string)) {
        this.activeNode = undefined;
        this.missingLocation = null;
        this.cdr.markForCheck();
      } else {
        const data = await this.getData();
        const node: IDirectoryTree | null = await this.getNodeByFilePath(locChangeObject.currentValue, data);
        this.activeNode = node ?? undefined;
        this.missingLocation = node == null ? locChangeObject.currentValue : null;
        this.cdr.markForCheck();
      }
    }
  }

  ngOnInit(): void {
  }

  async getMediaDirectory(): Promise<void> {
    let result: IDirectoryTree = null;
    if (this.game != null) {
      try {
        result = await this.storage.getGameMediaTree(this.game);
      } catch (e) {
        console.error('Could not load the media of the game', e);
      }
    }
    this.root = result;
    // the media folder itself isn't shown, only what is in it
    this.dataSource.data = result?.children ?? [];
    this.hasFetchedData = true;
  }

  changeSelection(node: IDirectoryTree): void {
    this.missingLocation = null;
    if (!node || node === this.activeNode) {
      this.activeNode = undefined;
      this.locationChange.emit({path: ''});
    } else {
      this.activeNode = node;
      this.browsing = false;
      this.locationChange.emit({path: node.path});
    }
  }

  selectSlideshow(folder: IDirectoryTree): void {
    if (folder === this.activeNode) {
      this.changeSelection(undefined);
      return;
    }
    this.activeNode = folder;
    this.missingLocation = null;
    this.browsing = false;
    this.locationChange.emit({path: folder.path, slides: this.getSlideImages(folder).map(image => image.path)});
  }

  /**
   * The images directly in this folder, sorted by name with numbers in numeric order (2 before 10)
   */
  getSlideImages(folder: IDirectoryTree): IDirectoryTree[] {
    return (folder.children ?? [])
      .filter(child => child.type === 'file' && this.isImage(child))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
  }

  canBeSlideshow(folder: IDirectoryTree): boolean {
    return this.getSlideImages(folder).length >= 2;
  }

  hasChild = (_: number, node: IDirectoryTree) => !!node && !!node.children && node.children.length > 0;

  private async getData(): Promise<IDirectoryTree> {
    if (!this.hasFetchedData) {
      // the location and the game come in together, so they are fetched once
      this.fetching ??= this.getMediaDirectory().finally(() => this.fetching = null);
      await this.fetching;
    }
    return Promise.resolve(this.root);
  }

  public async getNodeByFilePath(filePath: string, root: IDirectoryTree | null): Promise<IDirectoryTree | null> {
    // without media (e.g. no USB stick), the selected file can't be found
    if (root == null) {
      return null;
    }
    if (root.path === filePath) {
      return root;
    } else if (root.type === 'directory') {
      for (const child of root.children) {
        const result =  this.getNodeByFilePath(filePath, child);
        if (await result !== null) {
          return result;
        }
      }
    }
    return null;
  }

  public getIcon(node: IDirectoryTree): string {
    if (node.type === 'directory') {
      return 'burst_mode';
    }
    return this.isVideo(node) ? 'movie' : this.isAudio(node) ? 'audiotrack' : 'image';
  }

  /**
   * What kind of media the selection is, e.g. "Diashow · 4 Bilder"
   */
  public getKindText(node: IDirectoryTree): string {
    if (node.type === 'directory') {
      return `Diashow · ${this.getSlideImages(node).length} Bilder`;
    }
    return this.isVideo(node) ? 'Video' : this.isAudio(node) ? 'Audio' : 'Bild';
  }

  public isImage(node: IDirectoryTree): boolean {
    return FileExtensionsService.isImage(node.name);
  }

  public isVideo(node: IDirectoryTree): boolean {
    return FileExtensionsService.isVideo(node.name);
  }

  public isAudio(node: IDirectoryTree): boolean {
    return FileExtensionsService.isAudio(node.name);
  }

}
