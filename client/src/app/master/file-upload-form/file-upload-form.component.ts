// Based on https://github.com/progtarek/angular-drag-n-drop-directive
import {Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild} from '@angular/core';
import {IUploadFormData} from '../interfaces/IUploadFormData';
import {FormatHelper} from '../../helper/format.helper';

@Component({
    selector: 'app-file-upload-form',
    templateUrl: './file-upload-form.component.html',
    styleUrls: ['./file-upload-form.component.css'],
    standalone: false
})
export class FileUploadFormComponent implements OnInit {
  @ViewChild('fileDropRef', {static: false}) fileDropEl: ElementRef;
  @Output() data: EventEmitter<IUploadFormData> = new EventEmitter<IUploadFormData>();


  file: File;

  constructor() {
  }


  onFileDropped($event): void {
    this.prepareFilesList($event);
    this.data.emit({completed: true, type: 'file', data: this.file});
  }

  fileBrowseHandler(files): void {
    this.prepareFilesList(files);
    this.data.emit({completed: true, type: 'file', data: this.file});
  }

  deleteFile(): void {
    this.file = undefined;
    this.data.emit({completed: false, type: 'file', data: undefined});
  }


  prepareFilesList(files: Array<any>): void {
    for (const item of files) {
      item.progress = 0;
      this.file = item;
    }
    // the file input is only there while no file is selected; a file can also be dropped onto the selected one
    if (this.fileDropEl) {
      this.fileDropEl.nativeElement.value = '';
    }
  }

  formatBytes(bytes: number): string {
    return FormatHelper.formatBytes(bytes, 2);
  }

  ngOnInit(): void {
  }
}
