import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChange, SimpleChanges} from '@angular/core';
import {FileService} from '../../services/file.service';
import {IDirectoryTree, StringHelper, FileExtensionsService} from '../../../../../shared/shared';
import {NestedTreeControl} from '@angular/cdk/tree';
import {MatTreeNestedDataSource} from '@angular/material/tree';
import {IMediaSelection} from '../interfaces/IMediaSelection';

@Component({
    selector: 'app-select-media',
    templateUrl: './select-media.component.html',
    styleUrls: ['./select-media.component.css'],
    standalone: false
})
export class SelectMediaComponent implements OnInit, OnChanges {
  treeControl = new NestedTreeControl<IDirectoryTree>(node => node.children);
  dataSource = new MatTreeNestedDataSource<IDirectoryTree>();
  activeNode: IDirectoryTree;
  @Output() locationChange: EventEmitter<IMediaSelection> = new EventEmitter<IMediaSelection>();
  @Input() fileLocation: string;
  // the selected media file or folder if it isn't in the media folder (e.g. the USB stick is missing)
  public missingLocation: string | null = null;

  private hasFetchedData = false;


  constructor(private fileService: FileService, private cdr: ChangeDetectorRef) {
    this.getMediaDirectory();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
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
    const result = await this.fileService.getMediaList();
    this.dataSource.data = result != null ? [result] : [];
    this.hasFetchedData = true;
  }

  changeSelection(node: IDirectoryTree): void {
    this.missingLocation = null;
    if (!node || node === this.activeNode) {
      this.activeNode = undefined;
      this.locationChange.emit({path: ''});
    } else {
      this.activeNode = node;
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

  /**
   * Only subfolders of the media folder can be slideshows, not the media folder itself
   */
  canBeSlideshow(folder: IDirectoryTree): boolean {
    return folder !== this.dataSource.data[0] && this.getSlideImages(folder).length >= 2;
  }

  hasChild = (_: number, node: IDirectoryTree) => !!node && !!node.children && node.children.length > 0;

  private async getData(): Promise<IDirectoryTree> {
    if (!this.hasFetchedData) {
      await this.getMediaDirectory();
    }
    return Promise.resolve(this.dataSource.data[0]);
  }

  public async getNodeByFilePath(filePath: string, root: IDirectoryTree | null): Promise<IDirectoryTree | null> {
    // without media (e.g. no USB stick), the selected file can't be found
    if (root == null) {
      return null;
    }
    if (FileService.buildFullPathString(root.path) === filePath) {
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
