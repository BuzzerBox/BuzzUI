import {Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChange, SimpleChanges} from '@angular/core';
import {FileService} from '../../services/file.service';
import {IDirectoryTree, StringHelper} from '../../../../../shared/shared';
import {NestedTreeControl} from '@angular/cdk/tree';
import {MatTreeNestedDataSource} from '@angular/material/tree';
import {addWarning} from '@angular-devkit/build-angular/src/utils/webpack-diagnostics';

@Component({
  selector: 'app-select-media',
  templateUrl: './select-media.component.html',
  styleUrls: ['./select-media.component.css']
})
export class SelectMediaComponent implements OnInit, OnChanges {
  treeControl = new NestedTreeControl<IDirectoryTree>(node => node.children);
  dataSource = new MatTreeNestedDataSource<IDirectoryTree>();
  activeNode: IDirectoryTree;
  @Output() locationChange: EventEmitter<string> = new EventEmitter<string>();
  @Input() location: string;

  private hasFetchedData = false;


  constructor(private fileService: FileService) {
    this.getMediaDirectory();
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    const locationVarName = 'location';
    // if the change comes from the 'location' property and neither null nor empty
    if (
      changes.hasOwnProperty(locationVarName) && changes[locationVarName] != null
      && !StringHelper.isEmpty(changes[locationVarName].currentValue as string)
    ) {
      const locChangeObject: SimpleChange = changes[locationVarName];
      const node: IDirectoryTree | null = await this.getNodeByFilePath(locChangeObject.currentValue);
      if (node != null) {
        this.activeNode = node;
      }
    }
  }

  ngOnInit(): void {
  }

  async getMediaDirectory(): Promise<void> {
    const result = await this.fileService.getMediaList();
    this.dataSource.data = result.children;
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

  hasChild = (_: number, node: IDirectoryTree) => !!node.children && node.children.length > 0;

  private async getData(): Promise<IDirectoryTree[]> {
    if (!this.hasFetchedData) {
      await this.getMediaDirectory();
    }
    return Promise.resolve(this.dataSource.data);
  }

  public async getNodeByFilePath(filePath: string): Promise<IDirectoryTree | null> {
    for (const node of (await this.getData())) {
      if (FileService.buildFullPathString(node.path) === filePath) {
        return node;
      }
    }
    return null;
  }



}
