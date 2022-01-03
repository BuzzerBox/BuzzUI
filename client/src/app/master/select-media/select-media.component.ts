import { Component, OnInit } from '@angular/core';
import {FileService} from '../../services/file.service';
import {IDirectoryTree} from '../../../../../shared/shared';
import {NestedTreeControl} from "@angular/cdk/tree";
import {MatTreeNestedDataSource} from "@angular/material/tree";

@Component({
  selector: 'app-select-media',
  templateUrl: './select-media.component.html',
  styleUrls: ['./select-media.component.css']
})
export class SelectMediaComponent implements OnInit {
  treeControl = new NestedTreeControl<IDirectoryTree>(node => node.children);
  dataSource = new MatTreeNestedDataSource<IDirectoryTree>();

  constructor(private fileService: FileService) {
    this.getMediaDirectory();
  }

  ngOnInit(): void {

  }

  async getMediaDirectory(): Promise<void> {
    const result = await this.fileService.getMediaList();
    this.dataSource.data = result.children;
  }

  hasChild = (_: number, node: IDirectoryTree) => !!node.children && node.children.length > 0;

}
