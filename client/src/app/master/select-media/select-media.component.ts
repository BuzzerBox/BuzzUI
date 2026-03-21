import {ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChange, SimpleChanges} from '@angular/core';
import {FileService} from '../../services/file.service';
import {IDirectoryTree, StringHelper, FileExtensionsService} from '../../../../../shared/shared';
import {NestedTreeControl} from '@angular/cdk/tree';
import {MatTreeNestedDataSource} from '@angular/material/tree';

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
  @Output() locationChange: EventEmitter<string> = new EventEmitter<string>();
  @Input() fileLocation: string;

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
        this.cdr.markForCheck();
      } else {
        const data = await this.getData();
        const node: IDirectoryTree | null = await this.getNodeByFilePath(locChangeObject.currentValue, data);
        this.activeNode = node ?? undefined;
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
    if (!node || node === this.activeNode) {
      this.activeNode = undefined;
      this.locationChange.emit('');
    } else {
      this.activeNode = node;
      this.locationChange.emit(node.path);
    }
  }

  hasChild = (_: number, node: IDirectoryTree) => !!node && !!node.children && node.children.length > 0;

  private async getData(): Promise<IDirectoryTree> {
    if (!this.hasFetchedData) {
      await this.getMediaDirectory();
    }
    return Promise.resolve(this.dataSource.data[0]);
  }

  public async getNodeByFilePath(filePath: string, root: IDirectoryTree): Promise<IDirectoryTree | null> {
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
    return !!FileExtensionsService.getImageExtensions().includes(node.extension);
  }

  public isVideo(node: IDirectoryTree): boolean {
    return !!FileExtensionsService.getVideoExtensions().includes(node.extension);
  }

}
